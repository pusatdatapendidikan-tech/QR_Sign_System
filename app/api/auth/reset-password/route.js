import { NextResponse } from 'next/server';
import { ensureSheets, readSheet, updateCell, clearSheetCache } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';

export async function POST(req) {
  try {
    await ensureSheets();
    const { token, newPassword } = await req.json();
    
    if (!token || !newPassword) {
      return NextResponse.json({ success: false, message: 'Token dan password baru wajib diisi' }, { status: 400 });
    }
    
    if (newPassword.length < 4) {
      return NextResponse.json({ success: false, message: 'Password minimal 4 karakter' }, { status: 400 });
    }
    
    const data = await readSheet(CONFIG.SHEETS.USERS, false);
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][12] === token) { // Kolom reset_token
        const expiryStr = data[i][13];
        const expiry = new Date(expiryStr);
        const now = new Date();
        
        if (now > expiry) {
          return NextResponse.json({ 
            success: false, 
            message: 'Token reset password sudah kadaluarsa. Silakan request ulang.' 
          }, { status: 400 });
        }
        
        const rowIndex = i + 1;
        
        // Update password (kolom 3 = index 2)
        await updateCell(CONFIG.SHEETS.USERS, rowIndex, 3, newPassword);
        
        // Invalidate token (kosongkan kolom reset_token & reset_token_expiry)
        await updateCell(CONFIG.SHEETS.USERS, rowIndex, 13, '');
        await updateCell(CONFIG.SHEETS.USERS, rowIndex, 14, '');
        clearSheetCache(CONFIG.SHEETS.USERS);
        
        return NextResponse.json({ 
          success: true, 
          message: 'Password berhasil direset! Silakan login dengan password baru Anda.' 
        });
      }
    }
    
    return NextResponse.json({ 
      success: false, 
      message: 'Token reset password tidak valid' 
    }, { status: 400 });
  } catch (e) {
    console.error('Error reset password:', e);
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}