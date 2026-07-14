import { NextResponse } from 'next/server';
import { readSheet, getAuth } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';
import { google } from 'googleapis';

export async function GET(req, { params }) {
  try {
    const data = await readSheet(CONFIG.SHEETS.REQUESTS, false);
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === params.id) {
        const fileUrl = data[i][10];
        const docNumber = data[i][7] || 'document'; // Ambil nomor surat untuk nama file

        if (!fileUrl || !fileUrl.includes('docs.google.com')) {
          return NextResponse.json({ success: false, message: 'URL Dokumen tidak valid' }, { status: 400 });
        }

        // Extract Document ID dari URL
        const docIdMatch = fileUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (!docIdMatch) {
          return NextResponse.json({ success: false, message: 'Format URL Google Docs tidak valid' }, { status: 400 });
        }

        const docId = docIdMatch[1];
        const auth = getAuth();
        const drive = google.drive({ version: 'v3', auth });

        // Export dokumen sebagai PDF menggunakan Google Drive API
        const res = await drive.files.export({
          fileId: docId,
          mimeType: 'application/pdf',
        }, { responseType: 'arraybuffer' }); // Mengambil sebagai buffer

        // Bersihkan nama file dari karakter yang tidak valid untuk download
        const safeFilename = (docNumber.replace(/[^a-zA-Z0-9-_\/]/g, '_') || 'document');

        // Kirim file PDF ke browser
        return new NextResponse(res.data, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${safeFilename}.pdf"`, // Membuat browser otomatis mendownload
          },
        });
      }
    }
    
    return NextResponse.json({ success: false, message: 'Data tidak ditemukan' }, { status: 404 });
  } catch (e) {
    console.error('Error generating PDF:', e.message);
    return NextResponse.json({ success: false, message: 'Gagal membuat PDF: ' + e.message }, { status: 500 });
  }
}