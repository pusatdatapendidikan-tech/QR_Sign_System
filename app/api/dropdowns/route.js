import { NextResponse } from 'next/server';
import { ensureSheets, readSheet } from '@/lib/googleSheets';
import { CONFIG, DEFAULT_SIGNERS } from '@/lib/config';

export async function GET() {
  try {
    await ensureSheets();
    
    const [divisiData, jabatanData, signersData, jsData, depData, nsData] = await Promise.all([
      readSheet(CONFIG.SHEETS.DIVISI),
      readSheet(CONFIG.SHEETS.JABATAN),
      readSheet(CONFIG.SHEETS.SIGNERS),
      readSheet(CONFIG.SHEETS.JENIS_SURAT),
      readSheet(CONFIG.SHEETS.DEPARTEMEN_IM),
      readSheet(CONFIG.SHEETS.NOMOR_SURAT),
    ]);

    const divisi = []; for (let i=1; i<divisiData.length; i++) if(divisiData[i][0]) divisi.push(divisiData[i][0].trim());
    const jabatan = []; for (let i=1; i<jabatanData.length; i++) if(jabatanData[i][0]) jabatan.push(jabatanData[i][0].trim());
    const signers = []; for (let i=1; i<signersData.length; i++) if(signersData[i][0]) signers.push({jabatan: signersData[i][0].trim(), nama: signersData[i][1]?.trim(), email: signersData[i][2]?.trim()});
    const jenisSurat = []; for (let i=1; i<jsData.length; i++) if(jsData[i][0]) jenisSurat.push({nama: jsData[i][0].trim(), format: jsData[i][1]?.trim()});
    const departemenIM = []; for (let i=1; i<depData.length; i++) if(depData[i][0]) departemenIM.push({nama: depData[i][0].trim(), kode: depData[i][1]?.trim()});
    const nomorSurat = []; for (let i=1; i<nsData.length; i++) if(nsData[i][0]) nomorSurat.push({jenisSurat: nsData[i][0].trim(), bulan: parseInt(nsData[i][1]), tahun: parseInt(nsData[i][2]), nomorTerakhir: parseInt(nsData[i][3]) || 0});

    return NextResponse.json({ 
      success: true,
      divisi, 
      jabatan, 
      signers: signers.length > 0 ? signers : DEFAULT_SIGNERS, 
      jenisSurat, 
      departemenIM, 
      nomorSurat 
    });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}