const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzkVzUBKbKwFcPXqBAsDLHqxmigfsPg-WNSaA3fxrU5R9S-JG25en2wrAoic0lBhzCp/exec';

const STORAGE_KEYS = {
  chat: 'budget-tracker-chat-history-v2',
  view: 'budget-tracker-active-view-v2',
};

const state = {
  currentView: 'chat',
  chatMessages: [],
  recapData: null,
  recapChart: null,
  recapLoading: false,
};

const dom = {
  chatForm: document.getElementById('chatForm'),
  messageInput: document.getElementById('messageInput'),
  sendBtn: document.getElementById('sendBtn'),
  clearChatBtn: document.getElementById('clearChatBtn'),
  refreshRecapBtn: document.getElementById('refreshRecapBtn'),
  chatMessages: document.getElementById('chatMessages'),
  recapUpdatedAt: document.getElementById('recapUpdatedAt'),
  recapSourceBadge: document.getElementById('recapSourceBadge'),
  totalIncome: document.getElementById('totalIncome'),
  totalExpense: document.getElementById('totalExpense'),
  totalBalance: document.getElementById('totalBalance'),
  transactionCount: document.getElementById('transactionCount'),
  transactionsMeta: document.getElementById('transactionsMeta'),
  transactionsList: document.getElementById('transactionsList'),
  recapChart: document.getElementById('recapChart'),
  chartEmptyState: document.getElementById('chartEmptyState'),
  viewButtons: Array.from(document.querySelectorAll('[data-view]')),
  views: Array.from(document.querySelectorAll('.view')),
  quickChips: Array.from(document.querySelectorAll('.chip')),
};

const WELCOME_TEXT = `Halo! 👋 Saya siap membantu catat transaksi Anda. Cukup ketik seperti:
• "beli makan 50rb"
• "gajian 5 juta"
• "bayar listrik 200rb"

Atau ketik <strong>#recap</strong> untuk lihat ringkasan.`;

const CATEGORY_LABELS = {
  food: 'Makanan',
  transport: 'Transport',
  utilities: 'Tagihan',
  salary: 'Gaji',
  transfer: 'Transfer',
  shopping: 'Belanja',
  entertainment: 'Hiburan',
  health: 'Kesehatan',
  other: 'Lainnya',
};

window.addEventListener('DOMContentLoaded', init);

function init() {
  state.chatMessages = loadChatHistory();
  state.currentView = normalizeView(location.hash.replace('#', '') || readStorage(STORAGE_KEYS.view) || 'chat');

  bindEvents();
  switchView(state.currentView, { persist: false, refreshRecap: false });
  renderChatFeed();

  if (state.currentView === 'recap') {
    loadRecapData();
  }

  focusComposer();
}

function bindEvents() {
  dom.viewButtons.forEach((button) => {
    button.addEventListener('click', () => {
      switchView(button.dataset.view || 'chat');
    });
  });

  dom.chatForm.addEventListener('submit', handleSubmit);
  dom.clearChatBtn.addEventListener('click', clearChatHistory);
  dom.refreshRecapBtn.addEventListener('click', () => loadRecapData({ force: true }));

  dom.quickChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      dom.messageInput.value = chip.dataset.suggestion || '';
      dom.messageInput.focus();
    });
  });

  window.addEventListener('hashchange', () => {
    const nextView = normalizeView(location.hash.replace('#', '') || 'chat');
    if (nextView !== state.currentView) {
      switchView(nextView, { persist: false });
    }
  });
}

function switchView(view, options = {}) {
  const nextView = normalizeView(view);
  const shouldPersist = options.persist !== false;
  const shouldRefreshRecap = options.refreshRecap !== false;

  state.currentView = nextView;

  dom.views.forEach((section) => {
    section.classList.toggle('is-active', section.dataset.view === nextView);
  });

  dom.viewButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.view === nextView);
  });

  if (shouldPersist) {
    writeStorage(STORAGE_KEYS.view, nextView);
  }

  if (typeof history !== 'undefined' && history.replaceState) {
    history.replaceState(null, '', `#${nextView}`);
  }

  if (nextView === 'recap' && shouldRefreshRecap) {
    loadRecapData();
  }

  if (nextView === 'chat') {
    focusComposer();
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  const rawMessage = dom.messageInput.value.trim();
  if (!rawMessage) {
    return;
  }

  const userMessage = createMessageRecord('user', rawMessage);
  state.chatMessages.push(userMessage);
  persistChatHistory();
  renderChatFeed();

  dom.messageInput.value = '';
  setComposerDisabled(true);

  const loadingNode = appendLoadingMessage();

  try {
    const payload = await postChatMessage(rawMessage);
    removeNode(loadingNode);

    if (!payload || payload.success === false) {
      const errorMessage = payload && payload.error ? payload.error : 'Respons backend tidak valid.';
      appendTransientSystemMessage(`❌ Error: ${errorMessage}`);
      return;
    }

    if (payload.response) {
      state.chatMessages.push(
        createMessageRecord('bot', payload.response)
      );
      persistChatHistory();
      renderChatFeed();
    }

    const recapPayload = normalizeRecapPayload(payload);
    if (recapPayload) {
      saveRecapCache(recapPayload);
      applyRecapData(recapPayload, 'live');
    }

    if (isRecapCommand(rawMessage)) {
      switchView('recap', { refreshRecap: false });
      loadRecapData({ force: true });
      return;
    }

    if (state.currentView === 'recap' && recapPayload) {
      renderRecap(recapPayload, 'live');
    }
  } catch (error) {
    removeNode(loadingNode);
    appendTransientSystemMessage(`❌ ${error.message || 'Koneksi ke backend gagal.'}`);
  } finally {
    setComposerDisabled(false);
    focusComposer();
  }
}

async function postChatMessage(message) {
  return requestJson(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({ message }),
  });
}

async function loadRecapData(options = {}) {
  if (state.recapLoading) {
    return;
  }

  state.recapLoading = true;
  setRecapStatus('Memuat dari server...');

  try {
    const payload = await fetchRecapPayload();
    const recapData = normalizeRecapPayload(payload);

    if (!recapData) {
      throw new Error('Recap payload tidak mengandung transactions atau summary.');
    }

    applyRecapData(recapData, 'live');
  } catch (error) {
    setRecapError(error.message || 'Gagal memuat ringkasan.');
  } finally {
    state.recapLoading = false;
  }
}

async function fetchRecapPayload() {
  const attempts = [
    {
      url: `${APPS_SCRIPT_URL}?action=recap`,
      options: { method: 'GET' },
    },
    {
      url: APPS_SCRIPT_URL,
      options: {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ action: 'recap' }),
      },
    },
    {
      url: APPS_SCRIPT_URL,
      options: {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ message: '#recap' }),
      },
    },
  ];

  let lastError = null;

  for (const attempt of attempts) {
    try {
      const payload = await requestJson(attempt.url, attempt.options);
      if (payload && (Array.isArray(payload.transactions) || payload.summary || payload.success)) {
        return payload;
      }
      lastError = new Error('Recap response kosong atau tidak sesuai format.');
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Gagal mengambil data recap.');
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  if (!responseText.trim()) {
    throw new Error('Respons kosong dari backend.');
  }

  try {
    return JSON.parse(responseText);
  } catch (error) {
    throw new Error(`Respons bukan JSON: ${responseText.slice(0, 140)}`);
  }
}

function renderChatFeed() {
  dom.chatMessages.innerHTML = '';

  if (state.chatMessages.length === 0) {
    dom.chatMessages.appendChild(createWelcomeNode());
    scrollChatToBottom();
    return;
  }

  state.chatMessages.forEach((message) => {
    dom.chatMessages.appendChild(createMessageNode(message));
  });

  scrollChatToBottom();
}

function createWelcomeNode() {
  const row = document.createElement('div');
  row.className = 'message-row bot';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  const content = document.createElement('div');
  content.className = 'message-content';
  content.innerHTML = WELCOME_TEXT;
  bubble.appendChild(content);

  const time = document.createElement('span');
  time.className = 'message-time';
  time.textContent = 'Sekarang';

  row.appendChild(bubble);
  row.appendChild(time);
  return row;
}

function createMessageNode(message) {
  const row = document.createElement('div');
  row.className = `message-row ${message.role === 'user' ? 'user' : message.role === 'system' ? 'system' : 'bot'}`;
  row.dataset.messageId = message.id;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  const content = document.createElement('div');
  content.className = 'message-content';
  content.innerHTML = formatRichText(message.text);
  bubble.appendChild(content);

  const time = document.createElement('span');
  time.className = 'message-time';
  time.textContent = formatTime(message.timestamp);

  row.appendChild(bubble);
  row.appendChild(time);
  return row;
}

function appendLoadingMessage() {
  const row = document.createElement('div');
  row.className = 'message-row bot';
  row.dataset.loading = 'true';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  const dots = document.createElement('div');
  dots.className = 'loading-dots';
  dots.innerHTML = '<span></span><span></span><span></span>';
  bubble.appendChild(dots);

  const time = document.createElement('span');
  time.className = 'message-time';
  time.textContent = formatTime(new Date().toISOString());

  row.appendChild(bubble);
  row.appendChild(time);
  dom.chatMessages.appendChild(row);
  scrollChatToBottom();
  return row;
}

function appendTransientSystemMessage(text) {
  const message = createMessageRecord('system', text);
  const node = createMessageNode(message);
  dom.chatMessages.appendChild(node);
  scrollChatToBottom();
  return node;
}

function removeNode(node) {
  if (node && node.isConnected) {
    node.remove();
  }
}

function renderRecap(recapData, source = 'live') {
  state.recapData = recapData;

  const summary = recapData.summary || deriveSummary(recapData.transactions || []);
  const transactions = Array.isArray(recapData.transactions) ? recapData.transactions : [];

  dom.totalIncome.textContent = formatCurrency(summary.totalIncome || 0);
  dom.totalExpense.textContent = formatCurrency(summary.totalExpense || 0);
  dom.totalBalance.textContent = formatCurrency(summary.balance ?? (summary.totalIncome || 0) - (summary.totalExpense || 0));
  dom.transactionCount.textContent = String(summary.transactionCount ?? transactions.length ?? 0);
  dom.transactionsMeta.textContent = `${transactions.length} item`;

  const timestamp = recapData.savedAt || recapData.updatedAt || new Date().toISOString();
  dom.recapUpdatedAt.textContent = formatDateTime(timestamp);
  dom.recapSourceBadge.textContent = source === 'live' ? 'Live' : 'Server';

  renderTransactions(transactions);
  renderRecapChart(summary);
}

function applyRecapData(recapData, source) {
  renderRecap(recapData, source);
  if (state.currentView === 'recap') {
    scrollToTopOfRecap();
  }
}

function renderTransactions(transactions) {
  dom.transactionsList.innerHTML = '';

  if (!transactions || transactions.length === 0) {
    dom.transactionsList.innerHTML = '<div class="empty-state">Belum ada transaksi yang bisa ditampilkan.</div>';
    return;
  }

  const sortedTransactions = [...transactions].reverse();

  sortedTransactions.forEach((transaction) => {
    dom.transactionsList.appendChild(createTransactionNode(transaction));
  });
}

function createTransactionNode(transaction) {
  const normalized = normalizeTransactionRecord(transaction);
  const item = document.createElement('div');
  item.className = 'transaction-item';

  const info = document.createElement('div');
  info.className = 'transaction-info';

  const title = document.createElement('strong');
  title.textContent = normalized.description || 'Transaksi';

  const meta = document.createElement('div');
  meta.className = 'transaction-meta';
  meta.textContent = `${normalized.dateLabel} • ${normalized.timeLabel}`;

  const category = document.createElement('div');
  category.className = 'transaction-category';
  category.textContent = formatCategoryLabel(normalized.category);

  info.appendChild(title);
  info.appendChild(meta);
  info.appendChild(category);

  const amount = document.createElement('div');
  amount.className = `transaction-amount ${normalized.type}`;
  amount.textContent = `${normalized.type === 'income' ? '+' : '-'}${formatCurrency(normalized.amount)}`;

  item.appendChild(info);
  item.appendChild(amount);
  return item;
}

function renderRecapChart(summary) {
  const income = Number(summary.totalIncome || 0);
  const expense = Number(summary.totalExpense || 0);
  const hasData = income > 0 || expense > 0;

  if (!hasData) {
    destroyRecapChart();
    dom.recapChart.classList.add('is-hidden');
    dom.chartEmptyState.classList.remove('is-hidden');
    dom.chartEmptyState.textContent = 'Belum ada data transaksi untuk membuat chart.';
    return;
  }

  dom.recapChart.classList.remove('is-hidden');
  dom.chartEmptyState.classList.add('is-hidden');

  destroyRecapChart();

  if (typeof Chart === 'undefined') {
    dom.chartEmptyState.classList.remove('is-hidden');
    dom.chartEmptyState.textContent = 'Chart.js belum termuat.';
    dom.recapChart.classList.add('is-hidden');
    return;
  }

  state.recapChart = new Chart(dom.recapChart, {
    type: 'pie',
    data: {
      labels: ['Pemasukan', 'Pengeluaran'],
      datasets: [
        {
          data: [income, expense],
          backgroundColor: ['#34d399', '#fb7185'],
          borderColor: ['#0f172a', '#0f172a'],
          borderWidth: 2,
          hoverOffset: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#ecf3ff',
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 20,
            font: {
              family: 'Manrope',
              size: 12,
              weight: '700',
            },
          },
        },
        tooltip: {
          callbacks: {
            label(context) {
              return ` ${context.label}: ${formatCurrency(context.raw)}`;
            },
          },
        },
      },
    },
  });
}

function destroyRecapChart() {
  if (state.recapChart) {
    state.recapChart.destroy();
    state.recapChart = null;
  }
}

function clearChatHistory() {
  const confirmed = window.confirm('Hapus riwayat chat dari browser ini? Data transaksi di backend tidak akan dihapus.');
  if (!confirmed) {
    return;
  }

  state.chatMessages = [];
  writeStorage(STORAGE_KEYS.chat, JSON.stringify([]));
  renderChatFeed();
  focusComposer();
}

function persistChatHistory() {
  writeStorage(STORAGE_KEYS.chat, JSON.stringify(state.chatMessages));
}

function loadChatHistory() {
  const raw = readStorage(STORAGE_KEYS.chat);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeChatRecord).filter(Boolean) : [];
  } catch (error) {
    return [];
  }
}

function readRecapCache() {
  return null;
}

function normalizeRecapPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const transactions = Array.isArray(payload.transactions)
    ? payload.transactions
    : Array.isArray(payload.data?.transactions)
      ? payload.data.transactions
      : [];

  const summary = payload.summary || payload.data?.summary || deriveSummary(transactions);

  if (!summary && transactions.length === 0) {
    return null;
  }

  return {
    transactions,
    summary: summary || deriveSummary(transactions),
    savedAt: payload.savedAt || payload.updatedAt || new Date().toISOString(),
  };
}

function deriveSummary(transactions) {
  const totals = transactions.reduce(
    (accumulator, transaction) => {
      const normalized = normalizeTransactionRecord(transaction);
      if (normalized.type === 'income') {
        accumulator.totalIncome += normalized.amount;
      } else {
        accumulator.totalExpense += normalized.amount;
      }
      return accumulator;
    },
    {
      totalIncome: 0,
      totalExpense: 0,
    }
  );

  return {
    totalIncome: totals.totalIncome,
    totalExpense: totals.totalExpense,
    balance: totals.totalIncome - totals.totalExpense,
    transactionCount: transactions.length,
  };
}

function normalizeTransactionRecord(transaction) {
  const amount = Number(transaction?.amount || 0);
  const type = normalizeTransactionType(transaction?.type);
  const dateLabel = transaction?.date || formatDateOnly(transaction?.timestamp) || '-';
  const timeLabel = transaction?.time || formatTime(transaction?.timestamp) || '--:--';

  return {
    type,
    amount: Number.isFinite(amount) ? amount : 0,
    category: transaction?.category || 'other',
    description: transaction?.description || transaction?.note || 'Transaksi',
    dateLabel,
    timeLabel,
  };
}

function normalizeTransactionType(value) {
  const type = String(value || '').toLowerCase();
  if (type.includes('income') || type.includes('pemasukan')) {
    return 'income';
  }
  return 'expense';
}

function formatCategoryLabel(category) {
  return CATEGORY_LABELS[String(category || 'other').toLowerCase()] || capitalize(String(category || 'other'));
}

function formatRichText(text) {
  const escaped = escapeHTML(String(text || ''));
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

function formatCurrency(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatTime(timestamp) {
  const date = timestamp ? new Date(timestamp) : new Date();
  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }

  return date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateTime(timestamp) {
  const date = timestamp ? new Date(timestamp) : new Date();
  if (Number.isNaN(date.getTime())) {
    return 'Baru saja';
  }

  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateOnly(timestamp) {
  const date = timestamp ? new Date(timestamp) : new Date();
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function createMessageRecord(role, text, extra = {}) {
  return {
    id: createId(),
    role,
    text,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

function normalizeChatRecord(record) {
  if (!record || typeof record !== 'object' || !record.text) {
    return null;
  }

  return {
    id: record.id || createId(),
    role: record.role === 'system' ? 'system' : record.role === 'user' ? 'user' : 'bot',
    text: String(record.text),
    timestamp: record.timestamp || new Date().toISOString(),
    data: record.data || null,
  };
}

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeView(view) {
  return view === 'recap' ? 'recap' : 'chat';
}

function isRecapCommand(message) {
  return String(message || '').trim().toLowerCase() === '#recap';
}

function setComposerDisabled(disabled) {
  dom.messageInput.disabled = disabled;
  dom.sendBtn.disabled = disabled;
}

function setRecapStatus(text) {
  dom.recapSourceBadge.textContent = text;
}

function setRecapError(message) {
  dom.recapUpdatedAt.textContent = 'Gagal memuat';
  dom.recapSourceBadge.textContent = 'Error';
  dom.totalIncome.textContent = formatCurrency(0);
  dom.totalExpense.textContent = formatCurrency(0);
  dom.totalBalance.textContent = formatCurrency(0);
  dom.transactionCount.textContent = '0';
  dom.transactionsMeta.textContent = '0 item';
  dom.transactionsList.innerHTML = `<div class="empty-state">${escapeHTML(message)}</div>`;
  destroyRecapChart();
  dom.recapChart.classList.add('is-hidden');
  dom.chartEmptyState.classList.remove('is-hidden');
  dom.chartEmptyState.textContent = message;
}

function scrollChatToBottom() {
  dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
}

function scrollToTopOfRecap() {
  const recapSection = document.getElementById('recapView');
  if (recapSection) {
    recapSection.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
}

function focusComposer() {
  window.requestAnimationFrame(() => {
    dom.messageInput.focus();
  });
}

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    // Ignore storage quota issues.
  }
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function capitalize(value) {
  const text = String(value || '');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
