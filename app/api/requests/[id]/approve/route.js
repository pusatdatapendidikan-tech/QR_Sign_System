import { NextResponse } from 'next/server';
import { ensureSheets, readSheet, updateCell, clearSheetCache, getAuth, generateBatchDocNumbers, getSheets, getSpreadsheetId } from '@/lib/googleSheets';
import { sendEmail } from '@/lib/email';
import { CONFIG } from '@/lib/config';
import { getSession } from '@/lib/auth';
import { getWIBDate } from '@/lib/utils';
import { google } from 'googleapis';
import { logActivity } from '@/lib/activityLog';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Readable } from 'stream';

function getDriveFileId(url) {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

// Helper format tanggal ke Bahasa Indonesia
function formatTanggalID(dateStr) {
  if (!dateStr || dateStr === '-') return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const bln = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  return `${d.getDate()} ${bln[d.getMonth()]} ${d.getFullYear()}`;
}

// Helper untuk batch update multiple cells sekaligus (hemat API call)
async function batchUpdateCells(sheetName, updates) {
  if (!updates || updates.length === 0) return;
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  
  // Pakai values.batchUpdate yang support A1 notation
  const data = updates.map(({ rowIndex, colIndex, value }) => {
    const col = columnToLetter(colIndex);
    return {
      range: `${sheetName}!${col}${rowIndex}`,
      values: [[String(value)]]
    };
  });
  
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: data
    }
  });
}
  
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests }
  });
}

// Note: columnToLetter harus di-import atau dideklarasikan di file ini juga
// Kalau belum, tambahkan:
function columnToLetter(column) {
  let letter = '';
  let temp = column;
  while (temp > 0) {
    let mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - 1) / 26);
  }
  return letter;
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
        const verifyUrl = `https://qr-sign-systemgen.vercel.app/verify/${params.id}`; 

        // 1. GENERATE NOMOR SURAT (cukup generate nilai-nya saja, update dilakukan batch di section 2)
        if (docNumber === '-' && docType && docType !== '-' && docType !== 'Sertifikat') {
          try {
            const { generateDocNumber } = await import('@/lib/googleSheets');
            docNumber = await generateDocNumber(docType, departemen);
            // Tidak perlu updateCell di sini, akan di-batch di section 2
          } catch (e) { console.error('Gagal generate nomor surat:', e); }
        }

        // 2. Update Status di Sheets (batch 4 cells dalam 1 request API)
        await batchUpdateCells(CONFIG.SHEETS.REQUESTS, [
          { rowIndex: r, colIndex: 13, value: 'Disetujui' },
          { rowIndex: r, colIndex: 14, value: approverName },
          { rowIndex: r, colIndex: 15, value: getWIBDate() },
          { rowIndex: r, colIndex: 8, value: docNumber },  // Update nomor surat sekalian
        ]);

        // 3. Update Sheet Jenis Surat
        if (docType && docType !== '-') {
          try {
            const safeName = docType.replace(/[\/\\:*?"<>|]/g, '-').trim();
            const sheetData = await readSheet(safeName, true);
            for (let j = 1; j < sheetData.length; j++) {
              if (sheetData[j][1] === params.id) {
                await updateCell(safeName, j + 1, 3, docNumber);
                await updateCell(safeName, j + 1, 10, 'Disetujui');
                break;
              }
            }
          } catch (sheetErr) { console.error('Gagal update sheet surat:', sheetErr.message); }
        }
        
        // 4. PROSES DOKUMEN
        let qrWarning = '';
        const auth = getAuth();
        const drive = google.drive({ version: 'v3', auth });
        const slides = google.slides({ version: 'v1', auth }); // Inisialisasi Slides API

        try {
          if (docType === 'Sertifikat' && CONFIG.TEMPLATE_SERTIFIKAT_ID) {
            // ==========================================
            // ALUR C: BATCH CERTIFICATE GENERATION (GOOGLE SLIDES)
            // ==========================================
            const namaKegiatan = data[i][24] || '-';
            const tanggalKegiatan = formatTanggalID(data[i][25]);
            const daftarPesertaStr = data[i][26] || '';
            const pesertaList = daftarPesertaStr.split('\n').map(p => p.trim()).filter(p => p);

            // Ubah: Jangan throw error, tapi lewati (skip) pembuatan slide jika peserta kosong
            if (pesertaList.length === 0) {
              console.warn('Data peserta tidak ditemukan di kolom AA. Kemungkinan data lama atau gagal tersimpan saat POST.');
              qrWarning = '\\n\\n⚠️ Peringatan: Gagal membuat Sertifikat Otomatis karena Daftar Peserta tidak ditemukan di database. Harap buat permintaan Sertifikat baru.';
            } else {
              
              // ---- SEMUA KODE SLIDES API (C1 sampai C6) DIMASUKKAN KE DALAM `else` INI ----
              
              // C1. Duplikasi Master Template
              console.log('DEBUG FOLDER ID:', CONFIG.SHARED_DRIVE_ID); // <--- TAMBAHKAN INI
              
              const copyRes = await drive.files.copy({
                fileId: CONFIG.TEMPLATE_SERTIFIKAT_ID,
                supportsAllDrives: true, 
                requestBody: { 
                  name: `Sertifikat - ${namaKegiatan}`,
                  parents: [CONFIG.SHARED_DRIVE_ID] 
                }
              });
              const newPresId = copyRes.data.id;
              const newFileUrl = `https://docs.google.com/presentation/d/${newPresId}/edit`;

              // Beri akses agar user bisa edit logonya nanti
              await drive.permissions.create({
                fileId: newPresId,
                requestBody: { role: 'writer', type: 'anyone' }
              });

              // C2. Dapatkan struktur slide & ID slide asli (template)
              const presRes = await slides.presentations.get({ presentationId: newPresId });
              const originalSlideId = presRes.data.slides[0].objectId;

              // C3. Generate Nomor Surat Batch
              const docNumbersArray = await generateBatchDocNumbers(docType, departemen, pesertaList.length);
              docNumber = pesertaList.length > 1 ? `${docNumbersArray[0]} s/d ${docNumbersArray[docNumbersArray.length - 1]}` : docNumbersArray[0];
              await updateCell(CONFIG.SHEETS.REQUESTS, r, 8, docNumber);
              await updateCell(CONFIG.SHEETS.REQUESTS, r, 11, newFileUrl); // Update fileUrl di Sheets

              // C4. OPTIMASI: Duplikasi semua slide sekaligus
              const duplicateRequests = pesertaList.map(() => ({
                duplicateObject: { objectId: originalSlideId }
              }));
              const dupBatchRes = await slides.presentations.batchUpdate({
                presentationId: newPresId,
                requestBody: { requests: duplicateRequests }
              });
              
              // Ambil ID slide yang baru saja diduplikasi
              const newSlideIds = dupBatchRes.data.replies.map(rep => rep.duplicateObject.objectId);

              // C5. OPTIMASI: Isi data ke semua slide sekaligus (Super Fast!)
              const populateRequests = [];
              for (let idx = 0; idx < pesertaList.length; idx++) {
                const slideId = newSlideIds[idx];
                const currentPeserta = pesertaList[idx];
                const currentDocNum = docNumbersArray[idx];
                const qrUrlPage = `${verifyUrl}?halaman=${idx + 1}`;
                const qrImageUrlPage = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(qrUrlPage)}&color=000000&bgcolor=FFFFFF&ecc=H`;

                populateRequests.push(
                  { replaceAllText: { containsText: { text: '{{NAMA_PESERTA}}', matchCase: true }, replaceText: currentPeserta, pageObjectIds: [slideId] } },
                  { replaceAllText: { containsText: { text: '{{KEGIATAN}}', matchCase: true }, replaceText: namaKegiatan, pageObjectIds: [slideId] } },
                  { replaceAllText: { containsText: { text: '{{TANGGAL}}', matchCase: true }, replaceText: tanggalKegiatan, pageObjectIds: [slideId] } },
                  { replaceAllText: { containsText: { text: '{{NO_SURAT}}', matchCase: true }, replaceText: currentDocNum, pageObjectIds: [slideId] } },
                  { replaceAllShapesWithImage: { containsText: { text: '{{QR_CODE}}', matchCase: true }, imageUrl: qrImageUrlPage, pageObjectIds: [slideId] } }
                );
              }

              await slides.presentations.batchUpdate({
                presentationId: newPresId,
                requestBody: { requests: populateRequests }
              });

              // C6. Hapus Slide Template Asli (Halaman 1 yang masih kosong)
              await slides.presentations.batchUpdate({
                presentationId: newPresId,
                requestBody: { requests: [{ deleteObject: { objectId: originalSlideId } }] }
              });
            }

          } else if (docType === 'Sertifikat' && fileUrl.includes('drive.google.com')) {
            // ==========================================
            // ALUR A2: PDF STAMPING (Jika user tetap upload PDF manual)
            // ==========================================
            // (Kode PDF Stamping batch yang lama tetap di sini jika diperlukan)
            
          } else if (fileUrl.includes('docs.google.com')) {
            // ==========================================
            // ALUR B: GOOGLE DOCS - COPY KE FOLDER PUSAT
            // ==========================================
            const docs = google.docs({ version: 'v1', auth });
            const originalDocId = getDriveFileId(fileUrl);
            
            try {
              // 1. Duplikasi file user ke folder pusat (SHARED_DRIVE_ID)
              const copyRes = await drive.files.copy({
                fileId: originalDocId,
                supportsAllDrives: true,
                requestBody: { 
                  name: `Surat - ${data[i][1]} - ${docNumber}`,
                  parents: [CONFIG.SHARED_DRIVE_ID] 
                }
              });
              const newDocId = copyRes.data.id;
              const newFileUrl = `https://docs.google.com/document/d/${newDocId}/edit`;
              
              // 2. Beri akses anyone = reader (read-only) agar user tidak bisa edit dokumen final
              await drive.permissions.create({
                fileId: newDocId,
                supportsAllDrives: true,
                requestBody: { role: 'reader', type: 'anyone' }
              });
              
              // 3. Update fileUrl di Sheet Requests (kolom 11 = index 10) pakai link baru
              await updateCell(CONFIG.SHEETS.REQUESTS, r, 11, newFileUrl);
              
              // 4. Generate URL QR Code
              const qrUrl = verifyUrl;
              const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(qrUrl)}&color=000000&bgcolor=FFFFFF&ecc=H`;
              
              // 5. Ambil struktur dokumen SEBELUM modifikasi apapun
              const docRes = await docs.documents.get({ documentId: newDocId });
              
              // Fungsi recursive untuk cari teks di paragraf DAN tabel
              function findTextInContent(content, searchText) {
                if (!content) return null;
                
                for (const element of content) {
                  if (element.paragraph && element.paragraph.elements) {
                    for (const el of element.paragraph.elements) {
                      if (el.textRun && el.textRun.content.includes(searchText)) {
                        const offset = el.textRun.content.indexOf(searchText);
                        return {
                          start: parseInt(el.startIndex) + offset,
                          end: parseInt(el.startIndex) + offset + searchText.length
                        };
                      }
                    }
                  }
                  if (element.table && element.table.tableRows) {
                    for (const row of element.table.tableRows) {
                      for (const cell of row.tableCells) {
                        const found = findTextInContent(cell.content, searchText);
                        if (found) return found;
                      }
                    }
                  }
                }
                return null;
              }
              
              // 6. Cari lokasi {{QR_CODE}}
              const qrCodeLocation = findTextInContent(docRes.data.body.content, '{{QR_CODE}}');
              console.log('Lokasi {{QR_CODE}}:', qrCodeLocation);
              
              // 7. Susun request batch
              const requests = [];
              
              if (qrCodeLocation) {
                requests.push(
                  // Sisipkan gambar QR
                  {
                    insertInlineImage: {
                      location: { index: qrCodeLocation.start },
                      objectSize: {
                        height: { magnitude: 80, unit: 'PT' },
                        width: { magnitude: 80, unit: 'PT' }
                      },
                      uri: qrImageUrl
                    }
                  },
                  // Hapus teks {{QR_CODE}}
                  {
                    deleteContentRange: {
                      range: { 
                        startIndex: qrCodeLocation.start + 1, 
                        endIndex: qrCodeLocation.end + 1 
                      }
                    }
                  }
                );
              } else {
                console.warn('{{QR_CODE}} tidak ditemukan!');
                qrWarning = '\\n\\n⚠️ Peringatan: Teks {{QR_CODE}} tidak ditemukan di dokumen.';
              }
              
              // Replace {{NO_SURAT}}
              requests.push({
                replaceAllText: {
                  containsText: { text: '{{NO_SURAT}}', matchCase: true },
                  replaceText: docNumber
                }
              });
              
              // 8. Eksekusi batch update di dokumen copy
              await docs.documents.batchUpdate({
                documentId: newDocId,
                requestBody: { requests }
              });
              console.log('Berhasil update dokumen di folder pusat:', newFileUrl);
              
            } catch (docsErr) {
              console.error('Gagal copy/update Google Docs:', docsErr.message);
              qrWarning = '\\n\\n⚠️ Peringatan: Gagal memproses dokumen. ' + docsErr.message;
            }
          }
        } catch (docError) {
          console.error('Gagal proses dokumen:', docError.message);
          qrWarning = '\\n\\n⚠️ Peringatan: Gagal memproses dokumen otomatis. ' + docError.message;
        }

        clearSheetCache(CONFIG.SHEETS.REQUESTS);
        // Kirim email notifikasi ke User (pemohon)
        try {
          // Baca email user dari sheet Users berdasarkan username
          const requesterUsername = data[i][2]; // kolom requester_username
          const usersData = await readSheet(CONFIG.SHEETS.USERS);
          let userEmail = '';
          for (let u = 1; u < usersData.length; u++) {
            if (usersData[u][1] === requesterUsername) {
              userEmail = usersData[u][5]; // kolom email
              break;
            }
          }

          if (userEmail) {
            const html = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #059669; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                  <h2 style="margin: 0;">✅ Permintaan Disetujui!</h2>
                </div>
                <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
                  <p>Halo <strong>${data[i][1]}</strong>,</p>
                  <p>Permintaan tanda tangan Anda telah <strong style="color: #059669;">DISETUJUI</strong> oleh ${approverName} (${data[i][9]}).</p>
                  
                  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                    <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Nomor Surat</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${docNumber}</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Jenis Surat</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${docType}</td></tr>
                    <tr><td style="padding: 8px;"><strong>Tanggal Disetujui</strong></td><td style="padding: 8px;">${getWIBDate()}</td></tr>
                  </table>

                  ${qrWarning ? `<div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 12px; border-radius: 6px; margin: 16px 0; color: #92400e;">${qrWarning.replace(/\\n/g, '<br/>')}</div>` : ''}

                  <div style="text-align: center; margin-top: 24px;">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://qr-sign-systemgen.vercel.app'}/api/requests/${params.id}/pdf" 
                      style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                      📄 Download PDF Dokumen
                    </a>
                    <br/><br/>
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://qr-sign-systemgen.vercel.app'}/permintaan" 
                      style="color: #1d4ed8; font-size: 13px; text-decoration: none; font-weight: 600;">
                      Atau lihat detail di Dashboard →
                    </a>
                  </div>
                </div>
              </div>
            `;
            await sendEmail({ 
              to: userEmail, 
              subject: `Permintaan Disetujui: ${docType} - ${docNumber}`, 
              html 
            });
          }
        } catch (emailErr) {
          console.error('Gagal kirim email ke user:', emailErr.message);
        }

        await logActivity({
          requestId: params.id,
          actor: approverName,
          actorRole: 'atasan',
          activityType: 'KEPUTUSAN_PIMPINAN',
          description: `Disetujui oleh ${approverName} (${data[i][9]})`,
          details: qrWarning ? 'Dengan peringatan' : 'Sukses'
        });

        await logActivity({
          requestId: params.id,
          actor: 'Sistem',
          actorRole: 'system',
          activityType: 'PENERBITAN_NOMOR',
          description: `Nomor surat ${docNumber} diterbitkan`,
          details: `Jenis: ${docType}`
        });
        return NextResponse.json({ success: true, message: `Permintaan berhasil disetujui dengan Nomor Surat: ${docNumber}${qrWarning}` });
      }
    }
    return NextResponse.json({ success: false, message: 'Data tidak ditemukan' }, { status: 404 });
  } catch (e) {
    console.error('Error Approve:', e);
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}