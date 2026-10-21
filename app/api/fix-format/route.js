import { NextResponse } from 'next/server';
import { getSheets, getSpreadsheetId, CONFIG } from '@/lib/googleSheets';
import { google } from 'googleapis';
import { getAuth } from '@/lib/googleSheets';

export async function GET() {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = getSpreadsheetId();
    
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = meta.data.sheets.find(s => s.properties.title === 'Requests');
    
    // Clear format untuk semua baris kecuali baris 1 (header)
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          repeatCell: {
            range: { 
              sheetId: sheet.properties.sheetId, 
              startRowIndex: 1, // Mulai dari baris 2
              endRowIndex: sheet.properties.gridProperties.rowCount,
            },
            cell: { 
              userEnteredFormat: { 
                textFormat: { bold: false },
                backgroundColor: { red: 1, green: 1, blue: 1 }
              } 
            },
            fields: 'userEnteredFormat(textFormat,backgroundColor)',
          },
        }],
      },
    });
    
    return NextResponse.json({ success: true, message: 'Semua baris data sudah dibersihkan!' });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}