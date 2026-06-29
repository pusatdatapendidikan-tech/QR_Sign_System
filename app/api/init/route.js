import { NextResponse } from 'next/server';
import { ensureSheets } from '@/lib/googleSheets';

export async function GET() {
  try {
    await ensureSheets();
    return NextResponse.json({ success: true, message: 'Sheets berhasil diinisialisasi' });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}