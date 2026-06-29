import { NextResponse } from 'next/server';
import { ensureSheets, readSheet } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';
import { formatDate, formatDateLong, formatTime } from '@/lib/utils';

async function getSigners() {
  const data = await readSheet(CONFIG.SHEETS.SIGNERS);
  const list = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      list.push({
        jabatan: data[i][0].trim(),
        nama: (data[i][1] || '').trim(),
        email: (data[i][2] || '').trim(),
      });
    }
  }
  return list;
}

export async function GET(req, { params }) {
  try {
    await ensureSheets();
    const data = await readSheet(CONFIG.SHEETS.REQUESTS);
    const signers = await getSigners();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === params.id) {
        const targetSigner = data[i][9];
        let signerTitle = targetSigner;
        const signerData = signers.find(s => s.jabatan === targetSigner);
        if (signerData) signerTitle = signerData.nama;
        
        return NextResponse.json({
          success: true,
          data: {
            documentType: data[i][6],
            documentNumber: data[i][7],
            perihal: data[i][8],
            requesterName: data[i][1],
            division: data[i][3],
            position: data[i][4],
            approvedBy: data[i][13],
            signerTitle,
            companyName: CONFIG.COMPANY_NAME,
            approvedAt: data[i][14] ? formatDate(data[i][14]) : '-',
            approvedAtLong: data[i][14] ? formatDateLong(data[i][14]) : '-',
            approvedAtTime: data[i][14] ? formatTime(data[i][14]) : '-',
            fileUrl: data[i][10],
            fileName: data[i][11],
            logoUrl: CONFIG.LOGO_URL,
          },
        });
      }
    }
    return NextResponse.json({ success: false }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}