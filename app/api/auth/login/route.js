import { NextResponse } from 'next/server';
import { ensureSheets, readSheet } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';
import { getSession } from '@/lib/auth';

export async function POST(req) {
  try {
    await ensureSheets();
    const { username, password } = await req.json();
    const data = await readSheet(CONFIG.SHEETS.USERS);
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === username && data[i][2] === password) {
        const status = (data[i][10] || 'active').toString().trim().toLowerCase();
        if (status === 'pending') {
          return NextResponse.json({ success: false, message: 'Akun Anda belum disetujui oleh Admin. Silakan hubungi admin.' });
        }
        if (status === 'rejected') {
          const reason = (data[i][11] || '').toString().trim();
          return NextResponse.json({ success: false, message: 'Akun Anda ditolak oleh Admin.' + (reason ? ' Alasan: ' + reason : '') });
        }
        if (status !== 'active') {
          return NextResponse.json({ success: false, message: 'Akun tidak aktif. Hubungi admin.' });
        }
        
        const user = {
          id: data[i][0],
          username: data[i][1],
          name: data[i][3],
          role: data[i][4],
          email: data[i][5],
          signerRole: data[i][7] || '',
          division: data[i][8] || '-',
          position: data[i][9] || '-',
        };
        
        const session = await getSession();
        session.user = user;
        await session.save();
        
        return NextResponse.json({ success: true, user });
      }
    }
    return NextResponse.json({ success: false, message: 'Username atau password salah' });
  } catch (e) {
    return NextResponse.json({ success: false, message: 'Error: ' + e.message }, { status: 500 });
  }
}