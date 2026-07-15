import { NextResponse } from 'next/server';
import { ensureSheets, readSheet, appendRow, ensureDocTypeSheet, updateCell, clearSheetCache } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';
import { generateId, formatDate, generateDocumentNumber, getWIBDate } from '@/lib/utils';
import { getSession } from '@/lib/auth';

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
    let docNumber = '-'; // <--- UBAH: Selalu '-' saat pengajuan
    
    // HAPUS BLOK IF INI:
    // if (docType && docType !== '-') {
    //   docNumber = await generateDocNumber(docType, departemen);
    // }
    
    await appendRow(CONFIG.SHEETS.REQUESTS, [
      id, d.requesterName, d.requesterUsername, d.division, d.position,
      d.requestType, docType, docNumber, d.perihal || '-',
      d.targetSigner || '-', d.fileUrl || '-', d.fileName || '-',
      'Menunggu', '-', '-', '-', '-', '-', getWIBDate(), '-', '-', false, departemen || '-', // <--- TAMBAHKAN departemen di akhir
    ]);
    
    if (docType && docType !== '-') {
      const safeName = await ensureDocTypeSheet(docType);
      const sheetData = await readSheet(safeName);
      const nextNo = sheetData.length;
      await appendRow(safeName, [
        nextNo, id, docNumber, d.requesterName || '-', d.division || '-',
        d.position || '-', d.requestType || '-', d.targetSigner || '-',
        departemen, 'Menunggu', getWIBDate(),
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