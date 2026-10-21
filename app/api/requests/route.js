import { NextResponse } from 'next/server';
import { ensureSheets, readSheet, appendRow, ensureDocTypeSheet, updateCell, clearSheetCache } from '@/lib/googleSheets';
import { sendEmail } from '@/lib/email';
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
        tanggalSurat: row[27] || '-',
        revisionNote: row[28] || '-', // <--- TAMBAHKAN INI
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
    
    // TAMBAHKAN INI UNTUK DEBUG
    console.log('DEBUG POST REQUEST:', { 
      docType: d.documentType, 
      namaKegiatan: d.namaKegiatan, 
      daftarPeserta: d.daftarPeserta 
    });
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
      'Menunggu', '-', '-', '-', '-', '-', getWIBDate(), '-', '-', false, departemen || '-', d.posisiTTD || 'Kanan Bawah', 
      d.namaKegiatan || '-', d.tanggalKegiatan || '-', d.daftarPeserta || '-',
      d.tanggalSurat || '-' // <--- TAMBAHKAN INI
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
    // Kirim email notifikasi ke Admin
    try {
      // Baca email admin dari sheet Users
      const usersData = await readSheet(CONFIG.SHEETS.USERS);
      let adminEmails = [];
      for (let u = 1; u < usersData.length; u++) {
        if (usersData[u][4] === 'admin' && usersData[u][5] && usersData[u][10] === 'active') {
          adminEmails.push(usersData[u][5]);
        }
      }
      // Fallback ke env variable kalau tidak ada admin di sheet
      if (adminEmails.length === 0 && process.env.ADMIN_EMAIL) {
        adminEmails.push(process.env.ADMIN_EMAIL);
      }

      if (adminEmails.length > 0) {
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #1d4ed8; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
              <h2 style="margin: 0;">📋 Permintaan Baru Masuk</h2>
            </div>
            <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
              <p>Halo Admin,</p>
              <p>Ada permintaan tanda tangan baru yang menunggu review Anda:</p>
              <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Pemohon</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${d.requesterName || '-'}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Program/Divisi</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${d.division || '-'}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Jenis Surat</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${docType}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Perihal</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${d.perihal || '-'}</td></tr>
                <tr><td style="padding: 8px;"><strong>Tanggal Pengajuan</strong></td><td style="padding: 8px;">${getWIBDate()}</td></tr>
              </table>
              <div style="text-align: center; margin-top: 24px;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://qr-sign-systemgen.vercel.app'}/permintaan" 
                  style="background: #1d4ed8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                  Lihat Detail Permintaan
                </a>
              </div>
            </div>
          </div>
        `;
        await sendEmail({ 
          to: adminEmails.join(', '), 
          subject: `Permintaan Baru: ${docType} - ${d.requesterName}`, 
          html 
        });
      }
    } catch (emailErr) {
      console.error('Gagal kirim email ke admin:', emailErr.message);
    }
    
    return NextResponse.json({ success: true, message: 'Permintaan berhasil dikirim', id, documentNumber: docNumber });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}