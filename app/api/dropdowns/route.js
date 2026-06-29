import { NextResponse } from 'next/server';
import { batchGetSheets } from '@/lib/googleSheets';
import { CONFIG, DEFAULT_SIGNERS } from '@/lib/config';

export async function GET() {
  try {
    // Kita HAPUS ensureSheets() di sini untuk menghemat kuota. 
    // Asumsikan sheet sudah dibuat via /api/init
    
    const ranges = [
      CONFIG.SHEETS.DIVISI, CONFIG.SHEETS.JABATAN, CONFIG.SHEETS.SIGNERS, 
      CONFIG.SHEETS.JENIS_SURAT, CONFIG.SHEETS.DEPARTEMEN_IM, CONFIG.SHEETS.NOMOR_SURAT
    ];
    
    const data = await batchGetSheets(ranges);

    const divisi = []; for (let i=1; i<data[CONFIG.SHEETS.DIVISI].length; i++) if(data[CONFIG.SHEETS.DIVISI][i][0]) divisi.push(data[CONFIG.SHEETS.DIVISI][i][0].trim());
    const jabatan = []; for (let i=1; i<data[CONFIG.SHEETS.JABATAN].length; i++) if(data[CONFIG.SHEETS.JABATAN][i][0]) jabatan.push(data[CONFIG.SHEETS.JABATAN][i][0].trim());
    const signers = []; for (let i=1; i<data[CONFIG.SHEETS.SIGNERS].length; i++) if(data[CONFIG.SHEETS.SIGNERS][i][0]) signers.push({jabatan: data[CONFIG.SHEETS.SIGNERS][i][0].trim(), nama: data[CONFIG.SHEETS.SIGNERS][i][1]?.trim(), email: data[CONFIG.SHEETS.SIGNERS][i][2]?.trim()});
    const jenisSurat = []; for (let i=1; i<data[CONFIG.SHEETS.JENIS_SURAT].length; i++) if(data[CONFIG.SHEETS.JENIS_SURAT][i][0]) jenisSurat.push({nama: data[CONFIG.SHEETS.JENIS_SURAT][i][0].trim(), format: data[CONFIG.SHEETS.JENIS_SURAT][i][1]?.trim()});
    const departemenIM = []; for (let i=1; i<data[CONFIG.SHEETS.DEPARTEMEN_IM].length; i++) if(data[CONFIG.SHEETS.DEPARTEMEN_IM][i][0]) departemenIM.push({nama: data[CONFIG.SHEETS.DEPARTEMEN_IM][i][0].trim(), kode: data[CONFIG.SHEETS.DEPARTEMEN_IM][i][1]?.trim()});
    const nomorSurat = []; for (let i=1; i<data[CONFIG.SHEETS.NOMOR_SURAT].length; i++) if(data[CONFIG.SHEETS.NOMOR_SURAT][i][0]) nomorSurat.push({jenisSurat: data[CONFIG.SHEETS.NOMOR_SURAT][i][0].trim(), bulan: parseInt(data[CONFIG.SHEETS.NOMOR_SURAT][i][1]), tahun: parseInt(data[CONFIG.SHEETS.NOMOR_SURAT][i][2]), nomorTerakhir: parseInt(data[CONFIG.SHEETS.NOMOR_SURAT][i][3]) || 0});

    return NextResponse.json({ 
      success: true, divisi, jabatan, signers: signers.length > 0 ? signers : DEFAULT_SIGNERS, jenisSurat, departemenIM, nomorSurat 
    });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}