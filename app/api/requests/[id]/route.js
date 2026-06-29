import { NextResponse } from 'next/server';
import { ensureSheets, readSheet, updateCell, deleteRow } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';
import { getSession } from '@/lib/auth';

export async function PUT(req, { params }) {
  try {
    await ensureSheets();
    const session = await getSession();
    if (!session.user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    
    const d = await req.json();
    const data = await readSheet(CONFIG.SHEETS.REQUESTS);
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === params.id) {
        const r = i + 1;
        if (d.documentType !== undefined) await updateCell(CONFIG.SHEETS.REQUESTS, r, 7, d.documentType);
        if (d.documentNumber !== undefined) await updateCell(CONFIG.SHEETS.REQUESTS, r, 8, d.documentNumber);
        if (d.perihal !== undefined) await updateCell(CONFIG.SHEETS.REQUESTS, r, 9, d.perihal);
        if (d.targetSigner !== undefined) await updateCell(CONFIG.SHEETS.REQUESTS, r, 10, d.targetSigner);
        if (d.requestType !== undefined) await updateCell(CONFIG.SHEETS.REQUESTS, r, 6, d.requestType);
        return NextResponse.json({ success: true, message: 'Data berhasil diperbarui' });
      }
    }
    return NextResponse.json({ success: false, message: 'Data tidak ditemukan' }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    await ensureSheets();
    const session = await getSession();
    if (!session.user || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    
    const data = await readSheet(CONFIG.SHEETS.REQUESTS);
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === params.id) {
        await deleteRow(CONFIG.SHEETS.REQUESTS, i + 1);
        return NextResponse.json({ success: true, message: 'Data berhasil dihapus' });
      }
    }
    return NextResponse.json({ success: false, message: 'Data tidak ditemukan' }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}