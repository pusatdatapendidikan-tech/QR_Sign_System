import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth } from '@/lib/googleSheets';

export async function GET() {
  try {
    const auth = getAuth();
    const drive = google.drive({ version: 'v3', auth });
    
    let pageToken = null;
    let deletedCount = 0;
    let failedCount = 0;
    let failedFiles = [];
    
    do {
      // List semua file di Drive SA (exclude folder)
      const res = await drive.files.list({
        spaces: 'drive',
        fields: 'nextPageToken, files(id, name, mimeType)',
        q: "mimeType != 'application/vnd.google-apps.folder'",
        pageToken: pageToken,
      });
      
      for (const file of res.data.files) {
        try {
          console.log(`Menghapus file: ${file.name} (${file.id})`);
          await drive.files.delete({ 
            fileId: file.id,
            supportsAllDrives: true 
          });
          deletedCount++;
        } catch (delErr) {
          console.warn(`Gagal hapus ${file.name}: ${delErr.message}`);
          failedCount++;
          failedFiles.push({ name: file.name, id: file.id, error: delErr.message });
        }
      }
      pageToken = res.data.nextPageToken;
    } while (pageToken);
    
    // Kosongkan trash
    try {
      await drive.files.emptyTrash();
      console.log('Trash berhasil dikosongkan');
    } catch (trashErr) {
      console.warn('Gagal empty trash:', trashErr.message);
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Pembersihan selesai! ${deletedCount} file berhasil dihapus, ${failedCount} file gagal.`,
      details: {
        deleted: deletedCount,
        failed: failedCount,
        failedFiles: failedFiles
      }
    });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}