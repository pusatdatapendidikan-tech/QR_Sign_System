import { NextResponse } from 'next/server';
import { readSheet } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';
import { getSession } from '@/lib/auth';

export async function GET(req) {
  try {
    const session = await getSession();
    if (!session.user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    
    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role') || session.user.role;
    const userName = (searchParams.get('userName') || session.user.username || '').trim();
    const signerRole = (searchParams.get('signerRole') || session.user.signerRole || '').trim();
    
    const data = await readSheet(CONFIG.SHEETS.REQUESTS, false); // false = selalu fresh tanpa cache server
    
    let total = 0, menunggu = 0, diteruskan = 0, disetujui = 0, disetujuiUnread = 0, ditolak = 0;
    
    for (let i = 1; i < data.length; i++) {
      // Proteksi jika ada baris yang kosong di Google Sheets
      if (!data[i] || !data[i][0]) continue; 
      
      let include = false;
      const rowUserName = (data[i][2] || '').trim();
      const rowSignerRole = (data[i][9] || '').trim();
      
      if (role === 'admin') include = true;
      else if (role === 'atasan') include = (rowSignerRole === signerRole);
      else include = (rowUserName === userName);
      
      if (include) {
        total++;
        const st = (data[i][12] || '').trim(); // Hapus spasi tidak sengaja di status
        
        if (st === 'Menunggu') menunggu++;
        else if (st === 'Diteruskan') diteruskan++;
        else if (st === 'Disetujui') {
          disetujui++; // Ini untuk Card Dashboard (Total Disetujui)
          
          // Cek apakah belum dibaca khusus untuk Badge User
          if (role === 'user') {
            const readStatus = String(data[i][21] || '').trim().toUpperCase();
            const isRead = readStatus === 'TRUE';
            if (!isRead) {
              disetujuiUnread++; // Ini khusus untuk Badge Merah
            }
          }
        } else if (st === 'Ditolak') ditolak++;
      }
    }
    
    return NextResponse.json({
      success: true,
      data: { total, menunggu, diteruskan, disetujui, disetujuiUnread, ditolak },
    });
  } catch (e) {
    console.error('Dashboard API Error:', e); // Ini akan muncul di Vercel Logs jika error
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}