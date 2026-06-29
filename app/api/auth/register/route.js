import { NextResponse } from 'next/server';
import { ensureSheets, readSheet, appendRow } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';
import { generateId } from '@/lib/utils';

export async function POST(req) {
  try {
    await ensureSheets();
    const { username, password, name, email, division, position } = await req.json();
    const data = await readSheet(CONFIG.SHEETS.USERS);
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === username) {
        return NextResponse.json({ success: false, message: 'Username sudah digunakan' });
      }
      if (data[i][5] && data[i][5].toString().toLowerCase() === email.toLowerCase()) {
        return NextResponse.json({ success: false, message: 'Email sudah terdaftar' });
      }
    }
    
    await appendRow(CONFIG.SHEETS.USERS, [
      generateId(), username, password, name, 'user', email,
      new Date().toISOString(), '', division || '-', position || '-', 'pending', '',
    ]);
    
    return NextResponse.json({ success: true, message: 'Pendaftaran berhasil! Akun Anda menunggu persetujuan Admin.' });
  } catch (e) {
    return NextResponse.json({ success: false, message: 'Error: ' + e.message }, { status: 500 });
  }
}