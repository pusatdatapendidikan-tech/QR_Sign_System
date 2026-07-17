import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth } from '@/lib/googleSheets';

export async function GET() {
  try {
    const auth = getAuth();
    const drive = google.drive({ version: 'v3', auth });

    // 1. Hapus semua file di root Drive Service Account
    let pageToken = null;
    let deletedCount = 0;
    do {
      const res = await drive.files.list({
        spaces: 'drive',
        fields: 'nextPageToken, files(id, name)',
        pageToken: pageToken,
      });
      
      for (const file of res.data.files) {
        console.log(`Menghapus file: ${file.name} (${file.id})`);
        await drive.files.delete({ fileId: file.id });
        deletedCount++;
      }
      pageToken = res.data.nextPageToken;
    } while (pageToken);

    // 2. Kosongkan Trash (Sampah) Service Account
    await drive.files.emptyTrash();

    return NextResponse.json({ 
      success: true, 
      message: `Drive Service Account berhasil dibersihkan! ${deletedCount} file dihapus dan sampah dikosongkan.` 
    });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}