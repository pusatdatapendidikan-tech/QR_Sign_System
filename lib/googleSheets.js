import { google } from 'googleapis';
import { CONFIG, HEADERS, DEFAULT_DIVISI, DEFAULT_JABATAN, DEFAULT_SIGNERS, DEFAULT_JENIS_SURAT, DEFAULT_DEPARTEMEN_IM } from './config';
import { generateId } from './utils';

let sheetsClient = null;
globalThis.sheetsInitialized = globalThis.sheetsInitialized || false;

export function getAuth() { // <--- TAMBAHKAN EXPORT
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  let key = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !key) {
    throw new Error('GOOGLE_CLIENT_EMAIL atau GOOGLE_PRIVATE_KEY belum diset di .env.local');
  }
  // Handle escaped newlines
  key = key.replace(/\\n/g, '\n');
  return new google.auth.JWT(email, null, key, [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/documents' // <--- TAMBAHKAN SCOPE INI
  ]);
}

export function getSheets() {
  if (!sheetsClient) {
    sheetsClient = google.sheets({ version: 'v4', auth: getAuth() });
  }
  return sheetsClient;
}

export function getSpreadsheetId() {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error('GOOGLE_SHEET_ID belum diset');
  return id;
}

/* ===== Auto-init sheets & headers ===== */
export async function ensureSheets() {
  if (globalThis.sheetsInitialized) return;
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTitles = meta.data.sheets.map(s => s.properties.title);

  const requests = [];
  const sheetsToCreate = Object.values(CONFIG.SHEETS).filter(t => !existingTitles.includes(t));

  if (sheetsToCreate.length > 0) {
    requests.push({
      addSheet: {
        properties: {},
      },
    });
    // Add sheets one by one
    for (const title of sheetsToCreate) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title } } }] },
      });
    }
  }

  // Set headers
  for (const [key, title] of Object.entries(CONFIG.SHEETS)) {
    const headerKey = title === 'signers' ? 'signers' : title;
    const headers = HEADERS[headerKey] || HEADERS[title];
    if (!headers) continue;
    
    // Check if header already exists
    const range = `${title}!A1:Z1`;
    try {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
      const currentHeader = res.data.values?.[0] || [];
      // Ubah kondisi: Update header jika kosong, header awal beda, ATAU jumlah kolom header kurang dari config
      if (currentHeader.length === 0 || currentHeader[0] !== headers[0] || currentHeader.length < headers.length) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${title}!A1`,
          valueInputOption: 'RAW',
          requestBody: { values: [headers] },
        });
        // Bold + blue background
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{
              repeatCell: {
                range: { sheetId: meta.data.sheets.find(s => s.properties.title === title)?.properties.sheetId, startRowIndex: 0, endRowIndex: 1 },
                cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.114, green: 0.306, blue: 0.847 } } },
                fields: 'userEnteredFormat(textFormat,backgroundColor)',
              },
            }],
          },
        });
      }
    } catch (e) {
      // Sheet might not have data yet, just write headers
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${title}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [headers] },
      });
    }
  }

  // Seed default data
  await seedDefaultData();

  // Seed admin user if not exists
  const usersData = await readSheet(CONFIG.SHEETS.USERS);
  if (usersData.length <= 1) {
    const hasAdmin = usersData.some(r => r[1] === 'admin');
    if (!hasAdmin) {
      await appendRow(CONFIG.SHEETS.USERS, [
        generateId(), 'admin', 'admin123', 'Administrator', 'admin',
        'admin@perusahaan.com', new Date().toISOString(), '', '-', '-', 'active', '',
      ]);
    }
  }

  globalThis.sheetsInitialized = true;
}

async function seedDefaultData() {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();

  // Divisi
  let data = await readSheet(CONFIG.SHEETS.DIVISI);
  if (data.length <= 1) {
    for (const d of DEFAULT_DIVISI) {
      await appendRow(CONFIG.SHEETS.DIVISI, [d]);
    }
  }

  // Jabatan
  data = await readSheet(CONFIG.SHEETS.JABATAN);
  if (data.length <= 1) {
    for (const j of DEFAULT_JABATAN) {
      await appendRow(CONFIG.SHEETS.JABATAN, [j]);
    }
  }

  // Signers
  data = await readSheet(CONFIG.SHEETS.SIGNERS);
  if (data.length <= 1) {
    for (const s of DEFAULT_SIGNERS) {
      await appendRow(CONFIG.SHEETS.SIGNERS, [s.jabatan, s.nama, s.email]);
    }
  }

  // Jenis Surat
  data = await readSheet(CONFIG.SHEETS.JENIS_SURAT);
  if (data.length <= 1) {
    for (const j of DEFAULT_JENIS_SURAT) {
      await appendRow(CONFIG.SHEETS.JENIS_SURAT, [j.nama, j.format]);
    }
  }

  // Departemen IM
  data = await readSheet(CONFIG.SHEETS.DEPARTEMEN_IM);
  if (data.length <= 1) {
    for (const d of DEFAULT_DEPARTEMEN_IM) {
      await appendRow(CONFIG.SHEETS.DEPARTEMEN_IM, [d.nama, d.kode]);
    }
  }
}

const sheetCache = new Map();

export async function readSheet(sheetName, useCache = true) {
  const now = Date.now();
  const cacheKey = sheetName;
  
  // UBAH DARI 300000 (5 MENIT) MENJADI 60000 (1 MENIT)
  if (useCache && sheetCache.has(cacheKey)) {
    const { time, data } = sheetCache.get(cacheKey);
    if (now - time < 60000) return data; // <-- GANTI ANGKA INI MENJADI 60000
  }

  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
  });
  const data = res.data.values || [];
  sheetCache.set(cacheKey, { time: now, data });
  return data;
}

export async function batchGetSheets(sheetNames) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: sheetNames.map(name => `${name}!A:Z`),
  });
  const result = {};
  res.data.valueRanges.forEach((vr, i) => {
    result[sheetNames[i]] = vr.values || [];
  });
  return result;
}

// Tambahkan fungsi untuk menghapus cache saat ada data baru
export function clearSheetCache(sheetName) {
  if (sheetName) sheetCache.delete(sheetName);
  else sheetCache.clear();
}

export async function appendRow(sheetName, row) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:A`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
  return res.data;
}

export async function updateCell(sheetName, rowIndex, colIndex, value) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const col = String.fromCharCode(65 + colIndex - 1);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!${col}${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[value]] },
  });
}

export async function deleteRow(sheetName, rowIndex) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = meta.data.sheets.find(s => s.properties.title === sheetName);
  if (!sheet) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: { sheetId: sheet.properties.sheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex },
        },
      }],
    },
  });
}

// Tambahkan import utils di paling atas file lib/googleSheets.js jika belum ada
import { generateDocumentNumber } from './utils';

async function getJenisSurat() {
  const data = await readSheet(CONFIG.SHEETS.JENIS_SURAT);
  const list = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) list.push({ nama: data[i][0].trim(), format: (data[i][1] || '').trim() });
  }
  return list;
}

async function getDepartemenIM() {
  const data = await readSheet(CONFIG.SHEETS.DEPARTEMEN_IM);
  const list = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) list.push({ nama: data[i][0].trim(), kode: (data[i][1] || '').trim() });
  }
  return list;
}

export async function generateDocNumber(docType, departemen) {
  // OPTIMASI: Gunakan batchGetSheets agar 3 sheet dibaca dalam 1 request API
  const ranges = [CONFIG.SHEETS.JENIS_SURAT, CONFIG.SHEETS.DEPARTEMEN_IM, CONFIG.SHEETS.NOMOR_SURAT];
  const sheetsData = await batchGetSheets(ranges);
  
  const jenisSuratData = sheetsData[CONFIG.SHEETS.JENIS_SURAT];
  const departemenIMData = sheetsData[CONFIG.SHEETS.DEPARTEMEN_IM];
  const nomorData = sheetsData[CONFIG.SHEETS.NOMOR_SURAT];

  const jenisSurat = [];
  for (let i = 1; i < jenisSuratData.length; i++) if(jenisSuratData[i][0]) jenisSurat.push({ nama: jenisSuratData[i][0].trim(), format: (jenisSuratData[i][1] || '').trim() });
  
  const departemenIM = [];
  for (let i = 1; i < departemenIMData.length; i++) if(departemenIMData[i][0]) departemenIM.push({ nama: departemenIMData[i][0].trim(), kode: (departemenIMData[i][1] || '').trim() });

  const found = jenisSurat.find(j => j.nama === docType);
  let prefix = found?.format || '';
  
  if (docType === 'Internal Memo/IM' && departemen) {
    const dep = departemenIM.find(d => d.nama === departemen);
    if (!dep || !dep.kode) return '-';
    prefix = dep.kode + '/IM';
  }
  if (!prefix) return '-';
  
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const counterKey = departemen ? `${docType} - ${departemen}` : docType;
  
  let maxNum = 0;
  let currentMonthRow = -1;
  
  for (let i = 1; i < nomorData.length; i++) {
    if (nomorData[i][0] === counterKey && parseInt(nomorData[i][2]) === year) {
      const currentNum = parseInt(nomorData[i][3]) || 0;
      if (currentNum > maxNum) maxNum = currentNum;
      if (parseInt(nomorData[i][1]) === month) currentMonthRow = i + 1;
    }
  }
  
  const nextNum = maxNum + 1;
  
  if (currentMonthRow > 0) {
    await updateCell(CONFIG.SHEETS.NOMOR_SURAT, currentMonthRow, 4, nextNum);
  } else {
    await appendRow(CONFIG.SHEETS.NOMOR_SURAT, [counterKey, month, year, nextNum]);
  }
  
  return generateDocumentNumber(prefix, month, year, nextNum);
}

export async function generateBatchDocNumbers(docType, departemen, count) {
  if (count <= 0) return [];
  
  // Baca semua sheet yang dibutuhkan sekaligus (Hemat Kuota)
  const ranges = [CONFIG.SHEETS.JENIS_SURAT, CONFIG.SHEETS.DEPARTEMEN_IM, CONFIG.SHEETS.NOMOR_SURAT];
  const sheetsData = await batchGetSheets(ranges);
  
  const jenisSuratData = sheetsData[CONFIG.SHEETS.JENIS_SURAT];
  const departemenIMData = sheetsData[CONFIG.SHEETS.DEPARTEMEN_IM];
  const nomorData = sheetsData[CONFIG.SHEETS.NOMOR_SURAT];

  const jenisSurat = [];
  for (let i = 1; i < jenisSuratData.length; i++) if(jenisSuratData[i][0]) jenisSurat.push({ nama: jenisSuratData[i][0].trim(), format: (jenisSuratData[i][1] || '').trim() });
  
  const departemenIM = [];
  for (let i = 1; i < departemenIMData.length; i++) if(departemenIMData[i][0]) departemenIM.push({ nama: departemenIMData[i][0].trim(), kode: (departemenIMData[i][1] || '').trim() });

  const found = jenisSurat.find(j => j.nama === docType);
  let prefix = found?.format || '';
  
  if (docType === 'Internal Memo/IM' && departemen) {
    const dep = departemenIM.find(d => d.nama === departemen);
    if (!dep || !dep.kode) return Array(count).fill('-');
    prefix = dep.kode + '/IM';
  }
  if (!prefix) return Array(count).fill('-');
  
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const counterKey = departemen ? `${docType} - ${departemen}` : docType;
  
  let maxNum = 0;
  let currentMonthRow = -1;
  
  for (let i = 1; i < nomorData.length; i++) {
    if (nomorData[i][0] === counterKey && parseInt(nomorData[i][2]) === year) {
      const currentNum = parseInt(nomorData[i][3]) || 0;
      if (currentNum > maxNum) maxNum = currentNum;
      if (parseInt(nomorData[i][1]) === month) currentMonthRow = i + 1;
    }
  }

  // Generate array nomor surat berurutan
  const generatedNumbers = [];
  for (let i = 1; i <= count; i++) {
    const nextNum = maxNum + i;
    generatedNumbers.push(generateDocumentNumber(prefix, month, year, nextNum));
  }

  // Update counter di sheet HANYA SEKALI dengan nomor terakhir
  const finalMaxNum = maxNum + count;
  if (currentMonthRow > 0) {
    await updateCell(CONFIG.SHEETS.NOMOR_SURAT, currentMonthRow, 4, finalMaxNum);
  } else {
    await appendRow(CONFIG.SHEETS.NOMOR_SURAT, [counterKey, month, year, finalMaxNum]);
  }

  return generatedNumbers; // Mengembalikan array misal: ['001/I/2024', '002/I/2024']
}

export async function ensureDocTypeSheet(docType) {
  if (!docType || docType === '-') return;
  const safeName = docType.replace(/[\/\\:*?"<>|]/g, '-').trim();
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets.find(s => s.properties.title === safeName);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: safeName } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${safeName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS.DocType] },
    });
  }
  return safeName;
}