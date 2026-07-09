'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/lib/useAuth';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';

export default function PermintaanPage() {
  const { user, loading } = useAuth();
  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 8;
  
  const [divisi, setDivisi] = useState([]);
  const [jabatan, setJabatan] = useState([]);
  const [signers, setSigners] = useState([]);
  const [jenisSurat, setJenisSurat] = useState([]);
  const [departemenIM, setDepartemenIM] = useState([]);
  const [nomorSurat, setNomorSurat] = useState([]);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState('');
  const [form, setForm] = useState({ nama:'', divisi:'', jabatan:'', jenisSurat:'', nomorSurat:'', perihal:'', tujuanTtd:'', namaSigner:'', docLink:'', departemen:'' });

  useEffect(() => {
    if (user) {
      loadDropdowns();
      loadRequests(user);
    }
  }, [user]);

  const loadDropdowns = async () => {
    const res = await fetch('/api/dropdowns').then(r => r.json());
    if (res.success) {
      setDivisi(res.divisi); 
      setJabatan(res.jabatan); 
      setSigners(res.signers); 
      setJenisSurat(res.jenisSurat); 
      setDepartemenIM(res.departemenIM); 
      setNomorSurat(res.nomorSurat);
    }
  };

  const loadRequests = async (u) => {
    const res = await fetch(`/api/requests?role=${u.role}&userName=${u.username}&signerRole=${u.signerRole||''}`, {
      cache: 'no-store' // <--- TAMBAHKAN INI AGAR TIDAK DI-CACHE
    }).then(r => r.json());
    if (res.success) setRequests(res.data);
  };

  const handleOpenDoc = async (id, url) => {
    window.open(url, '_blank');
    try {
      // Tandai sebagai sudah dibaca di database
      await fetch(`/api/requests/${id}/read`, { method: 'POST' });
      // Update state lokal agar tombol/ikon langsung berubah tanpa reload
      setRequests(prev => prev.map(r => r.id === id ? { ...r, readByRequester: true } : r));
      window.dispatchEvent(new Event('badge-update'));
    } catch (e) {}
  };

  const onDocTypeChange = (docType) => {
    let newForm = { ...form, jenisSurat: docType, nomorSurat:'', departemen: docType === 'Internal Memo/IM' ? form.departemen : '' };
    if (!docType) { setForm(newForm); return; }
    
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const ROMAWI = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
    
    if (docType === 'Internal Memo/IM') {
      const dept = form.departemen;
      if (!dept) { setForm({...newForm, nomorSurat:'(pilih departemen)'}); return; }
      const dep = departemenIM.find(d => d.nama === dept);
      if (!dep) { setForm({...newForm, nomorSurat:'(kode dept belum diatur)'}); return; }
      const prefix = dep.kode + '/IM';
      const counterKey = `${docType} - ${dept}`;

      // ✅ FIX: Cari nomor tertinggi di tahun berjalan, abaikan bulan
      let maxNum = 0;
      for (const ns of nomorSurat) {
        if (ns.jenisSurat === counterKey && ns.tahun === year) {
          const currentNum = parseInt(ns.nomorTerakhir) || 0;
          if (currentNum > maxNum) maxNum = currentNum;
        }
      }
      const nextNum = maxNum + 1;

      newForm.nomorSurat = String(nextNum).padStart(3,'0') + '/' + prefix + '/' + ROMAWI[month] + '/' + year;
    } else {
      const found = jenisSurat.find(j => j.nama === docType);
      if (!found || !found.format || found.format === 'IM') { setForm({...newForm, nomorSurat:'(format belum diatur)'}); return; }

      // ✅ FIX: Cari nomor tertinggi di tahun berjalan, abaikan bulan
      let maxNum = 0;
      for (const ns of nomorSurat) {
        if (ns.jenisSurat === docType && ns.tahun === year) {
          const currentNum = parseInt(ns.nomorTerakhir) || 0;
          if (currentNum > maxNum) maxNum = currentNum;
        }
      }
      const nextNum = maxNum + 1;

      newForm.nomorSurat = String(nextNum).padStart(3,'0') + '/' + found.format + '/' + ROMAWI[month] + '/' + year;
    }
    setForm(newForm);
  };

  const onDeptChange = (dept) => {
    setForm({ ...form, departemen: dept });
    setTimeout(() => onDocTypeChange(form.jenisSurat), 100);
  };

  const onSignerChange = (jabatan) => {
    const found = signers.find(s => s.jabatan === jabatan);
    setForm({ ...form, tujuanTtd: jabatan, namaSigner: found ? found.nama : '' });
  };

  const submitForm = async () => {
    if (!form.jenisSurat) { Swal.fire({icon:'warning', title:'Perhatian', text:'Pilih jenis surat', confirmButtonColor:'#1d4ed8'}); return; }
    if (form.jenisSurat === 'Internal Memo/IM' && !form.departemen) { Swal.fire({icon:'warning', title:'Perhatian', text:'Pilih departemen', confirmButtonColor:'#1d4ed8'}); return; }
    if (!form.tujuanTtd) { Swal.fire({icon:'warning', title:'Perhatian', text:'Pilih tujuan tanda tangan', confirmButtonColor:'#1d4ed8'}); return; }

    const confirmAccess = await Swal.fire({
  title: 'Konfirmasi Akses Dokumen',
  html: 'Apakah Anda sudah mengatur Sharing dokumen ke <strong>Anyone with the link = Editor</strong>?<br/><br/><small>Jika belum, QR Code tidak bisa disisipkan.</small>',
  icon: 'warning',
  showCancelButton: true,
  confirmButtonText: 'Ya, Sudah Editor!',
  cancelButtonText: 'Belum, Cek Dulu',
  confirmButtonColor: '#059669'
});

if (!confirmAccess.isConfirmed) {
  return; // Batalkan submit jika user belum yakin
}
    
    Swal.fire({ title:'Mengirim...', allowOutsideClick:false, didOpen: () => Swal.showLoading() });
    
    try {
      const payload = {
        requesterName: form.nama || user.name,
        requesterUsername: user.username,
        division: form.divisi || user.division,
        position: form.jabatan || user.position,
        requestType: 'Tanda Tangan',
        documentType: form.jenisSurat,
        documentNumber: '-',
        departemen: form.departemen || '',
        perihal: form.perihal || '-',
        targetSigner: form.tujuanTtd,
        fileUrl: form.docLink,
        fileName: 'Google Docs Template',
      };
      
      let res;
      if (editId) {
        res = await fetch(`/api/requests/${editId}`, {
          method:'PUT', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({
            documentType: form.jenisSurat, documentNumber: form.nomorSurat,
            perihal: form.perihal || '-', targetSigner: form.tujuanTtd, requestType:'Tanda Tangan',
          }),
        }).then(r => r.json());
      } else {
        if (!form.docLink || form.docLink.indexOf('docs.google.com') === -1) {
          Swal.close();
          Swal.fire({icon:'warning', title:'Perhatian', text:'Masukkan link Google Docs yang valid', confirmButtonColor:'#1d4ed8'});
          return;
        }
        res = await fetch('/api/requests', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify(payload),
        }).then(r => r.json());
      }
      
      Swal.close();
      if (res.success) {
        Swal.fire({icon:'success', title:'Berhasil', text:res.message, timer:1500, showConfirmButton:false});
        setShowForm(false);
        setEditId('');
        setForm({ nama:'', divisi:'', jabatan:'', jenisSurat:'', nomorSurat:'', perihal:'', tujuanTtd:'', namaSigner:'', docLink:'', departemen:'' });
        loadRequests(user);
      } else {
        Swal.fire({icon:'error', title:'Gagal', text:res.message, confirmButtonColor:'#1d4ed8'});
      }
    } catch (e) {
      Swal.close();
      Swal.fire({icon:'error', title:'Error', text:String(e), confirmButtonColor:'#1d4ed8'});
    }
  };

  const doForward = async (id) => {
    const req = requests.find(r => r.id === id);
    Swal.fire({
      title:`Teruskan ke ${req.targetSigner}?`,
      html:`Permintaan dari <strong>${req.requesterName}</strong> akan diteruskan.`,
      icon:'question', showCancelButton:true, confirmButtonText:'Ya, Teruskan', cancelButtonText:'Batal', confirmButtonColor:'#7c3aed',
    }).then(async r => {
      if (r.isConfirmed) {
        Swal.fire({ title:'Meneruskan...', allowOutsideClick:false, didOpen: () => Swal.showLoading() });
        const res = await fetch(`/api/requests/${id}/forward`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ forwarderName: user.name, targetSigner: req.targetSigner }),
        }).then(r => r.json());
        Swal.close();
        if (res.success) { 
          Swal.fire({icon:'success', title:'Diteruskan', text:res.message, timer:1500, showConfirmButton:false}); 
          loadRequests(user); 
          window.dispatchEvent(new Event('badge-update')); // <-- TAMBAHKAN INI
        }
        else Swal.fire({icon:'error', title:'Gagal', text:res.message, confirmButtonColor:'#1d4ed8'});
      }
    });
  };

  const doApprove = async (id) => {
    Swal.fire({ title:'Setujui Permintaan?', icon:'question', showCancelButton:true, confirmButtonText:'Ya, Setujui', cancelButtonText:'Batal', confirmButtonColor:'#059669' })
      .then(async r => {
        if (r.isConfirmed) {
          Swal.fire({ title:'Memproses...', allowOutsideClick:false, didOpen: () => Swal.showLoading() });
          const res = await fetch(`/api/requests/${id}/approve`, {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ approverName: user.name }),
          }).then(r => r.json());
          Swal.close();
          if (res.success) { 
            Swal.fire({icon:'success', title:'Disetujui', text:res.message, timer:1500, showConfirmButton:false}); 
            loadRequests(user); 
            // BARIS INI YANG MEMBUAT BADGE LANGSUNG HILANG SAAT SETUJUI
            window.dispatchEvent(new Event('badge-update')); 
          }
          else Swal.fire({icon:'error', title:'Gagal', text:res.message, confirmButtonColor:'#1d4ed8'});
        }
      });
  };

  const doReject = async (id) => {
    Swal.fire({
      title:'Tolak Permintaan?', text:'Status akan berubah menjadi Ditolak', icon:'warning',
      showCancelButton:true, confirmButtonText:'Ya, Tolak', cancelButtonText:'Batal', confirmButtonColor:'#dc2626',
      input:'textarea', inputLabel:'Alasan penolakan (opsional)', inputPlaceholder:'Tulis alasan...',
    }).then(async r => {
      if (r.isConfirmed) {
        Swal.fire({ title:'Memproses...', allowOutsideClick:false, didOpen: () => Swal.showLoading() });
        const res = await fetch(`/api/requests/${id}/reject`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ rejecterName: `${user.name} (${user.role === 'atasan' ? 'Atasan' : 'Admin'})`, reason: r.value || '-' }),
        }).then(r => r.json());
        Swal.close();
        if (res.success) { 
          Swal.fire({icon:'success', title:'Ditolak', text:res.message, timer:1500, showConfirmButton:false}); 
          loadRequests(user); 
          window.dispatchEvent(new Event('badge-update')); // <-- TAMBAHKAN INI
        }
        else Swal.fire({icon:'error', title:'Gagal', text:res.message, confirmButtonColor:'#1d4ed8'});
      }
    });
  };

  const doDelete = async (id) => {
    Swal.fire({ title:'Hapus Data?', text:'Tidak dapat dikembalikan', icon:'warning', showCancelButton:true, confirmButtonText:'Ya, Hapus', cancelButtonText:'Batal', confirmButtonColor:'#dc2626' })
      .then(async r => {
        if (r.isConfirmed) {
          Swal.fire({ title:'Menghapus...', allowOutsideClick:false, didOpen: () => Swal.showLoading() });
          const res = await fetch(`/api/requests/${id}`, { method:'DELETE' }).then(r => r.json());
          Swal.close();
          if (res.success) { 
          Swal.fire({icon:'success', title:'Dihapus', text:res.message, timer:1500, showConfirmButton:false}); 
          loadRequests(user); 
          window.dispatchEvent(new Event('badge-update')); // <-- TAMBAHKAN INI
        }
          else Swal.fire({icon:'error', title:'Gagal', text:res.message, confirmButtonColor:'#1d4ed8'});
        }
      });
  };

  const openEdit = (req) => {
    setEditId(req.id);
    setForm({
      nama: req.requesterName, divisi: req.division === '-' ? '' : req.division,
      jabatan: req.position === '-' ? '' : req.position,
      jenisSurat: req.documentType === '-' ? '' : req.documentType,
      nomorSurat: req.documentNumber === '-' ? '' : req.documentNumber,
      perihal: req.perihal === '-' ? '' : req.perihal,
      tujuanTtd: req.targetSigner === '-' ? '' : req.targetSigner,
      namaSigner: signers.find(s => s.jabatan === req.targetSigner)?.nama || '',
      docLink: req.fileUrl !== '-' ? req.fileUrl : '', departemen:'',
    });
    setShowForm(true);
  };

  const openAdd = () => {
    setEditId('');
    setForm({ nama:'', divisi:user.division === '-' ? '' : user.division, jabatan:user.position === '-' ? '' : user.position, jenisSurat:'', nomorSurat:'', perihal:'', tujuanTtd:'', namaSigner:'', docLink:'', departemen:'' });
    setShowForm(true);
  };

  const statusBadge = (s) => {
    const cls = s === 'Menunggu' ? 'status-menunggu' : s === 'Diteruskan' ? 'status-diteruskan' : s === 'Disetujui' ? 'status-disetujui' : 'status-ditolak';
    return <span className={`status-badge ${cls}`}>{s}</span>;
  };

  // FUNGSI EXPORT EXCEL
  const exportExcel = () => {
    if (filtered.length === 0) { 
      Swal.fire({icon:'info', title:'Info', text:'Tidak ada data untuk diexport', confirmButtonColor:'#1d4ed8'}); 
      return; 
    }
    
    const ws_data = [
      ['No', 'Pemohon', 'Divisi', 'Jabatan', 'Jenis Permintaan', 'Jenis Surat', 'Nomor Surat', 'Perihal', 'Tujuan TTD', 'Status', 'Tanggal Pengajuan', 'Diteruskan Oleh', 'Disetujui/Ditolak Oleh', 'Alasan']
    ];
    
    filtered.forEach((r, i) => {
      ws_data.push([
        i + 1, r.requesterName, r.division, r.position, r.requestType, 
        r.documentType, r.documentNumber, r.perihal || '-', r.targetSigner, r.status, 
        r.createdAt, r.forwardedBy, (r.approvedBy || r.rejectedBy || '-'), 
        r.rejectionReason || '-'
      ]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(ws_data);

    ws['!cols'] = [
      {wch: 4}, {wch: 20}, {wch: 15}, {wch: 20}, {wch: 18}, 
      {wch: 22}, {wch: 25}, {wch: 30}, {wch: 22}, {wch: 12}, 
      {wch: 25}, {wch: 20}, {wch: 25}, {wch: 30}
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Data Permintaan");
    XLSX.writeFile(wb, 'Data_Permintaan.xlsx');
    
    Swal.fire({icon:'success', title:'Berhasil', text:'File Excel berhasil diunduh', timer:1500, showConfirmButton:false});
  };

  const filtered = requests.filter(r => {
    const q = search.toLowerCase();
    return r.requesterName.toLowerCase().includes(q) || r.division.toLowerCase().includes(q) ||
           r.requestType.toLowerCase().includes(q) || r.status.toLowerCase().includes(q) ||
           (r.documentNumber || '-').toLowerCase().includes(q);
  });
  const totalPages = Math.ceil(filtered.length / pageSize);
  const pageData = filtered.slice((page-1)*pageSize, page*pageSize);

  if (!user) {
    return <div className="spinner-wrap"><div className="spinner-box"><div className="spinner"></div><p>Memuat sesi...</p></div></div>;
  }

  if (loading) {
    return (
      <Layout user={user}>
        <div className="inline-loading">
          <div className="spinner-border" role="status"></div>
          <p>Memuat data permintaan...</p>
        </div>
      </Layout>
    );
  }

  // USER VIEW
  if (user.role === 'user') {
    return (
      <Layout user={user}>
        <div className="mb-3">
          <button className="btn-primary-custom" onClick={() => showForm ? setShowForm(false) : openAdd()}>
            <i className={`bi ${showForm ? 'bi-x-circle' : 'bi-plus-circle'}`}></i>{showForm ? 'Tutup Form' : 'Tambah Permintaan'}
          </button>
        </div>
        {showForm && (
          <div className="form-card mb-4">
            <div className="form-header">
              <h6><i className="bi bi-plus-circle me-2"></i>{editId ? 'Edit Permintaan' : 'Form Permintaan'}</h6>
              <p>Isi form berikut untuk mengajukan permintaan tanda tangan</p>
            </div>
            <div className="form-body">
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Nama Pemohon</label>
                  <input type="text" className="form-control" value={form.nama || user.name} onChange={e => setForm({...form, nama: e.target.value})} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Divisi</label>
                  <select className="form-select" value={form.divisi} onChange={e => setForm({...form, divisi: e.target.value})}>
                    <option value="">-- Pilih --</option>
                    {divisi.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Jabatan</label>
                  <select className="form-select" value={form.jabatan} onChange={e => setForm({...form, jabatan: e.target.value})}>
                    <option value="">-- Pilih --</option>
                    {jabatan.map(j => <option key={j} value={j}>{j}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-3 pt-3" style={{borderTop:'1px solid var(--border-color)'}}>
                <h6 style={{fontSize:14,fontWeight:700,color:'var(--primary)',marginBottom:16}}><i className="bi bi-file-earmark-text me-2"></i>Data Surat</h6>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Jenis Surat</label>
                    <select className="form-select" value={form.jenisSurat} onChange={e => onDocTypeChange(e.target.value)}>
                      <option value="">-- Pilih --</option>
                      {jenisSurat.map(j => <option key={j.nama} value={j.nama}>{j.nama}</option>)}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Nomor Surat</label>
                    <input type="text" className="form-control" value={form.nomorSurat} readOnly style={{background:'#f0fdf4',fontWeight:600,color:'#065f46'}} />
                  </div>
                  {form.jenisSurat === 'Internal Memo/IM' && (
                    <div className="col-md-6">
                      <label className="form-label">Departemen</label>
                      <select className="form-select" value={form.departemen} onChange={e => onDeptChange(e.target.value)}>
                        <option value="">-- Pilih --</option>
                        {departemenIM.map(d => <option key={d.nama} value={d.nama}>{d.nama}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="col-12">
                    <label className="form-label">Perihal</label>
                    <input type="text" className="form-control" value={form.perihal} onChange={e => setForm({...form, perihal: e.target.value})} placeholder="Tulis perihal surat..." />
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3" style={{borderTop:'1px solid var(--border-color)'}}>
                <h6 style={{fontSize:14,fontWeight:700,color:'var(--primary)',marginBottom:16}}><i className="bi bi-pen me-2"></i>Data Tanda Tangan</h6>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Tujuan Tanda Tangan</label>
                    <select className="form-select" value={form.tujuanTtd} onChange={e => onSignerChange(e.target.value)}>
                      <option value="">-- Pilih --</option>
                      {signers.map(s => <option key={s.jabatan} value={s.jabatan}>{s.jabatan}</option>)}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Nama Penandatangan</label>
                    <input type="text" className="form-control" value={form.namaSigner} readOnly style={{background:'#f8fafc'}} />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Link Google Docs (Template Surat)</label>
                      <div style={{background:'#fffbeb',border:'1px solid #fcd34d',borderRadius:8,padding:'12px 16px',marginBottom:8}}>
                        <p style={{fontSize:12,color:'#92400e',margin:'0 0 8px 0',lineHeight:1.6, fontWeight: 600}}>
                          <i className="bi bi-exclamation-triangle-fill me-1"></i>WAJIB ATUR AKSES DOKUMEN!
                        </p>
                        <p style={{fontSize:12,color:'#92400e',margin:0,lineHeight:1.6}}>
                          1. Klik <strong>Share/Bagikan</strong> di Google Docs Anda.<br/>
                          2. Ubah akses menjadi <strong style={{background:'#fef3c7',padding:'1px 6px',borderRadius:4}}>Anyone with the link = Editor</strong>.<br/>
                          <em style={{fontSize:11, opacity:0.8}}>(Jika tidak diatur ke Editor, sistem gagal menyisipkan QR Code saat disetujui)</em>
                        </p>
                        <hr style={{borderColor:'#fde68a', margin:'8px 0'}}/>
                        <p style={{fontSize:12,color:'#0369a1',margin:0,lineHeight:1.6}}>
                          <i className="bi bi-info-circle me-1"></i>Pastikan template surat memiliki penanda <strong style={{background:'#dbeafe',padding:'1px 6px',borderRadius:4}}>{'{'}{'}QR_CODE{'}{'}'}</strong> di area tanda tangan.
                        </p>
                      </div>
                    <input type="url" className="form-control" value={form.docLink} onChange={e => setForm({...form, docLink: e.target.value})} placeholder="https://docs.google.com/document/d/..." />
                  </div>
                </div>
              </div>
              <div className="mt-4 text-end">
                <button className="btn-primary-custom" onClick={submitForm}><i className="bi bi-send"></i>{editId ? 'Update' : 'Kirim Permintaan'}</button>
              </div>
            </div>
          </div>
        )}
        <h6 style={{fontWeight:700,fontSize:16,marginBottom:16}}><i className="bi bi-clock-history me-2" style={{color:'var(--primary)'}}></i>Riwayat Permintaan</h6>
        {requests.length === 0 ? (
          <div className="empty-state"><i className="bi bi-inbox"></i><p>Belum ada riwayat permintaan</p></div>
        ) : (
          requests.map(r => (
            <div key={r.id} className="history-card">
              <div className="hc-top"><div className="hc-title">{r.requestType}</div>{statusBadge(r.status)}</div>
              <div className="hc-meta">
                {r.documentType !== '-' && <div className="hc-meta-item"><span>Jenis Surat: </span><strong>{r.documentType}</strong></div>}
                {r.documentNumber !== '-' && <div className="hc-meta-item"><span>No. Surat: </span><strong>{r.documentNumber}</strong></div>}
                {r.perihal && r.perihal !== '-' && <div className="hc-meta-item"><span>Perihal: </span><strong>{r.perihal}</strong></div>}
                {r.targetSigner !== '-' && <div className="hc-meta-item"><span>Tujuan TTD: </span><strong>{r.targetSigner}</strong></div>}
                <div className="hc-meta-item"><span>Tanggal: </span><strong>{r.createdAt}</strong></div>
              </div>
              {r.status === 'Menunggu' && <div className="hc-status-note" style={{borderLeftColor:'var(--warning)',background:'var(--warning-bg)'}}><i className="bi bi-clock me-1"></i>Permintaan sedang menunggu review oleh Admin.</div>}
              {r.status === 'Diteruskan' && <div className="hc-status-note note-diteruskan"><i className="bi bi-share me-1"></i>Diteruskan oleh <strong>{r.forwardedBy}</strong> kepada <strong>{r.targetSigner}</strong>.</div>}
              {r.status === 'Disetujui' && <div className="hc-status-note note-disetujui"><i className="bi bi-check-circle me-1" style={{color:'var(--success)'}}></i>Disetujui oleh {r.approvedBy} pada {r.approvedAt}.</div>}
              {r.status === 'Ditolak' && <div className="hc-status-note note-ditolak"><i className="bi bi-x-circle me-1"></i>Ditolak oleh {r.rejectedBy} pada {r.rejectedAt}.{r.rejectionReason && r.rejectionReason !== '-' ? ` Alasan: ${r.rejectionReason}` : ''}</div>}
              <div className="hc-actions">
                {r.fileUrl && r.fileUrl !== '-' && r.status === 'Disetujui' && (
                  <button onClick={() => handleOpenDoc(r.id, r.fileUrl)} className="btn-action btn-action-view" title="Buka di Google Docs">
                    <i className="bi bi-file-earmark-text"></i>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </Layout>
    );
  }

  // ADMIN / ATASAN VIEW (Table)
  return (
    <Layout user={user}>
      <div className="table-card">
        <div className="table-header">
          <h6><i className="bi bi-list me-2" style={{color:'var(--primary)'}}></i>{user.role === 'atasan' ? 'Permintaan Masuk' : 'Data Permintaan'}</h6>
          <div className="table-tools">
            <div className="search-box"><i className="bi bi-search"></i><input type="text" placeholder="Cari..." value={search} onChange={e => {setSearch(e.target.value); setPage(1);}} /></div>
            {user.role === 'admin' && (
              <>
                <button className="btn-primary-custom" onClick={exportExcel} style={{background:'linear-gradient(135deg, #059669, #10b981)'}}>
                  <i className="bi bi-file-earmark-excel"></i>Export
                </button>
                <button className="btn-primary-custom" onClick={openAdd}>
                  <i className="bi bi-plus"></i>Tambah
                </button>
              </>
            )}
          </div>
        </div>
        <div className="table-responsive">
          <table className="table table-custom">
            <thead>
              <tr>
                <th>No</th><th>Pemohon</th><th>Divisi</th><th>Jenis</th><th>Jenis Surat</th>
                <th>No. Surat</th><th>Perihal</th><th>Tujuan TTD</th><th>Status</th><th>Tanggal</th><th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 ? (
                <tr><td colSpan="11" className="text-center py-4" style={{color:'var(--text-muted)'}}><i className="bi bi-inbox me-2"></i>Tidak ada data</td></tr>
              ) : pageData.map((r, i) => (
                <tr key={r.id}>
                  <td>{(page-1)*pageSize + i + 1}</td>
                  <td><strong>{r.requesterName}</strong></td>
                  <td>{r.division}</td>
                  <td>{r.requestType}</td>
                  <td>{r.documentType}</td>
                  <td>{r.documentNumber}</td>
                  <td style={{maxWidth:180,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}} title={r.perihal}>{r.perihal}</td>
                  <td>{r.targetSigner}</td>
                  <td>{statusBadge(r.status)}</td>
                  <td style={{whiteSpace:'nowrap',fontSize:12}}>{r.createdAt}</td>
                  <td>
                    <div className="action-btns">
                      {user.role === 'admin' && r.status === 'Menunggu' && (
                        <>
                          <button className="btn-action btn-action-edit" title="Edit" onClick={() => openEdit(r)}><i className="bi bi-pen"></i></button>
                          <button className="btn-action btn-action-forward" title="Teruskan" onClick={() => doForward(r.id)}><i className="bi bi-share"></i></button>
                          <button className="btn-action btn-action-reject" title="Tolak" onClick={() => doReject(r.id)}><i className="bi bi-x"></i></button>
                        </>
                      )}
                      {user.role === 'atasan' && r.status === 'Diteruskan' && (
                        <>
                          <button className="btn-action btn-action-approve" title="Setujui" onClick={() => doApprove(r.id)}><i className="bi bi-check"></i></button>
                          <button className="btn-action btn-action-reject" title="Tolak" onClick={() => doReject(r.id)}><i className="bi bi-x"></i></button>
                        </>
                      )}
                        {r.fileUrl && r.fileUrl !== '-' && (
                          <button 
                            onClick={() => handleOpenDoc(r.id, r.fileUrl)} 
                            className="btn-action btn-action-view" 
                            title="Lihat File"
                          >
                            <i className="bi bi-file-earmark"></i>
                          </button>
                        )}
                      {user.role === 'admin' && <button className="btn-action btn-action-delete" title="Hapus" onClick={() => doDelete(r.id)}><i className="bi bi-trash"></i></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <div className="showing-text">Menampilkan {filtered.length === 0 ? 0 : (page-1)*pageSize+1}-{Math.min(page*pageSize, filtered.length)} dari {filtered.length} data</div>
          {totalPages > 1 && (
            <div className="pagination-custom">
              <button className="page-btn" disabled={page===1} onClick={() => setPage(page-1)}><i className="bi bi-chevron-left"></i></button>
              {Array.from({length: totalPages}, (_, i) => i+1).slice(Math.max(0, page-3), Math.max(0, page-3)+5).map(p => (
                <button key={p} className={`page-btn ${p===page?'active':''}`} onClick={() => setPage(p)}>{p}</button>
              ))}
              <button className="page-btn" disabled={page===totalPages} onClick={() => setPage(page+1)}><i className="bi bi-chevron-right"></i></button>
            </div>
          )}
        </div>
      </div>
      
      {showForm && user.role === 'admin' && (
        <div className="modal fade show d-block" tabIndex="-1">
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h6 className="modal-title">{editId ? 'Edit Permintaan' : 'Tambah Permintaan'}</h6>
                <button type="button" className="btn-close" onClick={() => setShowForm(false)}></button>
              </div>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-md-6"><label className="form-label">Nama Pemohon</label><input type="text" className="form-control" value={form.nama} onChange={e => setForm({...form, nama: e.target.value})} /></div>
                  <div className="col-md-6"><label className="form-label">Divisi</label><select className="form-select" value={form.divisi} onChange={e => setForm({...form, divisi: e.target.value})}><option value="">-- Pilih --</option>{divisi.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                  <div className="col-md-6"><label className="form-label">Jabatan</label><select className="form-select" value={form.jabatan} onChange={e => setForm({...form, jabatan: e.target.value})}><option value="">-- Pilih --</option>{jabatan.map(j => <option key={j} value={j}>{j}</option>)}</select></div>
                  <div className="col-md-6"><label className="form-label">Jenis Surat</label><select className="form-select" value={form.jenisSurat} onChange={e => onDocTypeChange(e.target.value)}><option value="">-- Pilih --</option>{jenisSurat.map(j => <option key={j.nama} value={j.nama}>{j.nama}</option>)}</select></div>
                  <div className="col-md-6"><label className="form-label">Nomor Surat</label><input type="text" className="form-control" value={form.nomorSurat} readOnly style={{background:'#f0fdf4',fontWeight:600,color:'#065f46'}} /></div>
                  {form.jenisSurat === 'Internal Memo/IM' && (
                    <div className="col-md-6"><label className="form-label">Departemen</label><select className="form-select" value={form.departemen} onChange={e => onDeptChange(e.target.value)}><option value="">-- Pilih --</option>{departemenIM.map(d => <option key={d.nama} value={d.nama}>{d.nama}</option>)}</select></div>
                  )}
                  <div className="col-12"><label className="form-label">Perihal</label><input type="text" className="form-control" value={form.perihal} onChange={e => setForm({...form, perihal: e.target.value})} /></div>
                  <div className="col-md-6"><label className="form-label">Tujuan Tanda Tangan</label><select className="form-select" value={form.tujuanTtd} onChange={e => onSignerChange(e.target.value)}><option value="">-- Pilih --</option>{signers.map(s => <option key={s.jabatan} value={s.jabatan}>{s.jabatan}</option>)}</select></div>
                  <div className="col-md-6"><label className="form-label">Nama Penandatangan</label><input type="text" className="form-control" value={form.namaSigner} readOnly style={{background:'#f8fafc'}} /></div>
                  <div className="col-12">
                    <label className="form-label">Link Google Docs (Template Surat)</label>
                    <input type="url" className="form-control" value={form.docLink} onChange={e => setForm({...form, docLink: e.target.value})} placeholder="https://docs.google.com/document/d/..." />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn-outline-custom" onClick={() => setShowForm(false)}>Batal</button>
                <button className="btn-primary-custom" onClick={submitForm}><i className="bi bi-save"></i>Simpan</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}