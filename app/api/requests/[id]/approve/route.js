import { NextResponse } from 'next/server';
import { ensureSheets, readSheet, updateCell, clearSheetCache, getAuth, generateDocNumber } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';
import { getSession } from '@/lib/auth';
import { getWIBDate } from '@/lib/utils';
import { google } from 'googleapis';

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
        const departemen = data[i][22] || ''; // Ambil departemen dari kolom 23 (index 22)
        
        // 1. GENERATE NOMOR SURAT JIKA MASIH KOSONG (-)
        if (docNumber === '-' && docType && docType !== '-') {
          try {
            docNumber = await generateDocNumber(docType, departemen);
            await updateCell(CONFIG.SHEETS.REQUESTS, r, 8, docNumber); // Update kolom 8 (Nomor Surat)
          } catch (e) {
            console.error('Gagal generate nomor surat:', e);
          }
        }

        // 2. Update status di Google Sheets
        await updateCell(CONFIG.SHEETS.REQUESTS, r, 13, 'Disetujui');
        await updateCell(CONFIG.SHEETS.REQUESTS, r, 14, approverName);
        await updateCell(CONFIG.SHEETS.REQUESTS, r, 15, getWIBDate());

        // 3. Update status & Nomor Surat di Sheet Jenis Surat
        if (docType && docType !== '-') {
          try {
            const safeName = docType.replace(/[\/\\:*?"<>|]/g, '-').trim();
            const sheetData = await readSheet(safeName, false);
            
            for (let j = 1; j < sheetData.length; j++) {
              if (sheetData[j][1] === params.id) {
                await updateCell(safeName, j + 1, 3, docNumber); // Update kolom 3 (Nomor Surat)
                await updateCell(safeName, j + 1, 10, 'Disetujui'); // Update kolom 10 (Status)
                break;
              }
            }
          } catch (sheetErr) {
            console.error('Gagal update status di sheet surat:', sheetErr.message);
          }
        }
        
        // 4. Proses Replace {{QR_CODE}} dengan Gambar Barcode/QR di Google Docs
        let qrWarning = '';
        
        if (fileUrl && fileUrl.includes('docs.google.com')) {
          try {
            const docs = google.docs({ version: 'v1', auth: getAuth() });
            const docIdMatch = fileUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
            
            if (docIdMatch) {
              const docId = docIdMatch[1];
              const verifyUrl = `https://qr-sign-systemgen.vercel.app/verify/${params.id}`; 
              const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(verifyUrl)}&color=000000&bgcolor=FFFFFF&ecc=H`;
              
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
                    if (content.includes('§')) {
                      placeholderIndex = pe.startIndex + content.indexOf('§');
                      break;
                    }
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
          message: `Permintaan berhasil disetujui dengan Nomor Surat: ${docNumber}${qrWarning}` 
        });
      }
    }
    return NextResponse.json({ success: false, message: 'Data tidak ditemukan' }, { status: 404 });
  } catch (e) {
    console.error('Error Approve:', e);
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}