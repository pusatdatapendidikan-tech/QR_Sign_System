import { appendRow } from './googleSheets';
import { CONFIG } from './config';
import { generateId, getWIBDate } from './utils';

/**
 * Tambah entry activity log
 */
export async function logActivity({ 
  requestId, 
  actor, 
  actorRole, 
  activityType, 
  description, 
  details = '' 
}) {
  try {
    const id = generateId();
    const timestamp = getWIBDate();
    
    await appendRow(CONFIG.SHEETS.ACTIVITY_LOG, [
      id,
      requestId,
      timestamp,
      actor,
      actorRole,
      activityType,
      description,
      details
    ]);
    
    return { success: true };
  } catch (e) {
    console.error('Gagal log aktivitas:', e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Mapping activity type ke label & warna badge
 */
export const ACTIVITY_TYPES = {
  PENGAJUAN: { label: 'Pengajuan', color: '#1d4ed8', bg: '#dbeafe' },
  PERUBAHAN_DOKUMEN: { label: 'Perubahan Dokumen', color: '#d97706', bg: '#fef3c7' },
  CATATAN_PEMERIKSAAN: { label: 'Catatan Pemeriksaan', color: '#ea580c', bg: '#ffedd5' },
  KEPUTUSAN_PIMPINAN: { label: 'Keputusan Pimpinan', color: '#059669', bg: '#d1fae5' },
  PENERBITAN_NOMOR: { label: 'Penerbitan Nomor', color: '#7c3aed', bg: '#ede9fe' },
  PENERUSKAN: { label: 'Peneruskan', color: '#0891b2', bg: '#cffafe' },
  PEMBATALAN: { label: 'Pembatalan', color: '#6b7280', bg: '#f3f4f6' },
};