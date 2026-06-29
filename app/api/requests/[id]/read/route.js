import { NextResponse } from 'next/server';
import { ensureSheets, readSheet, updateCell } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';
import { getSession } from '@/lib/auth';

export async function POST(req, { params }) {
  try {
    await ensureSheets();
    const data = await readSheet(CONFIG.SHEETS.REQUESTS);
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === params.id) {
        await updateCell(CONFIG.SHEETS.REQUESTS, i + 1, 22, true);
        return NextResponse.json({ success: true });
      }
    }
    return NextResponse.json({ success: false, message: 'Data tidak ditemukan' }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}