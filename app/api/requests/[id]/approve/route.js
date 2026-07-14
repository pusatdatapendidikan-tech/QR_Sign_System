import { NextResponse } from 'next/server';
import { ensureSheets, readSheet, updateCell, clearSheetCache, getAuth } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';
import { getSession } from '@/lib/auth';
import { google } from 'googleapis';

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
        const fileUrl = data[i][10]; 
        const docNumber = data[i][7] || '-';
        
        // 1. Update status di Google Sheets
        await updateCell(CONFIG.SHEETS.REQUESTS, r, 13, 'Disetujui');
        await updateCell(CONFIG.SHEETS.REQUESTS, r, 14, approverName);
        await updateCell(CONFIG.SHEETS.REQUESTS, r, 15, new Date().toISOString());

                // 1.5. Update status di Sheet Jenis Surat (Sheet Surat)
        const docType = data[i][6]; // Ambil jenis surat (kolom ke-7 / index 6)
        if (docType && docType !== '-') {
          try {
            const safeName = docType.replace(/[\/\\:*?"<>|]/g, '-').trim(); // Samakan format nama sheet
            const sheetData = await readSheet(safeName, false); // Baca data di sheet surat tersebut tanpa cache
            
            for (let j = 1; j < sheetData.length; j++) {
              if (sheetData[j][1] === params.id) { // Cari baris yang ID-nya sama (ID ada di kolom B / index 1)
                await updateCell(safeName, j + 1, 10, 'Disetujui'); // Update kolom 10 (Status) menjadi Disetujui
                break; // Berhenti mencari setelah ketemu
              }
            }
          } catch (sheetErr) {
            console.error('Gagal update status di sheet surat:', sheetErr.message);
            // Abaikan error jika sheet tidak ditemukan, agar proses approve tetap lanjut
          }
        }
        
        // 2. Proses Replace {{QR_CODE}} dengan Gambar Barcode/QR di Google Docs
        let qrWarning = '';
        
        if (fileUrl && fileUrl.includes('docs.google.com')) {
          try {
            const docs = google.docs({ version: 'v1', auth: getAuth() });
            const docIdMatch = fileUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
            
            if (docIdMatch) {
              const docId = docIdMatch[1];
              const verifyUrl =  `https://qr-sign-systemgen.vercel.app//verify/${params.id}`; // GANTI DOMAIN ANDA
              const logoUrl = CONFIG.LOGO_URL || 'https://i0.wp.com/greatedunesia.id/wp-content/uploads/2024/05/ico-ge.webp?w=495&ssl=1';
              const qrImageUrl = `https://quickchart.io/qr?text=${encodeURIComponent(verifyUrl)}&size=1000&centerImageUrl=${encodeURIComponent(logoUrl)}&format=png`;
              // Step A: Replace teks {{QR_CODE}} dan {{NO_SURAT}}
              await docs.documents.batchUpdate({
                documentId: docId,
                requestBody: {
                  requests: [
                    {
                      replaceAllText: {
                        containsText: { text: '{{QR_CODE}}', matchCase: true },
                        replaceText: '§' // Placeholder untuk gambar
                      }
                    },
                    {
                      replaceAllText: {
                        containsText: { text: '{{NO_SURAT}}', matchCase: true },
                        replaceText: docNumber // <--- GANTI DENGAN NOMOR SURAT DARI DATABASE
                      }
                    }
                  ]
                }
              });

              // Step B: Ambil struktur dokumen terbaru dan cari index § secara presisi
              const updatedDoc = await docs.documents.get({ documentId: docId });
              let placeholderIndex = -1;
              
              for (const element of updatedDoc.data.body.content) {
                if (element.paragraph) {
                  for (const pe of element.paragraph.elements) {
                    const content = pe.textRun?.content || '';
                    if (content.includes('§')) {
                      // Gunakan startIndex resmi dari Google Docs + posisi karakter §
                      placeholderIndex = pe.startIndex + content.indexOf('§');
                      break;
                    }
                  }
                  if (placeholderIndex !== -1) break;
                }
              }

              if (placeholderIndex !== -1) {
                // Step C: Insert gambar QR dan hapus placeholder §
                await docs.documents.batchUpdate({
                  documentId: docId,
                  requestBody: {
                    requests: [
                      {
                        insertInlineImage: {
                          location: { index: placeholderIndex },
                          uri: qrImageUrl,
                          objectSize: { 
                            height: { magnitude: 75, unit: 'PT' }, // Ukuran QR Code
                            width: { magnitude: 75, unit: 'PT' } 
                          }
                        }
                      },
                      {
                        // Hapus TEPAT 1 karakter (§) yang bergeser ke kanan karena gambar masuk
                        deleteContentRange: {
                          range: { startIndex: placeholderIndex + 1, endIndex: placeholderIndex + 2 }
                        }
                      }
                    ]
                  }
                });
              } else {
                qrWarning = '\\n\\n⚠️ Peringatan: Teks {{QR_CODE}} tidak ditemukan di dalam dokumen.';
              }
            }
          } catch (docError) {
            console.error('Gagal insert QR ke Google Docs:', docError.message);
            qrWarning = '\\n\\n⚠️ Peringatan: Gagal menyisipkan QR Code. Pastikan dokumen sudah di-share ke "Anyone with the link = Editor".';
          }
        }

        clearSheetCache(CONFIG.SHEETS.REQUESTS);
        
        return NextResponse.json({ 
          success: true, 
          message: `Permintaan berhasil disetujui${qrWarning}` 
        });
      }
    }
    return NextResponse.json({ success: false, message: 'Data tidak ditemukan' }, { status: 404 });
  } catch (e) {
    console.error('Error Approve:', e);
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}