import { NextResponse } from 'next/server';
import { readSheet, updateCell, clearSheetCache } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';

export async function POST(req, { params }) {
  try {
    const data = await readSheet(CONFIG.SHEETS.REQUESTS);
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === params.id) {
        // Tandai kolom 22 (read_by_requester) menjadi true
        await updateCell(CONFIG.SHEETS.REQUESTS, i + 1, 22, "TRUE");
        
        // HAPUS CACHE AGAR BADGE LANGSUNG UPDATE
        clearSheetCache(CONFIG.SHEETS.REQUESTS);
        
        return NextResponse.json({ success: true });
      }
    }
    return NextResponse.json({ success: false, message: 'Data tidak ditemukan' }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}