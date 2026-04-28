/**
 * Budget Tracker Chat - Frontend
 * Calls Google Apps Script for AI parsing & data storage
 */

// Configuration
const APPS_SCRIPT_URL = ''; // ANDA PERLU ISI INI dengan URL dari Google Apps Script

// DOM Elements
const chatBox = document.getElementById('chatBox');
const inputForm = document.getElementById('inputForm');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const summaryBox = document.getElementById('summaryBox');

// Send message
inputForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const message = messageInput.value.trim();
  if (!message) return;

  // Add user message to chat
  addMessage(message, 'user');
  messageInput.value = '';

  // Disable input while processing
  messageInput.disabled = true;
  sendBtn.disabled = true;

  try {
    // Show loading indicator
    addMessage('Sedang memproses...', 'ai', true);

    // Call Google Apps Script
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors', // Apps Script tidak support CORS, tapi ini fallback
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    // Jika menggunakan doPost endpoint
    const data = await response.json();

    // Remove loading message
    chatBox.removeChild(chatBox.lastChild);

    // Add AI response
    if (data.success) {
      addMessage(data.response, 'ai');

      // Show transaction data jika ada
      if (data.data) {
        displayTransactionData(data.data);
      }

      // Show summary jika ada
      if (data.summary) {
        displaySummary(data.summary);
      }
    } else {
      addMessage(`❌ Error: ${data.error}`, 'ai');
    }
  } catch (error) {
    console.error('Error:', error);
    // Remove loading message
    if (chatBox.lastChild.classList.contains('typing')) {
      chatBox.removeChild(chatBox.lastChild);
    }
    addMessage('❌ Koneksi gagal. Pastikan Apps Script URL sudah benar.', 'ai');
  } finally {
    messageInput.disabled = false;
    sendBtn.disabled = false;
    messageInput.focus();
  }
});

/**
 * Add message to chat
 */
function addMessage(text, type = 'ai', isLoading = false) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}`;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  if (isLoading) {
    bubble.className += ' typing';
  }
  bubble.innerHTML = text;

  const time = document.createElement('span');
  time.className = 'time';
  time.textContent = new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });

  messageDiv.appendChild(bubble);
  messageDiv.appendChild(time);
  chatBox.appendChild(messageDiv);

  // Auto scroll ke bottom
  chatBox.scrollTop = chatBox.scrollHeight;
}

/**
 * Display transaction data
 */
function displayTransactionData(data) {
  const lastBubble = chatBox.querySelector('.message:last-child .bubble');

  const dataBox = document.createElement('div');
  dataBox.className = 'data-box';

  const typeLabel =
    data.type === 'income' ? '📥 Pemasukan' : '📤 Pengeluaran';
  const amount = formatIDR(data.amount);

  dataBox.innerHTML = `
    <div><strong>💾 Tersimpan:</strong></div>
    <div>${typeLabel}</div>
    <div>Nominal: ${amount}</div>
    <div>Kategori: ${data.category}</div>
    <div>Keterangan: ${data.description}</div>
  `;

  lastBubble.appendChild(dataBox);
}

/**
 * Display summary
 */
function displaySummary(summary) {
  document.getElementById('totalIncome').textContent = formatIDR(
    summary.totalIncome
  );
  document.getElementById('totalExpense').textContent = formatIDR(
    summary.totalExpense
  );

  const balance = summary.totalIncome - summary.totalExpense;
  const balanceEl = document.getElementById('totalBalance');
  balanceEl.textContent = formatIDR(balance);
  balanceEl.className = balance >= 0 ? 'income' : 'expense';

  summaryBox.style.display = 'block';
}

/**
 * Format IDR
 */
function formatIDR(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}

// Focus input on load
messageInput.focus();

// Info: pastikan APPS_SCRIPT_URL sudah diset sebelum aplikasi bisa berfungsi
console.log('📝 TODO: Set APPS_SCRIPT_URL di script.js dengan URL dari Google Apps Script');
