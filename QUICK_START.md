# ⚡ QUICK START - Setup dalam 10 Menit!

## 🔴 Step 1: GitHub Token (2 menit)

```
1. https://github.com/settings/tokens
2. Generate new token (classic)
3. Scope: repo + read:user
4. Copy token → simpan di notepad
```

**Token:** `ghu_xxxxxxxxxxxx`

---

## 🟠 Step 2: Google Sheet (3 menit)

```
1. https://sheets.google.com → + Blank
2. Name: "Budget Tracker"
3. Row 1 header:
   Tanggal | Waktu | Tipe | Nominal | Kategori | Keterangan
4. Copy SHEET_ID dari URL:
   https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit
```

**Sheet ID:** `1xxxxx...`

---

## 🟡 Step 3: Google Apps Script (3 menit)

```
1. https://script.google.com → New project
2. Copy code dari apps-script.js (file di repo)
3. Paste ke editor
4. Update 3 baris:
   
   const SHEET_ID = '[PASTE_SHEET_ID]';
   const GITHUB_TOKEN = '[PASTE_GITHUB_TOKEN]';
   const SHEET_NAME = 'Transaksi';

5. Deploy → New deployment → Web app
   - Execute as: Anda
   - Who has access: Anyone
6. Copy URL dari notification
```

**Apps Script URL:** `https://script.google.com/macros/d/1xxx/.../usercontent`

---

## 🟢 Step 4: Update Frontend (2 menit)

```
1. Open script.js
2. Cari: const APPS_SCRIPT_URL = '';
3. Ganti jadi:
   const APPS_SCRIPT_URL = '[PASTE_APPS_SCRIPT_URL]';
4. Save
```

---

## 🔵 Step 5: Deploy ke GitHub (Optional, 2 menit)

```bash
cd "c:\Users\USERR\Documents\0. Magang\Budget Tracker"

git init
git add .
git commit -m "Initial: Budget Tracker"
git remote add origin https://github.com/YOUR_USERNAME/budget-tracker-chat.git
git branch -M main
git push -u origin main

# Enable Pages:
# Repo Settings → Pages → Branch: main → Save
# URL: https://YOUR_USERNAME.github.io/budget-tracker-chat/
```

---

## ✅ Test It!

```
1. Open index.html (lokal atau GitHub Pages)
2. Type: "beli pentol 7000"
3. Check response muncul
4. Check Google Sheet ada baris baru
5. Type: "#recap" 
6. Done! ✅
```

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| "Koneksi gagal" | Check APPS_SCRIPT_URL di script.js |
| "AI tidak parse" | Format: "kategori nominal" misal "beli 50rb" |
| "Sheets tidak save" | Check SHEET_ID & SHEET_NAME di apps-script.js |
| "GitHub API error" | Check token valid & not expired |

---

## 📁 File Structure

```
budget-tracker-chat/
├── index.html        ← Buka di browser
├── style.css         ← Styling
├── script.js         ← Update APPS_SCRIPT_URL di sini
├── apps-script.js    ← Copy ke Google Apps Script
└── README.md         ← Full documentation
```

---

## 🎯 Format Transaksi

| Type | Format | Contoh |
|------|--------|--------|
| Pengeluaran | "kategori nominal" | "beli makan 50rb" |
| Pemasukan | "pemasukan nominal" | "gajian 5 juta" |
| Ringkasan | "#recap" | "#recap" |

---

**📍 Lokasi file:** `c:\Users\USERR\Documents\0. Magang\Budget Tracker`

**✅ Setup time:** 10 menit max!

Tanya jika ada yang bingung 👍
