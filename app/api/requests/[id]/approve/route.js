import { NextResponse } from 'next/server';
import { ensureSheets, readSheet, updateCell, clearSheetCache } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';
import { getSession } from '@/lib/auth';

export async function POST(req, { params }) {
  try {
    await ensureSheets();
    const session = await getSession();
    if (!session.user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    
    const { approverName } = await req.json();
    const data = await readSheet(CONFIG.SHEETS.REQUESTS);
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === params.id) {
        if (data[i][12] !== 'Diteruskan') {
          return NextResponse.json({ success: false, message: 'Hanya permintaan berstatus Diteruskan yang bisa disetujui atasan' });
        }
        const r = i + 1;
        await updateCell(CONFIG.SHEETS.REQUESTS, r, 13, 'Disetujui');
        await updateCell(CONFIG.SHEETS.REQUESTS, r, 14, approverName);
        await updateCell(CONFIG.SHEETS.REQUESTS, r, 15, new Date().toISOString());
        
        // Bersihkan cache
        clearSheetCache(CONFIG.SHEETS.REQUESTS);
        
        return NextResponse.json({ success: true, message: 'Permintaan berhasil disetujui' });
      }
    }
    return NextResponse.json({ success: false, message: 'Data tidak ditemukan' }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}