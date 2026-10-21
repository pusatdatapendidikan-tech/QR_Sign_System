import { NextResponse } from 'next/server';
import { ensureSheets, readSheet, updateCell, deleteRow, clearSheetCache } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';
import { getSession } from '@/lib/auth';

export async function PUT(req, { params }) {
  try {
    await ensureSheets();
    const session = await getSession();
    if (!session.user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    
    const d = await req.json();
    const data = await readSheet(CONFIG.SHEETS.REQUESTS, false);
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === params.id) {
        const r = i + 1;
        const currentStatus = data[i][12]; // status (kolom 13, index 12)
        const isRevisionMode = currentStatus === 'Revisi';
        
        // Jika mode revisi, cek permission: hanya pemilik request yang bisa revisi
        if (isRevisionMode && data[i][2] !== session.user.username && session.user.role !== 'admin') {
          return NextResponse.json({ success: false, message: 'Anda tidak punya akses untuk revisi permintaan ini' }, { status: 403 });
        }
        
        // === UPDATE FIELD UMUM (Admin Edit & Revisi Submit) ===
        if (d.documentType !== undefined) await updateCell(CONFIG.SHEETS.REQUESTS, r, 7, d.documentType);
        if (d.perihal !== undefined) await updateCell(CONFIG.SHEETS.REQUESTS, r, 9, d.perihal);
        if (d.targetSigner !== undefined) await updateCell(CONFIG.SHEETS.REQUESTS, r, 10, d.targetSigner);
        if (d.requestType !== undefined) await updateCell(CONFIG.SHEETS.REQUESTS, r, 6, d.requestType);
        
        // === UPDATE FIELD TAMBAHAN HANYA SAAT MODE REVISI ===
        // Tujuannya: saat user revisi, semua field bisa diupdate
        // Saat admin edit biasa, hanya field utama yang boleh diubah
        if (isRevisionMode) {
          if (d.division !== undefined) await updateCell(CONFIG.SHEETS.REQUESTS, r, 4, d.division);
          if (d.position !== undefined) await updateCell(CONFIG.SHEETS.REQUESTS, r, 5, d.position);
          if (d.fileUrl !== undefined) await updateCell(CONFIG.SHEETS.REQUESTS, r, 11, d.fileUrl);
          if (d.fileName !== undefined) await updateCell(CONFIG.SHEETS.REQUESTS, r, 12, d.fileName);
          if (d.departemen !== undefined) await updateCell(CONFIG.SHEETS.REQUESTS, r, 23, d.departemen);
          if (d.posisiTTD !== undefined) await updateCell(CONFIG.SHEETS.REQUESTS, r, 24, d.posisiTTD);
          if (d.namaKegiatan !== undefined) await updateCell(CONFIG.SHEETS.REQUESTS, r, 25, d.namaKegiatan);
          if (d.tanggalKegiatan !== undefined) await updateCell(CONFIG.SHEETS.REQUESTS, r, 26, d.tanggalKegiatan);
          if (d.daftarPeserta !== undefined) await updateCell(CONFIG.SHEETS.REQUESTS, r, 27, d.daftarPeserta);
          if (d.tanggalSurat !== undefined) await updateCell(CONFIG.SHEETS.REQUESTS, r, 28, d.tanggalSurat);
          
          // Reset status kembali ke 'Menunggu' (kolom 13)
          await updateCell(CONFIG.SHEETS.REQUESTS, r, 13, 'Menunggu');
          
          // Reset read_by_requester (kolom 22)
          await updateCell(CONFIG.SHEETS.REQUESTS, r, 22, false);
          
          // Hapus catatan revisi (kolom 29 = index 28)
          await updateCell(CONFIG.SHEETS.REQUESTS, r, 29, '-');
        }
        
        clearSheetCache(CONFIG.SHEETS.REQUESTS);
        
        return NextResponse.json({ 
          success: true, 
          message: isRevisionMode 
            ? 'Revisi berhasil dikirim! Permintaan Anda akan direview ulang oleh Admin.' 
            : 'Data berhasil diperbarui' 
        });
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
    
    const data = await readSheet(CONFIG.SHEETS.REQUESTS, false);
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === params.id) {
        await deleteRow(CONFIG.SHEETS.REQUESTS, i + 1);
        clearSheetCache(CONFIG.SHEETS.REQUESTS);
        return NextResponse.json({ success: true, message: 'Data berhasil dihapus' });
      }
    }
    return NextResponse.json({ success: false, message: 'Data tidak ditemukan' }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}