import { NextResponse } from 'next/server';
import { ensureSheets, readSheet, updateCell, clearSheetCache } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';
import { sendEmail } from '@/lib/email';
import crypto from 'crypto';

export async function POST(req) {
  try {
    await ensureSheets();
    const { email } = await req.json();
    
    if (!email) {
      return NextResponse.json({ success: false, message: 'Email wajib diisi' }, { status: 400 });
    }
    
    const data = await readSheet(CONFIG.SHEETS.USERS, false);
    let userFound = false;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][5] && data[i][5].toString().toLowerCase() === email.toLowerCase()) {
        const rowIndex = i + 1;
        
        // Generate random token 64 karakter
        const token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // Berlaku 1 jam
        
        // Simpan token & expiry ke sheet Users (kolom 13 & 14, index 12 & 13)
        await updateCell(CONFIG.SHEETS.USERS, rowIndex, 13, token);
        await updateCell(CONFIG.SHEETS.USERS, rowIndex, 14, expiry);
        clearSheetCache(CONFIG.SHEETS.USERS);
        
        // Kirim email reset password
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://qr-sign-systemgen.vercel.app';
        const resetUrl = `${baseUrl}/reset-password?token=${token}`;
        
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
              <h2 style="margin: 0;">🔑 Reset Password</h2>
            </div>
            <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
              <p>Halo <strong>${data[i][3]}</strong>,</p>
              <p>Anda menerima email ini karena ada permintaan reset password untuk akun Anda di SIPASTI.</p>
              <p>Silakan klik tombol di bawah untuk membuat password baru:</p>
              <div style="text-align: center; margin: 24px 0;">
                <a href="${resetUrl}" 
                   style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                  Reset Password Saya
                </a>
              </div>
              <p style="font-size: 12px; color: #64748b; margin-top: 24px;">
                ⚠️ Link ini akan kadaluarsa dalam 1 jam.<br/>
                Jika Anda tidak meminta reset password, abaikan email ini.
              </p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
              <p style="font-size: 12px; color: #94a3b8; word-break: break-all;">
                Atau salin link ini ke browser: <br/>${resetUrl}
              </p>
            </div>
          </div>
        `;
        
        await sendEmail({ to: email, subject: 'Reset Password - SIPASTI', html });
        userFound = true;
        break;
      }
    }
    
    // Selalu balas sukses untuk keamanan (anti email enumeration)
    return NextResponse.json({ 
      success: true, 
      message: userFound 
        ? 'Link reset password telah dikirim ke email Anda. Silakan cek inbox (atau folder spam).'
        : 'Jika email terdaftar, link reset password telah dikirim ke email Anda.'
    });
  } catch (e) {
    console.error('Error forgot password:', e);
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}