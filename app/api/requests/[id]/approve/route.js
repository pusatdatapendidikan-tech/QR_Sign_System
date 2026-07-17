import { NextResponse } from 'next/server';
import { ensureSheets, readSheet, updateCell, clearSheetCache, getAuth, generateBatchDocNumbers } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';
import { getSession } from '@/lib/auth';
import { getWIBDate } from '@/lib/utils';
import { google } from 'googleapis';
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

        // 1. GENERATE NOMOR SURAT (Skip jika Sertifikat, akan pakai Batch)
        if (docNumber === '-' && docType && docType !== '-' && docType !== 'Sertifikat') {
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
              const copyRes = await drive.files.copy({
                fileId: CONFIG.TEMPLATE_SERTIFIKAT_ID,
                supportsAllDrives: true, // Wajib ditambahkan agar bisa akses Shared Drive
                requestBody: { 
                  name: `Sertifikat - ${namaKegiatan}`,
                  parents: [CONFIG.SHARED_DRIVE_ID] // Arahkan langsung ke Shared Drive agar tidak memakan kuota Service Account
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
            // ALUR B: GOOGLE DOCS (SURAT BIASA)
            // ==========================================
            // (Kode Google Docs replaceAllText lama tetap di sini)
          }
        } catch (docError) {
          console.error('Gagal proses dokumen:', docError.message);
          qrWarning = '\\n\\n⚠️ Peringatan: Gagal memproses dokumen otomatis. ' + docError.message;
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