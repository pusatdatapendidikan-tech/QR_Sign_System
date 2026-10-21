import { NextResponse } from 'next/server';
import { ensureSheets, readSheet, updateCell, clearSheetCache } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';
import { getSession } from '@/lib/auth';

export async function POST(req, { params }) {
  try {
    await ensureSheets();
    const session = await getSession();
    if (!session.user || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Unauthorized - Admin only' }, { status: 401 });
    }
    
    const { revisionNote } = await req.json();
    const data = await readSheet(CONFIG.SHEETS.REQUESTS, false);
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === params.id) {
        const rowIndex = i + 1;
        
        // Update status jadi 'Revisi' (kolom 13 = index 12)
        await updateCell(CONFIG.SHEETS.REQUESTS, rowIndex, 13, 'Revisi');
        
        // Simpan catatan revisi (kolom 29 = index 28)
        await updateCell(CONFIG.SHEETS.REQUESTS, rowIndex, 29, revisionNote || '-');
        
        // Reset read_by_requester jadi false (supaya muncul notif badge di user)
        await updateCell(CONFIG.SHEETS.REQUESTS, rowIndex, 22, false);
        
        clearSheetCache(CONFIG.SHEETS.REQUESTS);
        
        return NextResponse.json({ 
          success: true, 
          message: 'Permintaan ditandai untuk revisi. User akan diberi tahu.' 
        });
      }
    }
    
    return NextResponse.json({ success: false, message: 'Data tidak ditemukan' }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}