import { NextResponse } from 'next/server';
import { ensureSheets, readSheet, appendRow, clearSheetCache } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';
import { generateId, formatDate } from '@/lib/utils';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    await ensureSheets();
    const session = await getSession();
    if (!session.user || String(session.user.role).trim() !== 'admin') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    
    const data = await readSheet(CONFIG.SHEETS.USERS);
    const users = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i] || [];
      if (!row[0]) continue;
      
      users.push({
        id: row[0], username: row[1] || '-', password: row[2] || '-', name: row[3] || '-',
        role: row[4] || 'user', email: row[5] || '-', createdAt: formatDate(row[6]),
        signerRole: row[7] || '', division: row[8] || '-', position: row[9] || '-',
        status: row[10] || 'active', rejectedReason: row[11] || '',
      });
    }
    return NextResponse.json({ success: true, data: users });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await ensureSheets();
    const session = await getSession();
    if (!session.user || String(session.user.role).trim() !== 'admin') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    
    const d = await req.json();
    const existing = await readSheet(CONFIG.SHEETS.USERS);
    for (let i = 1; i < existing.length; i++) {
      if (existing[i][1] === d.username) {
        return NextResponse.json({ success: false, message: 'Username sudah digunakan' });
      }
    }
    
    await appendRow(CONFIG.SHEETS.USERS, [
      generateId(), d.username, d.password, d.name, d.role, d.email,
      new Date().toISOString(), d.signerRole || '', d.division || '-', d.position || '-', 'active', '',
    ]);
    
    // Bersihkan cache
    clearSheetCache(CONFIG.SHEETS.USERS);
    
    return NextResponse.json({ success: true, message: 'User berhasil ditambahkan' });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}