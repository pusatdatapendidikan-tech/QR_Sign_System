import { randomUUID } from 'crypto';
import { ROMAWI } from './config';

export function generateId() {
  return randomUUID().substring(0, 8) + Date.now().toString(36);
}

export function formatDate(date) {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  const m = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const hh = String(d.getHours()).padStart(2,'0');
  const mm = String(d.getMinutes()).padStart(2,'0');
  return `${d.getDate()} ${m[d.getMonth()]} ${d.getFullYear()} ${hh}:${mm}`;
}

export function formatDateLong(date) {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  const hari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const bln = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  return `${hari[d.getDay()]}, ${d.getDate()} ${bln[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatTime(date) {
  if (!date) return '-';
  const d = new Date(date);
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