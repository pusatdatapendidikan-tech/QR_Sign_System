import { NextResponse } from 'next/server';
import { ensureSheets, readSheet, updateCell, clearSheetCache } from '@/lib/googleSheets';
import { sendEmail } from '@/lib/email';
import { CONFIG } from '@/lib/config';
import { generateId, formatDate, generateDocumentNumber, getWIBDate } from '@/lib/utils';
import { getSession } from '@/lib/auth';
import { logActivity } from '@/lib/activityLog';

export async function POST(req, { params }) {
  try {
    await ensureSheets();
    const session = await getSession();
    if (!session.user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    
    const { forwarderName } = await req.json();
    const data = await readSheet(CONFIG.SHEETS.REQUESTS);
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === params.id) {
        if (data[i][12] !== 'Menunggu') {
          return NextResponse.json({ success: false, message: 'Hanya permintaan berstatus Menunggu yang bisa diteruskan' });
        }
        const r = i + 1;
        await updateCell(CONFIG.SHEETS.REQUESTS, r, 13, 'Diteruskan');
        await updateCell(CONFIG.SHEETS.REQUESTS, r, 20, forwarderName);
        await updateCell(CONFIG.SHEETS.REQUESTS, r, 20, getWIBDate());
        
        // Bersihkan cache
        clearSheetCache(CONFIG.SHEETS.REQUESTS);

        // Kirim email notifikasi ke Atasan (penerima)
        try {
          // Baca email signer dari sheet signers berdasarkan jabatan
          const signersData = await readSheet(CONFIG.SHEETS.SIGNERS);
          let signerEmail = '';
          for (let s = 1; s < signersData.length; s++) {
            if (signersData[s][0] === targetSigner) { // targetSigner = jabatan signer
              signerEmail = signersData[s][2]; // kolom email
              break;
            }
          }

          if (signerEmail) {
            const html = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #7c3aed; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                  <h2 style="margin: 0;">📨 Permintaan Diteruskan ke Anda</h2>
                </div>
                <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
                  <p>Halo <strong>${targetSigner}</strong>,</p>
                  <p>Ada permintaan tanda tangan baru yang diteruskan kepada Anda untuk disetujui:</p>
                  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                    <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Pemohon</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${reqData[1]}</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Diteruskan Oleh</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${forwarderName}</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Jenis Surat</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${reqData[6]}</td></tr>
                    <tr><td style="padding: 8px;"><strong>Perihal</strong></td><td style="padding: 8px;">${reqData[8] || '-'}</td></tr>
                  </table>
                  <div style="text-align: center; margin-top: 24px;">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://qr-sign-systemgen.vercel.app'}/permintaan" 
                      style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                      Review & Setujui Permintaan
                    </a>
                  </div>
                </div>
              </div>
            `;
            await sendEmail({ 
              to: signerEmail, 
              subject: `Permintaan untuk Disetujui: ${reqData[6]} - ${reqData[1]}`, 
              html 
            });
          } else {
            console.warn('Email signer tidak ditemukan untuk jabatan:', targetSigner);
          }
        } catch (emailErr) {
          console.error('Gagal kirim email ke atasan:', emailErr.message);
        }

        await logActivity({
          requestId: params.id,
          actor: forwarderName,
          actorRole: 'admin',
          activityType: 'PENERUSKAN',
          description: `Diteruskan ke ${targetSigner} oleh ${forwarderName}`,
          details: `Tujuan: ${targetSigner}`
        });
        
        return NextResponse.json({ success: true, message: 'Permintaan berhasil diteruskan' });
      }
    }
    return NextResponse.json({ success: false, message: 'Data tidak ditemukan' }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}