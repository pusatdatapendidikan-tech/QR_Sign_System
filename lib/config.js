export const CONFIG = {
  SHEETS: {
    USERS: 'Users',
    REQUESTS: 'Requests',
    DIVISI: 'Divisi',
    JABATAN: 'Jabatan',
    SIGNERS: 'signers',
    NOMOR_SURAT: 'NomorSurat',
    JENIS_SURAT: 'JenisSurat',
    DEPARTEMEN_IM: 'DepartemenIM',
  },
  FOLDER_NAME: 'Upload_Surat_TandaTangan',
  COMPANY_NAME: process.env.COMPANY_NAME || 'PT Maju Mundur',
  LOGO_URL: process.env.LOGO_URL ||'https://i0.wp.com/greatedunesia.id/wp-content/uploads/2024/05/ico-ge.webp?w=495&ssl=1',
  APP_URL: process.env.APP_URL || 'http://localhost:3000',
};

export const ROMAWI = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];

export const DEFAULT_DIVISI = ['Direktorat','Keuangan','SDM','Operasional','Pemasaran','IT','Legal','Umum'];
export const DEFAULT_JABATAN = ['Direktur Utama','Wakil Direktur','Sekretaris','Kepala Bagian','Kepala Sub Bagian','Staff','Analis','Koordinator'];
export const DEFAULT_SIGNERS = [
  { jabatan:'Direktur', nama:'Direktur Utama', email:'direktur@perusahaan.com' },
  { jabatan:'Wakil Direktur', nama:'Wakil Direktur', email:'wakildirektur@perusahaan.com' },
  { jabatan:'Sekretaris', nama:'Sekretaris Perusahaan', email:'sekretaris@perusahaan.com' },
  { jabatan:'Kepala Bagian', nama:'Kepala Bagian', email:'kepalabagian@perusahaan.com' },
  { jabatan:'Kepala Sub Bagian', nama:'Kepala Sub Bagian', email:'kabag@perusahaan.com' },
];
export const DEFAULT_JENIS_SURAT = [
  { nama:'Surat Keluar', format:'YPUU' },
  { nama:'Internal Memo/IM', format:'IM' },
  { nama:'Surat Keputusan (SK)', format:'YPUU/SK' },
  { nama:'Surat Perjanjian Kerja Sama', format:'YPUU/SPK' },
  { nama:'MoU', format:'YPUU/MoU' },
  { nama:'Akad', format:'YPUU/AKAD' },
  { nama:'Berita Acara', format:'YPUU/BA' },
];
export const DEFAULT_DEPARTEMEN_IM = [
  { nama:'Strategic Partnership', kode:'YPUU-SP' },
  { nama:'Strategic Impact', kode:'YPUU-SI' },
  { nama:'Finance Accounting', kode:'YPUU-FA' },
  { nama:'Human Capital', kode:'YPUU-HC' },
  { nama:'General Affair', kode:'YPUU-GA' },
  { nama:'Holding', kode:'YPUU-DIR' },
];

export const HEADERS = {
  Users: ['id','username','password','name','role','email','created_at','signer_role','division','position','status','rejected_reason'],
  Requests: ['id','requester_name','requester_username','division','position','request_type','document_type','document_number','perihal','target_signer','file_url','file_name','status','approved_by','approved_at','rejected_by','rejected_at','rejection_reason','created_at','forwarded_by','forwarded_at','read_by_requester'],
  Divisi: ['nama'],
  Jabatan: ['nama'],
  signers: ['Jabatan','Nama','Email'],
  NomorSurat: ['JenisSurat','Bulan','Tahun','NomorTerakhir'],
  JenisSurat: ['Nama','FormatNomor'],
  DepartemenIM: ['Nama','Kode'],
  DocType: ['No','ID','Nomor Surat','Pemohon','Divisi','Jabatan','Jenis Permintaan','Tujuan TTD','Departemen','Status','Tanggal'],
};