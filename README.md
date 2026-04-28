# 💰 Budget Tracker Chat

Personal Finance Tracker yang **super simple** - hanya HTML/CSS/JS + Google Sheets.

## ⚡ Quick Overview

**Cara kerja:**
1. Type di chat interface (HTML)
2. JavaScript kirim ke Google Apps Script
3. Apps Script call GitHub Models AI untuk parsing
4. AI ekstrak: type (income/expense), nominal, kategori, deskripsi
5. Simpan otomatis ke Google Sheets
6. Tampilkan konfirmasi di chat

**Tech Stack:**
- Frontend: HTML/CSS/JavaScript vanilla
- Backend: Google Apps Script (gratis)
- AI: GitHub Models (gratis)
- Database: Google Sheets (gratis)
- Hosting: GitHub Pages (gratis)

---

## 🎯 Setup (10 menit)

### Step 1️⃣: Siapkan GitHub Token (2 menit)

1. Go to: https://github.com/settings/tokens
2. Click **Generate new token** → **Generate new token (classic)**
3. Name: `Budget Tracker`
4. Scope: pilih `repo`, `read:user`
5. Click **Generate token** dan **copy token** (save di notepad)

Token contoh: `ghu_16C7e42F...`

### Step 2️⃣: Setup Google Sheets (3 menit)

**Buat Google Sheet baru:**
1. Go to https://sheets.google.com
2. Click **+ Blank** → beri nama "Budget Tracker"
3. Di **Row 1**, buat header:

| A | B | C | D | E | F |
|---|---|---|---|---|---|
| Tanggal | Waktu | Tipe | Nominal | Kategori | Keterangan |

4. **Copy Sheet ID** dari URL:
   - URL: `https://docs.google.com/spreadsheets/d/SHEET_ID_INI/edit`
   - Copy bagian `SHEET_ID_INI`

### Step 3️⃣: Setup Google Apps Script (3 menit)

**Buat Apps Script baru:**

1. Go to https://script.google.com
2. Click **New project**
3. Name project: `Budget Tracker`
4. Copy semua kode dari **`apps-script.js`** (file di repo ini)
5. Paste ke editor Apps Script
6. **Update 3 konfigurasi:**

```javascript
const SHEET_ID = 'PASTE_SHEET_ID_DARI_STEP_2';
const SHEET_NAME = 'Transaksi'; // Atau nama sheet Anda
const GITHUB_TOKEN = 'ghu_PASTE_GITHUB_TOKEN_DARI_STEP_1';
```

**Deploy sebagai Web App:**
1. Click **Deploy** (icon rocket ⚡ di toolbar)
2. Select **New deployment**
3. Type: **Web app**
4. Execute as: akun Gmail Anda
5. Who has access: **Anyone**
6. Click **Deploy**
7. **Copy URL** yang diberikan (penting!)

Contoh URL: `https://script.google.com/macros/d/1xxx.../usercontent`

### Step 4️⃣: Setup Frontend (2 menit)

1. Open file `script.js` di editor
2. Cari baris: `const APPS_SCRIPT_URL = '';`
3. Paste URL dari Step 3:

```javascript
const APPS_SCRIPT_URL = 'https://script.google.com/macros/d/1xxx.../usercontent';
```

4. Save file

### Step 5️⃣: Push ke GitHub & Deploy ke GitHub Pages (Optional, 2 menit)

```bash
# Di folder Budget Tracker
git init
git add .
git commit -m "Initial: Budget Tracker Chat"
git remote add origin https://github.com/YOUR_USERNAME/budget-tracker-chat.git
git branch -M main
git push -u origin main
```

Enable GitHub Pages:
1. Go to repo → **Settings** → **Pages**
2. Branch: `main` → Save
3. Wait 1 menit
4. Akses di: `https://YOUR_USERNAME.github.io/budget-tracker-chat/`

---

## 💬 Penggunaan

### Format Transaksi

**Pengeluaran (Expense):**
```
"beli makan 50rb"
"bayar gojek 15k"
"listrik 200rb"
"netflix 54rb"
```

**Pemasukan (Income):**
```
"gajian 5 juta"
"bonus 2 juta"
"jual barang 500rb"
```

**Commands:**
```
"#recap" - Lihat ringkasan bulan ini
"#summary" - Alias untuk recap
```

### Respons AI

AI akan parse dan respond seperti ini:

```
✅ Transaksi Tersimpan

📤 Pengeluaran
Rp50.000
Kategori: food
Keterangan: beli makan

💾 Tersimpan:
📤 Pengeluaran
Nominal: Rp50.000
Kategori: food
Keterangan: beli makan
```

---

## 🏗️ Project Structure

```
budget-tracker-chat/
├── index.html          # Chat interface (UI)
├── style.css           # Styling
├── script.js           # Frontend logic
├── apps-script.js      # Google Apps Script code (copy ke Google)
├── README.md           # Setup guide
└── .gitignore
```

**File sizes:**
- `index.html` - ~2KB
- `style.css` - ~7KB
- `script.js` - ~4KB
- **Total**: ~13KB (super lightweight!)

---

## 📊 Data Flow

```
User Input
    ↓
JavaScript (script.js)
    ↓
fetch() ke Google Apps Script URL
    ↓
Google Apps Script (apps-script.js)
    ├─ Parse dengan GitHub Models API
    ├─ Save ke Google Sheets
    └─ Return JSON response
    ↓
JavaScript tampilkan response
    ↓
User lihat chat message + konfirmasi
```

---

## ✅ Checklist Testing

Setelah setup selesai, test dengan:

- [ ] Buka `index.html` di browser (bisa local atau GitHub Pages)
- [ ] Type: `"beli pentol 7000"`
- [ ] Tunggu response
- [ ] Cek Google Sheet - harusnya ada baris baru
- [ ] Type: `"gajian 5 juta"`
- [ ] Type: `"#recap"` - lihat summary

Jika semua berjalan ✅, setup Anda sukses!

---

## 🔧 Troubleshooting

### ❌ "Koneksi gagal"
**Solusi:**
- Check `APPS_SCRIPT_URL` di `script.js` sudah benar
- Check Apps Script sudah di-deploy sebagai Web App
- Check Who has access: **Anyone**
- Try refresh page

### ❌ "AI tidak bisa parse pesan"
**Solusi:**
- Coba format yang lebih spesifik: `"beli makan 50rb"` vs `"habis keluar duit"`
- Pastikan ada nominal dan kategori yang jelas
- Check `GITHUB_TOKEN` sudah benar

### ❌ "Transaksi tidak tersimpan ke Sheets"
**Solusi:**
- Check `SHEET_ID` benar di `apps-script.js`
- Check `SHEET_NAME` sesuai nama sheet di Google
- Check header row (Tanggal, Waktu, Tipe, Nominal, Kategori, Keterangan)
- Check service account punya akses edit (atau jika manual, pastikan tidak error)

### ❌ "GitHub Models API error"
**Solusi:**
- Check `GITHUB_TOKEN` valid (belum expired)
- Token harus punya scope: `repo`, `read:user`
- Check token tidak pernah di-share ke publik
- Jika error tetap, generate token baru

---

## 📱 Mobile Access

Aplikasi sudah mobile-friendly! Bisa:
1. Buka dari HP: `https://YOUR_USERNAME.github.io/budget-tracker-chat/`
2. Add to home screen (PWA)
3. Pakai seperti app native

---

## 🔒 Security & Privacy

✅ **Aman karena:**
- Data hanya tersimpan di Google Sheets milik Anda
- GitHub token disimpan di Apps Script (server-side, aman)
- Frontend hanya HTML/CSS/JS (tidak ada secrets terekspos)
- No third-party API yang tahu data Anda

⚠️ **Yang harus dijaga:**
- Jangan share GitHub token ke publik
- Jangan hard-code token di `script.js` (sudah aman di Apps Script)
- Jika token bocor, regenerate dari GitHub

---

## 🎨 Customization

### Ubah Warna
Edit `style.css`:
```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
/* Ubah ke warna favorit Anda */
```

### Ubah Kategori
Edit `apps-script.js`, di `SYSTEM_PROMPT`, update list kategori:
```javascript
- food: makanan, minum, jajan
- transport: gojek, bensin, parkir
- utilities: listrik, air, internet, pulsa
```

### Ubah Sheet Name
Edit `apps-script.js`:
```javascript
const SHEET_NAME = 'Transaksi'; // Ubah ke nama sheet Anda
```

---

## 📈 Future Ideas (Optional)

Jika ingin add fitur:
- [ ] Analytics dashboard (chart income vs expense)
- [ ] Export to CSV
- [ ] Budget goals per kategori
- [ ] Dark mode toggle
- [ ] Multi-language support

---

## 📚 Files Reference

| File | Size | Purpose |
|------|------|---------|
| `index.html` | 2KB | Chat UI |
| `style.css` | 7KB | Styling |
| `script.js` | 4KB | Frontend logic |
| `apps-script.js` | 7KB | Backend (Apps Script) |
| `README.md` | - | Setup guide |
| `.gitignore` | - | Git config |

---

## 💡 Tips

1. **Test parsing dulu** - buka Apps Script editor, run function `testParsing()`
2. **Monitor AI responses** - buka browser console (F12) untuk lihat requests
3. **Backup data** - download Google Sheet as CSV secara berkala
4. **Keep token aman** - jangan share atau commit ke public repo

---

## 🚀 Next Steps

1. ✅ Follow setup di atas (10 menit)
2. ✅ Test transaksi pertama Anda
3. ✅ Check Google Sheet - data tersimpan?
4. ✅ Deploy ke GitHub Pages (optional)
5. ✅ Share link ke teman (jika public repo)

---

## 📞 Need Help?

- Check troubleshooting section di atas
- Check Apps Script console untuk error logs
- Check browser console (F12) untuk JavaScript errors
- Re-check semua konfigurasi di Step 1-5

---

**Selamat! Aplikasi Budget Tracker Anda siap digunakan! 🎉**

Semoga membantu mencatat pengeluaran lebih mudah dan efisien. Happy budgeting! 💰

---

*Made with ❤️ for personal finance tracking*
