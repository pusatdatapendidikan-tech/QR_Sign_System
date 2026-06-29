import { NextResponse } from 'next/server';
import { ensureSheets, readSheet } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';

export async function GET() {
  try {
    const data = await readSheet(CONFIG.SHEETS.DIVISI);
    const list = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) list.push(data[i][0].trim());
    }
    return NextResponse.json(list);
  } catch (e) {
    return NextResponse.json([]);
  }
}