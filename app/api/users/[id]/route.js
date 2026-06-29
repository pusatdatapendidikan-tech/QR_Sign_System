import { NextResponse } from 'next/server';
import { ensureSheets, readSheet, updateCell, deleteRow, clearSheetCache } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';
import { getSession } from '@/lib/auth';

export async function PUT(req, { params }) {
  try {
    await ensureSheets();
    const session = await getSession();
    if (!session.user || String(session.user.role).trim() !== 'admin') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    
    const d = await req.json();
    const data = await readSheet(CONFIG.SHEETS.USERS);
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === params.id) {
        const r = i + 1;
        if (d.name !== undefined) await updateCell(CONFIG.SHEETS.USERS, r, 4, d.name);
        if (d.password !== undefined && d.password !== '') await updateCell(CONFIG.SHEETS.USERS, r, 3, d.password);
        if (d.role !== undefined) await updateCell(CONFIG.SHEETS.USERS, r, 5, d.role);
        if (d.email !== undefined) await updateCell(CONFIG.SHEETS.USERS, r, 6, d.email);
        if (d.signerRole !== undefined) await updateCell(CONFIG.SHEETS.USERS, r, 8, d.signerRole);
        if (d.division !== undefined) await updateCell(CONFIG.SHEETS.USERS, r, 9, d.division);
        if (d.position !== undefined) await updateCell(CONFIG.SHEETS.USERS, r, 10, d.position);
        
        // Bersihkan cache
        clearSheetCache(CONFIG.SHEETS.USERS);
        
        return NextResponse.json({ success: true, message: 'User berhasil diperbarui' });
      }
    }
    return NextResponse.json({ success: false, message: 'User tidak ditemukan' }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    await ensureSheets();
    const session = await getSession();
    if (!session.user || String(session.user.role).trim() !== 'admin') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    
    const data = await readSheet(CONFIG.SHEETS.USERS);
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === params.id) {
        if (data[i][1] === 'admin') {
          return NextResponse.json({ success: false, message: 'Admin default tidak dapat dihapus' });
        }
        await deleteRow(CONFIG.SHEETS.USERS, i + 1);
        
        // Bersihkan cache
        clearSheetCache(CONFIG.SHEETS.USERS);
        
        return NextResponse.json({ success: true, message: 'User berhasil dihapus' });
      }
    }
    return NextResponse.json({ success: false, message: 'User tidak ditemukan' }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}