import { NextResponse } from 'next/server';
import { ensureSheets, readSheet } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';
import { formatDate } from '@/lib/utils';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    await ensureSheets();
    const session = await getSession();
    if (!session.user || String(session.user.role).trim() !== 'admin') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    
    const data = await readSheet(CONFIG.SHEETS.USERS);
    const list = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i] || [];
      if (!row[0]) continue;
      
      if (String(row[10] || 'active').trim().toLowerCase() === 'pending') {
        list.push({
          id: row[0], username: row[1] || '-', name: row[3] || '-',
          email: row[5] || '-', division: row[8] || '-', position: row[9] || '-',
          createdAt: formatDate(row[6]),
        });
      }
    }
    return NextResponse.json({ success: true, data: list });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}