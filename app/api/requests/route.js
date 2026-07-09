import { NextResponse } from 'next/server';
import { ensureSheets, readSheet, appendRow, ensureDocTypeSheet, updateCell, clearSheetCache } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';
import { generateId, formatDate, generateDocumentNumber } from '@/lib/utils';
import { getSession } from '@/lib/auth';

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

async function generateDocNumber(docType, departemen) {
  const jenisSurat = await getJenisSurat();
  const found = jenisSurat.find(j => j.nama === docType);
  let prefix = found?.format || '';
  
  if (docType === 'Internal Memo/IM' && departemen) {
    const dept = await getDepartemenIM();
    const dep = dept.find(d => d.nama === departemen);
    if (!dep || !dep.kode) return '-';
    prefix = dep.kode + '/IM';
  }
  if (!prefix) return '-';
  
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const counterKey = departemen ? `${docType} - ${departemen}` : docType;
  
  const nomorData = await readSheet(CONFIG.SHEETS.NOMOR_SURAT, false);
  let maxNum = 0;
  let currentMonthRow = -1;
  
  // ✅ FIX: Cari nomor tertinggi di tahun yang sama, abaikan bulan
  for (let i = 1; i < nomorData.length; i++) {
    if (nomorData[i][0] === counterKey && parseInt(nomorData[i][2]) === year) {
      const currentNum = parseInt(nomorData[i][3]) || 0;
      if (currentNum > maxNum) {
        maxNum = currentNum;
      }
      
      // Cek juga apakah sudah ada record untuk bulan saat ini
      if (parseInt(nomorData[i][1]) === month) {
        currentMonthRow = i + 1; // Simpan baris bulan saat ini untuk di-update nanti
      }
    }
  }
  
  // Lanjutkan nomor dari yang tertinggi
  const nextNum = maxNum + 1;
  
  if (currentMonthRow > 0) {
    // Jika di bulan ini sudah ada barisnya, update counternya saja
    await updateCell(CONFIG.SHEETS.NOMOR_SURAT, currentMonthRow, 4, nextNum);
  } else {
    // Jika ini permintaan pertama di bulan baru, buat baris baru dengan counter lanjutan
    await appendRow(CONFIG.SHEETS.NOMOR_SURAT, [counterKey, month, year, nextNum]);
  }
  
  return generateDocumentNumber(prefix, month, year, nextNum);
}

export async function GET(req) {
  try {
    const session = await getSession();
    if (!session.user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    
    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role') || session.user.role;
    const userName = searchParams.get('userName') || session.user.username;
    const signerRole = searchParams.get('signerRole') || session.user.signerRole || '';
    
    const data = await readSheet(CONFIG.SHEETS.REQUESTS, false); // false = matikan server cache
    const requests = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i] || [];
      if (!row[0]) continue;
      
      const req = {
        id: row[0], requesterName: row[1], requesterUsername: row[2],
        division: row[3], position: row[4], requestType: row[5],
        documentType: row[6], documentNumber: row[7], perihal: row[8],
        targetSigner: row[9], fileUrl: row[10], fileName: row[11],
        status: row[12],
        approvedBy: row[13] || '-', approvedAt: row[14] ? formatDate(row[14]) : '-',
        rejectedBy: row[15] || '-', rejectedAt: row[16] ? formatDate(row[16]) : '-',
        rejectionReason: row[17] || '-', createdAt: formatDate(row[18]),
        forwardedBy: row[19] || '-', forwardedAt: row[20] ? formatDate(row[20]) : '-',
        readByRequester: row[21] === true || row[21] === 'true',
      };
      
      let include = false;
      if (role === 'admin') include = true;
      else if (role === 'atasan') include = (req.targetSigner === signerRole);
      else include = (req.requesterUsername === userName);
      
      if (include) requests.push(req);
    }
    
    requests.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return NextResponse.json({ success: true, data: requests });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await ensureSheets();
    const session = await getSession();
    if (!session.user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    
    const d = await req.json();
    const id = generateId();
    const docType = d.documentType || '-';
    const departemen = d.departemen || '';
    let docNumber = d.documentNumber || '-';
    
    if (docType && docType !== '-') {
      docNumber = await generateDocNumber(docType, departemen);
    }
    
    await appendRow(CONFIG.SHEETS.REQUESTS, [
      id, d.requesterName, d.requesterUsername, d.division, d.position,
      d.requestType, docType, docNumber, d.perihal || '-',
      d.targetSigner || '-', d.fileUrl || '-', d.fileName || '-',
      'Menunggu', '-', '-', '-', '-', '-', new Date().toISOString(), '-', '-', false,
    ]);
    
    if (docType && docType !== '-') {
      const safeName = await ensureDocTypeSheet(docType);
      const sheetData = await readSheet(safeName);
      const nextNo = sheetData.length;
      await appendRow(safeName, [
        nextNo, id, docNumber, d.requesterName || '-', d.division || '-',
        d.position || '-', d.requestType || '-', d.targetSigner || '-',
        departemen, 'Menunggu', new Date().toISOString(),
      ]);
    }
    
    // Bersihkan cache agar data baru langsung terbaca
    clearSheetCache(CONFIG.SHEETS.REQUESTS);
    clearSheetCache(CONFIG.SHEETS.NOMOR_SURAT);
    if (docType && docType !== '-') clearSheetCache(docType);
    
    return NextResponse.json({ success: true, message: 'Permintaan berhasil dikirim', id, documentNumber: docNumber });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}