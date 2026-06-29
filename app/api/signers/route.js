import { NextResponse } from 'next/server';
import { ensureSheets, readSheet } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';
import { DEFAULT_SIGNERS } from '@/lib/config';

export async function GET() {
  try {
    await ensureSheets();
    const data = await readSheet(CONFIG.SHEETS.SIGNERS);
    const list = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) {
        list.push({
          jabatan: data[i][0].trim(),
          nama: (data[i][1] || '').trim(),
          email: (data[i][2] || '').trim(),
        });
      }
    }
    return NextResponse.json(list.length > 0 ? list : DEFAULT_SIGNERS);
  } catch (e) {
    return NextResponse.json(DEFAULT_SIGNERS);
  }
}