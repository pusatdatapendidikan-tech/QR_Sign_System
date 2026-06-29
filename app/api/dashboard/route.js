import { NextResponse } from 'next/server';
import { ensureSheets, readSheet } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';
import { getSession } from '@/lib/auth';

export async function GET(req) {
  try {
    const session = await getSession();
    if (!session.user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    
    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role') || session.user.role;
    const userName = searchParams.get('userName') || session.user.username;
    const signerRole = searchParams.get('signerRole') || session.user.signerRole || '';
    
    const data = await readSheet(CONFIG.SHEETS.REQUESTS);
    let total = 0, menunggu = 0, diteruskan = 0, disetujui = 0, ditolak = 0;
    
    for (let i = 1; i < data.length; i++) {
      let include = false;
      if (role === 'admin') include = true;
      else if (role === 'atasan') include = (data[i][9] === signerRole);
      else include = (data[i][2] === userName);
      
      if (include) {
        total++;
        const st = data[i][12];
        if (st === 'Menunggu') menunggu++;
        else if (st === 'Diteruskan') diteruskan++;
        else if (st === 'Disetujui') {
          if (role === 'user') {
            const isRead = data[i][21] === true || data[i][21] === 'true';
            if (!isRead) disetujui++;
          } else {
            disetujui++;
          }
        } else if (st === 'Ditolak') ditolak++;
      }
    }
    
    return NextResponse.json({
      success: true,
      data: { total, menunggu, diteruskan, disetujui, ditolak },
    });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}