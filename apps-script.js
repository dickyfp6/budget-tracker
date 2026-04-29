/**
 * Google Apps Script - Budget Tracker Backend
 * 
 * Setup:
 * 1. Buat Google Sheet baru untuk menyimpan transaksi
 * 2. Buat Google Apps Script baru di menu Extensions → Apps Script
 * 3. Copy code ini ke file baru di Apps Script
 * 4. Set SHEET_ID, GITHUB_TOKEN di PropertiesService
 * 5. Deploy → New Deployment → Web App
 * 6. Copy URL dan paste ke script.js (APPS_SCRIPT_URL)
 */

// ============= KONFIGURASI =============
const SHEET_ID = '14lUmzOf7_3iDMSCuCNgXRMaSy8HqZ3nCYPG5SJmkYME';
const SHEET_NAME = 'Transaksi';

// Get token dari PropertiesService (lebih aman, tidak hardcode di code)
const GITHUB_TOKEN = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');

// ============= ENTRY POINT =============
function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'recap') {
    return ContentService.createTextOutput(
      JSON.stringify(getRecapPayload())
    ).setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput('✅ Budget Tracker Backend is running').setMimeType(ContentService.MimeType.TEXT);
}

// ============= MAIN HANDLER =============
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const message = data.message || '';

    if (data.action === 'recap') {
      return ContentService.createTextOutput(
        JSON.stringify(getRecapPayload())
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // Cek jika #recap command
    if (message.toLowerCase().includes('#recap')) {
      return ContentService.createTextOutput(
        JSON.stringify(getRecapPayload())
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // Parse transaksi dengan GitHub Models
    const parsed = parseWithGitHub(message);

    if (!parsed.success) {
      return ContentService.createTextOutput(
        JSON.stringify({
          success: false,
          error: parsed.error ||
            '❓ Maaf, saya tidak bisa memahami transaksi Anda. Coba format seperti: "beli pentol 7000", "gajian 5 juta", atau "bayar listrik 200k".',
        })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    const transactions = Array.isArray(parsed.data) ? parsed.data : [parsed.data];

    // Simpan ke Google Sheets
    saveTransactions(transactions);

    // Format response
    const response = formatTransactionResponse(transactions);

    return ContentService.createTextOutput(
      JSON.stringify({
        success: true,
        response: response,
        data: transactions.length === 1 ? transactions[0] : transactions,
      })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log('Error: ' + error);
    return ContentService.createTextOutput(
      JSON.stringify({
        success: false,
        error: 'Terjadi kesalahan: ' + error.toString(),
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============= GITHUB MODELS PARSING =============
function parseWithGitHub(message) {
  try {
    const localParsed = parseTransactionLocally(message);
    if (localParsed.success) {
      return { success: true, data: localParsed.data };
    }

    if (!GITHUB_TOKEN) {
      Logger.log('ERROR: GITHUB_TOKEN tidak diset di PropertiesService');
      return {
        success: false,
        error: 'Token GitHub tidak dikonfigurasi',
      };
    }

    const SYSTEM_PROMPT = `Anda adalah assistant keuangan yang ahli dalam parsing transaksi finansial berbahasa Indonesia.

TASK: Parse pesan user dan ekstrak informasi transaksi ke dalam format JSON.

INSTRUKSI:
1. Jika pesan adalah transaksi, extract ke JSON:
{
  "type": "expense" atau "income",
  "amount": number (nominal dalam Rupiah, integer saja),
  "category": "string" (pilih dari: food, transport, utilities, salary, transfer, shopping, entertainment, health, other),
  "description": "string"
}

2. Jika bukan transaksi atau tidak jelas:
{
  "success": false,
  "message": "Pesan bukan transaksi"
}

3. JANGAN tambah teks lain, hanya JSON!

PARSING RULES:
- "rb" atau "k" = ribu (1000)
- "juta" = 1.000.000
- Contoh: "7rb" = 7000, "2.5 juta" = 2500000

KATEGORI:
- food: makanan, minum, jajan
- transport: gojek, bensin, parkir
- utilities: listrik, air, internet, pulsa
- salary: gajian, bonus, insentif
- transfer: transfer uang, top up
- shopping: belanja barang
- entertainment: netflix, game, bioskop
- health: dokter, obat
- other: lainnya

CONTOH:
Input: "beli pentol 7000"
Output: {"type": "expense", "amount": 7000, "category": "food", "description": "pentol"}

Input: "gajian 5 juta"
Output: {"type": "income", "amount": 5000000, "category": "salary", "description": "gajian"}`;

    const payload = {
      model: 'mistralai/mistral-7b-instruct',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: message },
      ],
      temperature: 0.3,
      top_p: 0.9,
      max_tokens: 150,
    };

    const options = {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GITHUB_TOKEN}`,
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(
      'https://models.inference.ai.azure.com/chat/completions',
      options
    );

    if (response.getResponseCode() !== 200) {
      Logger.log('GitHub API Error: ' + response.getContentText());
      return {
        success: false,
        error: 'GitHub Models API error',
      };
    }

    const result = JSON.parse(response.getContentText());
    const aiResponse = result.choices[0].message.content.trim();

    // Parse JSON dari response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: 'Cannot parse response' };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validasi
    if (parsed.success === false) {
      return { success: false };
    }

    if (!parsed.type || !parsed.amount || !parsed.category || !parsed.description) {
      return { success: false };
    }

    if (!['income', 'expense'].includes(parsed.type)) {
      return { success: false };
    }

    if (parsed.amount <= 0) {
      return { success: false };
    }

    return {
      success: true,
      data: {
        type: parsed.type,
        amount: parseInt(parsed.amount),
        category: parsed.category,
        description: parsed.description,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    Logger.log('Parse error: ' + error);
    return {
      success: false,
      error: error.toString(),
    };
  }
}

function parseTransactionLocally(message) {
  const clauses = splitTransactionClauses(message);
  const parsedTransactions = [];

  for (const clause of clauses) {
    const parsed = parseSingleTransactionClause(clause);
    if (parsed.success) {
      parsedTransactions.push(parsed.data);
    }
  }

  if (!parsedTransactions.length) {
    return { success: false };
  }

  return {
    success: true,
    data: parsedTransactions.length === 1 ? parsedTransactions[0] : parsedTransactions,
  };
}

function parseSingleTransactionClause(clause) {
  const normalized = clause.toLowerCase().trim();
  const amountEntries = extractMoneyValues(normalized);

  if (!amountEntries.length) {
    return { success: false };
  }

  const amount = amountEntries[0].amount;

  if (!amount || Number.isNaN(amount) || amount <= 0) {
    return { success: false };
  }

  let type = 'expense';
  if (/\b(gaji|gajian|bonus|insentif|salary|transfer masuk|masuk)\b/i.test(normalized)) {
    type = 'income';
  }

  const category = detectCategory(normalized, 1);
  const description = normalized
    .replace(/\b(gaji|gajian|bonus|insentif|salary|transfer masuk|masuk|beli|bayar|jajan|top up|topup|terus|lalu|kemudian|trus|sama|plus|dan)\b/i, '')
    .replace(/\b\d+[\d.,]*\s*(rb|ribu|k|jt|juta)?\b/i, '')
    .replace(/\s+/g, ' ')
    .trim() || normalized;

  return {
    success: true,
    data: {
      type,
      amount,
      category,
      description,
      timestamp: new Date().toISOString(),
      items: amountEntries,
    },
  };
}

function splitTransactionClauses(message) {
  const normalized = String(message || '').replace(/\s+/g, ' ').trim();
  const parts = normalized
    .split(/\b(?:terus|lalu|kemudian|trus|sama|plus|dan)\b|[;•\n]+/i)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length ? parts : [normalized];
}

function extractMoneyValues(message) {
  const pattern = /(\d+(?:[.,]\d+)?)(?:\s*(rb|ribu|k|jt|juta))?/gi;
  const entries = [];
  let match;

  while ((match = pattern.exec(message)) !== null) {
    const valueText = match[1];
    const unitText = (match[2] || '').toLowerCase();
    const amount = normalizeMoneyValue(valueText, unitText);

    if (amount > 0) {
      entries.push({ amount, raw: match[0].trim() });
    }
  }

  return entries;
}

function normalizeMoneyValue(valueText, unitText) {
  const normalizedValue = valueText.replace(/[.]/g, '').replace(',', '.');
  const numericValue = Number(normalizedValue);

  if (Number.isNaN(numericValue) || numericValue <= 0) {
    return 0;
  }

  const digitsOnly = valueText.replace(/\D/g, '');
  const hasUnit = Boolean(unitText);

  if (!hasUnit && digitsOnly.length < 4 && !/[.,]/.test(valueText)) {
    return 0;
  }

  let amount = numericValue;
  if (unitText === 'rb' || unitText === 'ribu' || unitText === 'k') {
    amount *= 1000;
  } else if (unitText === 'jt' || unitText === 'juta') {
    amount *= 1000000;
  }

  return Math.round(amount);
}

function detectCategory(message, itemCount) {
  const categories = [
    { key: 'salary', patterns: [/\b(gaji|gajian|bonus|insentif)\b/i] },
    { key: 'utilities', patterns: [/\b(listrik|air|internet|pulsa)\b/i] },
    { key: 'transport', patterns: [/\b(gojek|grab|transport|bensin|parkir)\b/i] },
    { key: 'food', patterns: [/\b(makan|minum|pentol|nasi|ayam|kopi|jajan)\b/i] },
    { key: 'shopping', patterns: [/\b(belanja|beli|shopping)\b/i] },
    { key: 'entertainment', patterns: [/\b(netflix|game|bioskop|film|konser)\b/i] },
    { key: 'health', patterns: [/\b(dokter|obat|rumah sakit|rs|vitamin)\b/i] },
    { key: 'transfer', patterns: [/\b(transfer|top up|topup)\b/i] },
  ];

  const matchedCategories = categories
    .filter((entry) => entry.patterns.some((pattern) => pattern.test(message)))
    .map((entry) => entry.key);

  if (itemCount > 1 && matchedCategories.length > 1) {
    return 'other';
  }

  return matchedCategories[0] || 'other';
}

function saveTransactions(transactions) {
  transactions.forEach((transactionData) => saveTransaction(transactionData));
}

function formatTransactionResponse(transactions) {
  if (!transactions.length) {
    return '✅ **Dicatat**';
  }

  const totalAmount = transactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  const header = transactions.length === 1
    ? '✅ **Dicatat**'
    : `✅ **${transactions.length} Transaksi Dicatat**`;

  const lines = transactions.map((transaction, index) => {
    const typeLabel = transaction.type === 'income' ? '📥 Pemasukan' : '📤 Pengeluaran';
    const amount = `Rp${formatNumber(transaction.amount)}`;
    const label = transactions.length > 1 ? `${index + 1}. ` : '';
    return `${label}${typeLabel} - ${amount} - ${transaction.description}`;
  });

  return `${header}\n\n${lines.join('\n')}\n\nTotal: Rp${formatNumber(totalAmount)}`;
}

// ============= GOOGLE SHEETS FUNCTIONS =============
function saveTransaction(transactionData) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);

  const now = new Date();
  const date = Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  const time = Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm:ss');
  const type = transactionData.type === 'income' ? 'Pemasukan' : 'Pengeluaran';

  const row = [
    date,
    time,
    type,
    transactionData.amount,
    transactionData.category,
    transactionData.description,
  ];

  sheet.appendRow(row);
}

function getSummary() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();

  let totalIncome = 0;
  let totalExpense = 0;

  // Skip header row (row 0)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const type = row[2]; // Column C: Tipe
    const amount = row[3] || 0; // Column D: Nominal

    if (type === 'Pemasukan') {
      totalIncome += amount;
    } else if (type === 'Pengeluaran') {
      totalExpense += amount;
    }
  }

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    transactionCount: data.length - 1,
  };
}

function getTransactions() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();

  const transactions = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 6) {
      continue;
    }

    transactions.push({
      date: row[0] || '',
      time: row[1] || '',
      type: row[2] || 'Pengeluaran',
      amount: Number(row[3] || 0),
      category: row[4] || 'other',
      description: row[5] || '',
    });
  }

  return transactions;
}

function getRecapPayload() {
  const summary = getSummary();
  const transactions = getTransactions();

  return {
    success: true,
    transactions: transactions,
    summary: summary,
    updatedAt: new Date().toISOString(),
  };
}

// ============= UTILITY FUNCTIONS =============
function formatNumber(num) {
  return new Intl.NumberFormat('id-ID').format(num);
}

function formatSummaryResponse(summary) {
  return `📊 **Ringkasan Keuangan Bulan Ini**\n\n💰 Pemasukan: Rp${formatNumber(
    summary.totalIncome
  )}\n💸 Pengeluaran: Rp${formatNumber(
    summary.totalExpense
  )}\n📈 Saldo: Rp${formatNumber(summary.balance)}`;
}

// ============= TESTING (bisa dijalankan dari Editor) =============
function testParsing() {
  const result = parseWithGitHub('beli pentol 7000');
  Logger.log('Test Result: ' + JSON.stringify(result));
}