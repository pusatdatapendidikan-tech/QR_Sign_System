import { NextResponse } from 'next/server';
import { ensureSheets, readSheet, updateCell, clearSheetCache } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';
import { getSession } from '@/lib/auth';
import { getWIBDate } from '@/lib/utils';
import { sendEmail } from '@/lib/email';
import { logActivity } from '@/lib/activityLog';

export async function POST(req, { params }) {
  try {
    await ensureSheets();
    const session = await getSession();
    if (!session.user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    
    // Baca body request: forwarderName & targetSigner
    const { forwarderName, targetSigner } = await req.json();
    
    // Validasi
    if (!forwarderName || !targetSigner) {
      return NextResponse.json({ 
        success: false, 
        message: 'forwarderName dan targetSigner wajib diisi' 
      }, { status: 400 });
    }
    
    const data = await readSheet(CONFIG.SHEETS.REQUESTS, false);
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === params.id) {
        const r = i + 1;
        
        // Cek status harus 'Menunggu'
        if (data[i][12] !== 'Menunggu') {
          return NextResponse.json({ 
            success: false, 
            message: 'Hanya permintaan berstatus Menunggu yang bisa diteruskan' 
          });
        }
        
        // Update status jadi 'Diteruskan'
        await updateCell(CONFIG.SHEETS.REQUESTS, r, 13, 'Diteruskan');
        // Update forwarded_by (kolom 20, index 19)
        await updateCell(CONFIG.SHEETS.REQUESTS, r, 20, forwarderName);
        // Update forwarded_at (kolom 21, index 20)
        await updateCell(CONFIG.SHEETS.REQUESTS, r, 21, getWIBDate());
        
        clearSheetCache(CONFIG.SHEETS.REQUESTS);
        
        // Data permintaan untuk email
        const reqData = data[i]; // Seluruh baris data
        const requesterName = reqData[1] || '-';
        const documentType = reqData[6] || '-';
        const perihal = reqData[8] || '-';
        
        // === KIRIM EMAIL NOTIFIKASI KE ATASAN ===
        try {
          // Baca email signer dari sheet signers berdasarkan jabatan
          const signersData = await readSheet(CONFIG.SHEETS.SIGNERS);
          let signerEmail = '';
          
          for (let s = 1; s < signersData.length; s++) {
            if (signersData[s][0] === targetSigner) {
              signerEmail = signersData[s][2] || '';
              break;
            }
          }
          
          if (signerEmail) {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://qr-sign-systemgen.vercel.app';
            const html = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #7c3aed; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                  <h2 style="margin: 0;">📨 Permintaan Diteruskan ke Anda</h2>
                </div>
                <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
                  <p>Halo <strong>${targetSigner}</strong>,</p>
                  <p>Ada permintaan tanda tangan baru yang diteruskan kepada Anda untuk disetujui:</p>
                  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                    <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Pemohon</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${requesterName}</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Diteruskan Oleh</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${forwarderName}</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Jenis Surat</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${documentType}</td></tr>
                    <tr><td style="padding: 8px;"><strong>Perihal</strong></td><td style="padding: 8px;">${perihal}</td></tr>
                  </table>
                  <div style="text-align: center; margin-top: 24px;">
                    <a href="${baseUrl}/permintaan" 
                       style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                      Review & Setujui Permintaan
                    </a>
                  </div>
                  <div style="margin-top: 24px; text-align: center; padding: 12px; background: #f1f5f9; border-radius: 6px;">
                    <p style="font-size: 11px; color: #64748b; margin: 0;">
                      Email ini dikirim otomatis oleh <strong>SIPASTI</strong>
                    </p>
                  </div>
                </div>
              </div>
            `;
            await sendEmail({ 
              to: signerEmail, 
              subject: `Permintaan untuk Disetujui: ${documentType} - ${requesterName}`, 
              html 
            });
          } else {
            console.warn('Email signer tidak ditemukan untuk jabatan:', targetSigner);
          }
        } catch (emailErr) {
          console.error('Gagal kirim email ke atasan:', emailErr.message);
        }
        
        // === LOG ACTIVITY ===
        try {
          await logActivity({
            requestId: params.id,
            actor: forwarderName,
            actorRole: 'admin',
            activityType: 'PENERUSKAN',
            description: `Diteruskan ke ${targetSigner} oleh ${forwarderName}`,
            details: `Tujuan: ${targetSigner} | Pemohon: ${requesterName}`
          });
        } catch (logErr) {
          console.error('Gagal log activity:', logErr.message);
        }
        
        return NextResponse.json({ 
          success: true, 
          message: `Permintaan berhasil diteruskan ke ${targetSigner}` 
        });
      }
    }
    
    return NextResponse.json({ success: false, message: 'Data tidak ditemukan' }, { status: 404 });
  } catch (e) {
    console.error('Error Forward:', e);
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}