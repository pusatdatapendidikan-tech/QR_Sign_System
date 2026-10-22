import { NextResponse } from 'next/server';
import { ensureSheets, readSheet } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';
import { getSession } from '@/lib/auth';
import { formatDate } from '@/lib/utils';

export async function GET(req) {
  try {
    await ensureSheets();
    const session = await getSession();
    if (!session.user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(req.url);
    const requestId = searchParams.get('requestId');
    const limit = parseInt(searchParams.get('limit') || '200', 10);
    
    const data = await readSheet(CONFIG.SHEETS.ACTIVITY_LOG, false);
    const logs = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i] || [];
      if (!row[0]) continue;
      
      const log = {
        id: row[0],
        requestId: row[1],
        timestamp: row[2] ? formatDate(row[2]) : '-',
        actor: row[3] || '-',
        actorRole: row[4] || '-',
        activityType: row[5] || '-',
        description: row[6] || '-',
        details: row[7] || '-',
      };
      
      if (requestId && log.requestId !== requestId) continue;
      logs.push(log);
    }
    
    // Sort descending by timestamp (newest first)
    logs.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    
    const result = logs.slice(0, limit);
    
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}