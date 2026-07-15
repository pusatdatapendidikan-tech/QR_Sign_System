import { NextResponse } from 'next/server';
import { ensureSheets, readSheet, updateCell, clearSheetCache, getAuth } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';
import { getSession } from '@/lib/auth';
import { getWIBDate } from '@/lib/utils';
import { google } from 'googleapis';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'; // <--- IMPORT PDF-LIB
import { Readable } from 'stream'; // <--- IMPORT STREAM UNTUK UPLOAD KE DRIVE

// Helper untuk ekstrak ID dari Link Google Drive
function getDriveFileId(url) {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

export async function POST(req, { params }) {
  try {
    await ensureSheets();
    const session = await getSession();
    if (!session.user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    
    const { approverName } = await req.json();
    const data = await readSheet(CONFIG.SHEETS.REQUESTS, false);
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === params.id) {
        if (data[i][12] !== 'Diteruskan') {
          return NextResponse.json({ success: false, message: 'Hanya permintaan berstatus Diteruskan yang bisa disetujui atasan' });
        }
        
        const r = i + 1;
        const fileUrl = data[i][10]; 
        let docNumber = data[i][7] || '-';
        const docType = data[i][6];
        const departemen = data[i][22] || '';
        
        // 1. GENERATE NOMOR SURAT
        if (docNumber === '-' && docType && docType !== '-') {
          try {
            const { generateDocNumber } = await import('@/lib/googleSheets');
            docNumber = await generateDocNumber(docType, departemen);
            await updateCell(CONFIG.SHEETS.REQUESTS, r, 8, docNumber);
          } catch (e) { console.error('Gagal generate nomor surat:', e); }
        }

        // 2. Update Status di Sheets
        await updateCell(CONFIG.SHEETS.REQUESTS, r, 13, 'Disetujui');
        await updateCell(CONFIG.SHEETS.REQUESTS, r, 14, approverName);
        await updateCell(CONFIG.SHEETS.REQUESTS, r, 15, getWIBDate());

        // 3. Update Sheet Jenis Surat
        if (docType && docType !== '-') {
          try {
            const safeName = docType.replace(/[\/\\:*?"<>|]/g, '-').trim();
            const sheetData = await readSheet(safeName, true); // Diubah ke true agar memakai cache jika ada
            for (let j = 1; j < sheetData.length; j++) {
              if (sheetData[j][1] === params.id) {
                await updateCell(safeName, j + 1, 3, docNumber);
                await updateCell(safeName, j + 1, 10, 'Disetujui');
                break;
              }
            }
          } catch (sheetErr) { console.error('Gagal update sheet surat:', sheetErr.message); }
        }
        
        // 4. PROSES DOKUMEN (PDF STAMPING ATAU GOOGLE DOCS)
        let qrWarning = '';
        const verifyUrl = `https://qr-sign-systemgen.vercel.app/verify/${params.id}`; 
        const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(verifyUrl)}&color=000000&bgcolor=FFFFFF&ecc=H`;

        try {
          const auth = getAuth();
          const drive = google.drive({ version: 'v3', auth });

          if (docType === 'Sertifikat' && fileUrl.includes('drive.google.com')) {
            // ==========================================
            // ALUR A: PDF STAMPING (UNTUK SERTIFIKAT)
            // ==========================================
            const driveFileId = getDriveFileId(fileUrl);
            if (!driveFileId) throw new Error('Format link Google Drive PDF tidak valid.');

            // A1. Download PDF dari Google Drive
            const driveRes = await drive.files.get({ fileId: driveFileId, alt: 'media' }, { responseType: 'arraybuffer' });
            const pdfDoc = await PDFDocument.load(driveRes.data);

            // A2. Download Gambar QR Code
            const qrRes = await fetch(qrImageUrl);
            const qrImageBytes = await qrRes.arrayBuffer();
            const qrImage = await pdfDoc.embedPng(qrImageBytes); // Asumsi API mengembalikan PNG

            // A3. Setup Font & Ambil SEMUA Halaman
            const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            const pages = pdfDoc.getPages(); // <--- Mengambil semua halaman, bukan hanya halaman 1

            // Looping untuk menempelkan QR & Nomor di setiap halaman
            for (const page of pages) {
              const { width, height } = page.getSize(); // Ukuran bisa beda-beda tiap halaman

              // A4. Hitung Koordinat Dinamis berdasarkan Posisi yang dipilih User
              const qrSize = 100; 
              const margin = 40; 
              const posisiTTD = data[i][23] || 'Kanan Bawah'; 
              
              let xPosition = 0;
              let yPosition = 0;

              switch (posisiTTD) {
                case 'Kiri Bawah':
                  xPosition = margin;
                  yPosition = 85; 
                  break;
                case 'Tengah Bawah':
                  xPosition = (width - qrSize) / 2;
                  yPosition = 85; 
                  break;
                case 'Kanan Atas':
                  xPosition = width - qrSize - margin;
                  yPosition = height - qrSize - margin;
                  break;
                case 'Kiri Atas':
                  xPosition = margin;
                  yPosition = height - qrSize - margin;
                  break;
                case 'Kanan Bawah':
                default:
                  xPosition = width - qrSize - margin;
                  yPosition = 85; 
                  break;
              }

              // A5. Tempel QR Code ke halaman ini
              page.drawImage(qrImage, {
                x: xPosition,
                y: yPosition,
                width: qrSize,
                height: qrSize,
              });

              // A6. Tempel Nomor Sertifikat di halaman ini
              const textFontSize = 17; 
              const textWidth = font.widthOfTextAtSize(docNumber, textFontSize);
              
              page.drawText(docNumber, {
                x: (width - textWidth) / 2, 
                y: height - 145,             
                size: textFontSize,          
                font: font,
                color: rgb(0, 0, 0),        
              });
            } // Akhir loop halaman

            // A7. Simpan PDF yang sudah diubah & Upload kembali ke Google Drive (Timpa file lama)
            const modifiedPdfBytes = await pdfDoc.save();
            const buffer = Buffer.from(modifiedPdfBytes);
            
            await drive.files.update({
              fileId: driveFileId,
              media: {
                mimeType: 'application/pdf',
                body: Readable.from(buffer),
              },
            });

          } else if (fileUrl.includes('docs.google.com')) {
            // ==========================================
            // ALUR B: GOOGLE DOCS (UNTUK SURAT BIASA)
            // ==========================================
            const docs = google.docs({ version: 'v1', auth });
            const docIdMatch = fileUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
            
            if (docIdMatch) {
              const docId = docIdMatch[1];
              await docs.documents.batchUpdate({
                documentId: docId,
                requestBody: {
                  requests: [
                    { replaceAllText: { containsText: { text: '{{QR_CODE}}', matchCase: true }, replaceText: '§' } },
                    { replaceAllText: { containsText: { text: '{{NO_SURAT}}', matchCase: true }, replaceText: docNumber } }
                  ]
                }
              });

              const updatedDoc = await docs.documents.get({ documentId: docId });
              let placeholderIndex = -1;
              for (const element of updatedDoc.data.body.content) {
                if (element.paragraph) {
                  for (const pe of element.paragraph.elements) {
                    const content = pe.textRun?.content || '';
                    if (content.includes('§')) { placeholderIndex = pe.startIndex + content.indexOf('§'); break; }
                  }
                  if (placeholderIndex !== -1) break;
                }
              }

              if (placeholderIndex !== -1) {
                await docs.documents.batchUpdate({
                  documentId: docId,
                  requestBody: {
                    requests: [
                      { insertInlineImage: { location: { index: placeholderIndex }, uri: qrImageUrl, objectSize: { height: { magnitude: 75, unit: 'PT' }, width: { magnitude: 75, unit: 'PT' } } } },
                      { deleteContentRange: { range: { startIndex: placeholderIndex + 1, endIndex: placeholderIndex + 2 } } }
                    ]
                  }
                });
              } else { qrWarning = '\\n\\n⚠️ Peringatan: Teks {{QR_CODE}} tidak ditemukan di dalam dokumen.'; }
            }
          }
        } catch (docError) {
          console.error('Gagal proses dokumen:', docError.message);
          qrWarning = '\\n\\n⚠️ Peringatan: Gagal menyisipkan QR Code. Pastikan link Google Drive/PDF sudah benar dan di-share ke Editor.';
        }

        clearSheetCache(CONFIG.SHEETS.REQUESTS);
        return NextResponse.json({ success: true, message: `Permintaan berhasil disetujui dengan Nomor Surat: ${docNumber}${qrWarning}` });
      }
    }
    return NextResponse.json({ success: false, message: 'Data tidak ditemukan' }, { status: 404 });
  } catch (e) {
    console.error('Error Approve:', e);
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}