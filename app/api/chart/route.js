import { NextResponse } from 'next/server';
import { ensureSheets, readSheet } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';
import { getSession } from '@/lib/auth';

export async function GET(req) {
  try {
    const session = await getSession();
    if (!session.user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    
    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get('year'));
    const month = searchParams.get('month');
    const filterMonth = month === '-1' || !month ? -1 : parseInt(month);
    const role = session.user.role;
    const userName = session.user.username;
    const signerRole = session.user.signerRole || '';
    
    const data = await readSheet(CONFIG.SHEETS.REQUESTS);
    const moShort = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    
    if (filterMonth === -1) {
      const months = {};
      for (let m = 0; m < 12; m++) months[m] = { menunggu:0, diteruskan:0, disetujui:0, ditolak:0 };
      
      for (let i = 1; i < data.length; i++) {
        let include = false;
        if (role === 'admin') include = true;
        else if (role === 'atasan') include = (data[i][9] === signerRole);
        else include = (data[i][2] === userName);
        
        if (include) {
          const c = new Date(data[i][18]);
          if (c.getFullYear() === year) {
            const mk = c.getMonth();
            const st = data[i][12];
            if (st === 'Menunggu') months[mk].menunggu++;
            else if (st === 'Diteruskan') months[mk].diteruskan++;
            else if (st === 'Disetujui') months[mk].disetujui++;
            else if (st === 'Ditolak') months[mk].ditolak++;
          }
        }
      }
      
      return NextResponse.json({
        success: true,
        labels: moShort,
        menunggu: moShort.map((_, k) => months[k].menunggu),
        diteruskan: moShort.map((_, k) => months[k].diteruskan),
        disetujui: moShort.map((_, k) => months[k].disetujui),
        ditolak: moShort.map((_, k) => months[k].ditolak),
      });
    } else {
      const mn = filterMonth;
      const daysInMonth = new Date(year, mn + 1, 0).getDate();
      const days = {};
      for (let dd = 1; dd <= daysInMonth; dd++) days[dd] = { menunggu:0, diteruskan:0, disetujui:0, ditolak:0 };
      
      for (let i = 1; i < data.length; i++) {
        let include = false;
        if (role === 'admin') include = true;
        else if (role === 'atasan') include = (data[i][9] === signerRole);
        else include = (data[i][2] === userName);
        
        if (include) {
          const c = new Date(data[i][18]);
          if (c.getFullYear() === year && c.getMonth() === mn) {
            const day = c.getDate();
            if (days[day]) {
              const st = data[i][12];
              if (st === 'Menunggu') days[day].menunggu++;
              else if (st === 'Diteruskan') days[day].diteruskan++;
              else if (st === 'Disetujui') days[day].disetujui++;
              else if (st === 'Ditolak') days[day].ditolak++;
            }
          }
        }
      }
      
      const labels = [];
      for (let dd = 1; dd <= daysInMonth; dd++) labels.push(`${dd} ${moShort[mn]}`);
      
      return NextResponse.json({
        success: true,
        labels,
        menunggu: labels.map((_, k) => days[k+1].menunggu),
        diteruskan: labels.map((_, k) => days[k+1].diteruskan),
        disetujui: labels.map((_, k) => days[k+1].disetujui),
        ditolak: labels.map((_, k) => days[k+1].ditolak),
      });
    }
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}