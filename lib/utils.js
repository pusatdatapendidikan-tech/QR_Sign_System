import { randomUUID } from 'crypto';
import { ROMAWI } from './config';

export function generateId() {
  return randomUUID().substring(0, 8) + Date.now().toString(36);
}

// --- FUNGSI BARU UNTUK MENDAPATKAN WAKTU WIB DI BACKEND ---
export function getWIBDate() {
  const wibString = new Date().toLocaleString('sv-SE', { 
    timeZone: 'Asia/Jakarta',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  return wibString.replace(' ', 'T'); // Hasil: YYYY-MM-DDTHH:mm:ss
}

// --- FUNGSI HELPER UNTUK PARSE KE WIB DI FRONTEND ---
function parseToWIB(date) {
  if (!date) return null;
  // Jika format berasal dari getWIBDate() (Tanpa Z di belakang), paksa ke WIB
  if (typeof date === 'string' && !date.endsWith('Z') && !date.includes('+')) {
    const parts = date.replace('T', ' ').split(/[- :]/);
    // parts: [YYYY, MM, DD, HH, mm, ss]
    return new Date(parts[0], parts[1]-1, parts[2], parts[3], parts[4], parts[5] || 0);
  }
  // Jika format lama (berakhiran Z / UTC), konversi ke WIB
  const utcDate = new Date(date);
  const wibTime = new Date(utcDate.getTime() + (7 * 60 * 60 * 1000));
  return wibTime;
}

export function formatDate(date) {
  if (!date) return '-';
  const d = parseToWIB(date);
  if (isNaN(d.getTime())) return '-';
  const m = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const hh = String(d.getHours()).padStart(2,'0');
  const mm = String(d.getMinutes()).padStart(2,'0');
  return `${d.getDate()} ${m[d.getMonth()]} ${d.getFullYear()} ${hh}:${mm}`;
}

export function formatDateLong(date) {
  if (!date) return '-';
  const d = parseToWIB(date);
  if (isNaN(d.getTime())) return '-';
  const hari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const bln = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  return `${hari[d.getDay()]}, ${d.getDate()} ${bln[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatTime(date) {
  if (!date) return '-';
  const d = parseToWIB(date);
  if (isNaN(d.getTime())) return '-';
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')} WIB`;
}

export function getDocIdFromUrl(url) {
  if (!url || url === '-') return null;
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

export function getPdfUrl(url) {
  const id = getDocIdFromUrl(url);
  if (!id) return null;
  return `https://docs.google.com/document/d/${id}/export?format=pdf`;
}

export function isGoogleDocs(url) {
  return url && url !== '-' && url.indexOf('docs.google.com') !== -1;
}

export function generateDocumentNumber(prefix, month, year, nextNum) {
  return String(nextNum).padStart(3,'0') + '/' + prefix + '/' + ROMAWI[month] + '/' + year;
}