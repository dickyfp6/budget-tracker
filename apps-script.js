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
function doGet() {
  return ContentService.createTextOutput('✅ Budget Tracker Backend is running').setMimeType(ContentService.MimeType.TEXT);
}

// ============= MAIN HANDLER =============
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const message = data.message;

    // Cek jika #recap command
    if (message.toLowerCase().includes('#recap')) {
      const summary = getSummary();
      return ContentService.createTextOutput(
        JSON.stringify({
          success: true,
          response: formatSummaryResponse(summary),
          summary: summary,
        })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // Parse transaksi dengan GitHub Models
    const parsed = parseWithGitHub(message);

    if (!parsed.success) {
      return ContentService.createTextOutput(
        JSON.stringify({
          success: true,
          response: `❓ Maaf, saya tidak bisa memahami transaksi Anda. Coba format seperti:\n• "beli pentol 7000"\n• "gajian 5 juta"\n• "bayar listrik 200k"`,
        })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // Simpan ke Google Sheets
    saveTransaction(parsed.data);

    // Format response
    const typeLabel =
      parsed.data.type === 'income' ? '📥 Pemasukan' : '📤 Pengeluaran';
    const response = `✅ **Transaksi Tersimpan**\n\n${typeLabel}\nRp${formatNumber(
      parsed.data.amount
    )}\nKategori: ${parsed.data.category}\nKeterangan: ${parsed.data.description}`;

    return ContentService.createTextOutput(
      JSON.stringify({
        success: true,
        response: response,
        data: parsed.data,
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