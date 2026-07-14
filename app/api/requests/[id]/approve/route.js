import { NextResponse } from 'next/server';
import { ensureSheets, readSheet, updateCell, clearSheetCache, getAuth } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';
import { getSession } from '@/lib/auth';
import { google } from 'googleapis';

// Fungsi helper untuk mencari posisi (index) teks di Google Docs
function findTextRange(doc, text) {
  let currentIndex = 0;
  for (const element of doc.body.content) {
    if (element.paragraph) {
      for (const run of element.paragraph.elements) {
        const content = run.textRun?.content || '';
        const textIndex = content.indexOf(text);
        if (textIndex !== -1) {
          return {
            startIndex: currentIndex + textIndex,
            endIndex: currentIndex + textIndex + text.length
          };
        }
        currentIndex += content.length;
      }
    }
  }
  return null;
}

export async function POST(req, { params }) {
  try {
    await ensureSheets();
    const session = await getSession();
    if (!session.user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    
    const { approverName } = await req.json();
    const data = await readSheet(CONFIG.SHEETS.REQUESTS);
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === params.id) {
        if (data[i][12] !== 'Diteruskan') {
          return NextResponse.json({ success: false, message: 'Hanya permintaan berstatus Diteruskan yang bisa disetujui atasan' });
        }
        
        const r = i + 1;
        const fileUrl = data[i][10]; // Ambil link Google Docs dari kolom ke-11 (index 10)
        
        // 1. Update status di Google Sheets
        await updateCell(CONFIG.SHEETS.REQUESTS, r, 13, 'Disetujui');
        await updateCell(CONFIG.SHEETS.REQUESTS, r, 14, approverName);
        await updateCell(CONFIG.SHEETS.REQUESTS, r, 15, new Date().toISOString());
        
        // 2. Proses Replace {{QR_CODE}} dengan Gambar Barcode/QR di Google Docs
        // 2. Proses Replace {{QR_CODE}} dengan Gambar Barcode/QR di Google Docs
        let qrWarning = ''; // Tambahkan variabel untuk pesan peringatan
        
        if (fileUrl && fileUrl.includes('docs.google.com')) {
          try {
            const docs = google.docs({ version: 'v1', auth: getAuth() });
            const docIdMatch = fileUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
            
            if (docIdMatch) {
              const docId = docIdMatch[1];
              const verifyUrl = `https://qr-sign-systemgen.vercel.app/verify/${params.id}`; // GANTI DOMAIN ANDA
              const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(verifyUrl)}`;

              await docs.documents.batchUpdate({
                documentId: docId,
                requestBody: {
                  requests: [{
                    replaceAllText: {
                      containsText: { text: '{{QR_CODE}}', matchCase: true },
                      replaceText: '[QR_PLACEHOLDER]'
                    }
                  }]
                }
              });

              const updatedDoc = await docs.documents.get({ documentId: docId });
              const range = findTextRange(updatedDoc.data, '[QR_PLACEHOLDER]');

              if (range) {
                await docs.documents.batchUpdate({
                  documentId: docId,
                  requestBody: {
                    requests: [
                      {
                        insertInlineImage: {
                          location: { index: range.startIndex },
                          uri: qrImageUrl,
                          objectSize: { height: { magnitude: 120, unit: 'PT' }, width: { magnitude: 120, unit: 'PT' } }
                        }
                      },
                      {
                        deleteContentRange: {
                          range: { startIndex: range.startIndex + 1, endIndex: range.endIndex + 1 }
                        }
                      }
                    ]
                  }
                });
              } else {
                // Jika teks placeholder tidak ditemukan di dokumen
                qrWarning = '\\n\\n⚠️ Peringatan: Teks {{QR_CODE}} tidak ditemukan di dalam dokumen.';
              }
            }
          } catch (docError) {
            // Jika gagal insert (kemungkinan besar masalah Permission/Share)
            console.error('Gagal insert QR ke Google Docs:', docError.message);
            qrWarning = '\\n\\n⚠️ Peringatan: Gagal menyisipkan QR Code. Pastikan dokumen sudah di-share ke "Anyone with the link = Editor" dan Google Docs API sudah aktif.';
          }
        }

        // Bersihkan cache
        clearSheetCache(CONFIG.SHEETS.REQUESTS);
        
        // Kirim response dengan pesan sukses + peringatan QR (jika ada)
        return NextResponse.json({ 
          success: true, 
          message: `Permintaan berhasil disetujui${qrWarning}` 
        });
      }
    }
  } catch (e) {
    console.error('Error Approve:', e);
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}