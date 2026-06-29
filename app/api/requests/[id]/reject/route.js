import { NextResponse } from 'next/server';
import { ensureSheets, readSheet, updateCell, clearSheetCache } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';
import { getSession } from '@/lib/auth';

export async function POST(req, { params }) {
  try {
    await ensureSheets();
    const session = await getSession();
    if (!session.user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    
    const { rejecterName, reason } = await req.json();
    const data = await readSheet(CONFIG.SHEETS.REQUESTS);
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === params.id) {
        const st = data[i][12];
        if (st !== 'Menunggu' && st !== 'Diteruskan') {
          return NextResponse.json({ success: false, message: `Permintaan tidak dapat ditolak (status: ${st})` });
        }
        const r = i + 1;
        await updateCell(CONFIG.SHEETS.REQUESTS, r, 13, 'Ditolak');
        await updateCell(CONFIG.SHEETS.REQUESTS, r, 16, rejecterName);
        await updateCell(CONFIG.SHEETS.REQUESTS, r, 17, new Date().toISOString());
        await updateCell(CONFIG.SHEETS.REQUESTS, r, 18, reason || '-');
        
        // Bersihkan cache
        clearSheetCache(CONFIG.SHEETS.REQUESTS);
        
        return NextResponse.json({ success: true, message: 'Permintaan ditolak' });
      }
    }
    return NextResponse.json({ success: false, message: 'Data tidak ditemukan' }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}