import { NextResponse } from 'next/server';
import { ensureSheets, readSheet } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';

export async function GET() {
  try {
    await ensureSheets();
    const data = await readSheet(CONFIG.SHEETS.NOMOR_SURAT);
    const list = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) {
        list.push({
          jenisSurat: data[i][0].trim(),
          bulan: parseInt(data[i][1]),
          tahun: parseInt(data[i][2]),
          nomorTerakhir: parseInt(data[i][3]) || 0,
        });
      }
    }
    return NextResponse.json(list);
  } catch (e) {
    return NextResponse.json([]);
  }
}