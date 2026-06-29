import { NextResponse } from 'next/server';
import { ensureSheets, readSheet, updateCell } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';
import { getSession } from '@/lib/auth';

export async function POST(req, { params }) {
  try {
    await ensureSheets();
    const session = await getSession();
    if (!session.user || String(session.user.role).trim() !== 'admin') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    
    const { reason } = await req.json();
    const data = await readSheet(CONFIG.SHEETS.USERS);
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === params.id) {
        await updateCell(CONFIG.SHEETS.USERS, i + 1, 11, 'rejected');
        await updateCell(CONFIG.SHEETS.USERS, i + 1, 12, reason || '');
        return NextResponse.json({ success: true, message: `Akun ${data[i][3]} telah ditolak` });
      }
    }
    return NextResponse.json({ success: false, message: 'User tidak ditemukan' }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}