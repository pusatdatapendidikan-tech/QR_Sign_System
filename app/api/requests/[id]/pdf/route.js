import { NextResponse } from 'next/server';
import { readSheet, getAuth } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';
import { google } from 'googleapis';
import { PDFDocument } from 'pdf-lib'; // <--- IMPORT pdf-lib

// Helper untuk ekstrak ID dari Link Google Drive
function getDriveFileId(url) {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

export async function GET(req, { params }) {
  try {
    const data = await readSheet(CONFIG.SHEETS.REQUESTS, false);
    
    // Cek apakah user meminta halaman spesifik (untuk sertifikat batch)
    const { searchParams } = new URL(req.url);
    const halaman = parseInt(searchParams.get('halaman') || '0', 10);
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === params.id) {
        const fileUrl = data[i][10];
        const docNumber = data[i][7] || 'document';
        const docType = data[i][6];

        if (!fileUrl) {
          return NextResponse.json({ success: false, message: 'URL Dokumen tidak valid' }, { status: 400 });
        }

        let pdfBytesToSend;
        let filename = (docNumber.replace(/[^a-zA-Z0-9-_\/]/g, '_') || 'document') + '.pdf';

        // Jika ini Sertifikat di Google Drive dan user minta halaman spesifik
        if (docType === 'Sertifikat' && fileUrl.includes('drive.google.com') && halaman > 0) {
          const driveFileId = getDriveFileId(fileUrl);
          if (!driveFileId) return NextResponse.json({ success: false, message: 'Format link Drive tidak valid' }, { status: 400 });

          const auth = getAuth();
          const drive = google.drive({ version: 'v3', auth });

          // 1. Download PDF penuh dari Drive
          const driveRes = await drive.files.get({ fileId: driveFileId, alt: 'media' }, { responseType: 'arraybuffer' });
          const fullPdfDoc = await PDFDocument.load(driveRes.data);

          // 2. Validasi nomor halaman
          const totalPages = fullPdfDoc.getPageCount();
          if (halaman > totalPages) {
            return NextResponse.json({ success: false, message: 'Halaman tidak ditemukan di PDF' }, { status: 404 });
          }

          // 3. Buat PDF baru yang hanya berisi 1 halaman yang diminta
          const newPdf = await PDFDocument.create();
          const [copiedPage] = await newPdf.copyPages(fullPdfDoc, [halaman - 1]); // Index dimulai dari 0
          newPdf.addPage(copiedPage);
          
          pdfBytesToSend = await newPdf.save();
          
          // Ubah nama file agar spesifik (misal: 012_I_2024.pdf)
          const [startStr] = docNumber.split(' s/d ');
          const numMatch = startStr.match(/^(\d+)/);
          if (numMatch) {
            const originalNumStr = numMatch[1];
            const currentNum = parseInt(originalNumStr, 10) + (halaman - 1);
            const currentPaddedNum = String(currentNum).padStart(originalNumStr.length, '0');
            const specificDocNumber = startStr.replace(originalNumStr, currentPaddedNum);
            filename = specificDocNumber.replace(/[^a-zA-Z0-9-_\/]/g, '_') + '.pdf';
          }

        } else {
          // Alur Normal untuk Google Docs (bukan sertifikat)
          if (!fileUrl.includes('docs.google.com')) {
            return NextResponse.json({ success: false, message: 'URL bukan Google Docs' }, { status: 400 });
          }
          const docIdMatch = fileUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
          if (!docIdMatch) return NextResponse.json({ success: false, message: 'Format URL Docs tidak valid' }, { status: 400 });

          const auth = getAuth();
          const drive = google.drive({ version: 'v1', auth }); // Docs API pakai v1 di export
          
          const res = await drive.files.export({
            fileId: docIdMatch[1],
            mimeType: 'application/pdf',
          }, { responseType: 'arraybuffer' });
          
          pdfBytesToSend = res.data;
        }

        // Kirim file PDF ke browser
        return new NextResponse(pdfBytesToSend, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${filename}"`, // inline agar bisa dibaca di tab baru
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