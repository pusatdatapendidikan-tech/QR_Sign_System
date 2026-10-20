import { NextResponse } from 'next/server';
import { ensureSheets, readSheet, clearSheetCache } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';

export async function GET() {
  try {
    await ensureSheets();
    
    // Hapus cache server terlebih dahulu agar selalu ambil data terbaru
    clearSheetCache(CONFIG.SHEETS.DIVISI);
    
    // Gunakan false untuk mematikan cache di server
    const data = await readSheet(CONFIG.SHEETS.DIVISI, false);
    
    const list = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) list.push(data[i][0].trim());
    }
    
    const res = NextResponse.json(list);
    
    // TAMBAHKAN INI: Agar browser & Vercel tidak menyimpan cache data lama
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.headers.set('Pragma', 'no-cache');
    res.headers.set('Expires', '0');
    
    return res;
  } catch (e) {
    console.error('Error API Divisi:', e);
    const res = NextResponse.json([]);
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    return res;
  }
}