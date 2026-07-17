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

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState('');
  const [form, setForm] = useState({ 
    nama:'', divisi:'', jabatan:'', jenisSurat:'', perihal:'', tujuanTtd:'', namaSigner:'', docLink:'', departemen:'', 
    posisiTTD: 'Kanan Bawah', // Untuk PDF
    namaKegiatan:'', tanggalKegiatan:'', daftarPeserta:'' // Untuk Sertifikat Slides
  });

  useEffect(() => {
    if (user) {
      loadDropdowns();
      loadRequests(user);
    }
  }, [user]);

  const loadDropdowns = async () => {
    const res = await fetch('/api/dropdowns', { cache: 'no-store' }).then(r => r.json());
    if (res.success) {
      setDivisi(res.divisi); 
      setJabatan(res.jabatan); 
      setSigners(res.signers); 
      setJenisSurat(res.jenisSurat); 
      setDepartemenIM(res.departemenIM); 
    }
  };

  const loadRequests = async (u) => {
    const res = await fetch(`/api/requests?role=${u.role}&userName=${u.username}&signerRole=${u.signerRole||''}`, { cache: 'no-store' }).then(r => r.json());
    if (res.success) setRequests(res.data);
  };

  const handleOpenDoc = async (id, url) => {
    window.open(url, '_blank');
    try {
      await fetch(`/api/requests/${id}/read`, { method: 'POST' });
      setRequests(prev => prev.map(r => r.id === id ? { ...r, readByRequester: true } : r));
      window.dispatchEvent(new Event('badge-update'));
    } catch (e) {}
  };

  const onDocTypeChange = (docType) => {
    // Reset form dinamis berdasarkan pilihan
    if (docType === 'Sertifikat') {
      setForm({ ...form, jenisSurat: docType, docLink: '', departemen: '', perihal: '-' });
    } else {
      setForm({ ...form, jenisSurat: docType, namaKegiatan: '', tanggalKegiatan: '', daftarPeserta: '', departemen: docType === 'Internal Memo/IM' ? form.departemen : '' });
    }
  };

  const onDeptChange = (dept) => {
    setForm({ ...form, departemen: dept });
  };

  const onSignerChange = (jabatan) => {
    const found = signers.find(s => s.jabatan === jabatan);
    setForm({ ...form, tujuanTtd: jabatan, namaSigner: found ? found.nama : '' });
  };

  const submitForm = async () => {
    if (!form.jenisSurat) { Swal.fire({icon:'warning', title:'Perhatian', text:'Pilih jenis surat', confirmButtonColor:'#1d4ed8'}); return; }
    if (form.jenisSurat === 'Internal Memo/IM' && !form.departemen) { Swal.fire({icon:'warning', title:'Perhatian', text:'Pilih departemen', confirmButtonColor:'#1d4ed8'}); return; }
    if (!form.tujuanTtd) { Swal.fire({icon:'warning', title:'Perhatian', text:'Pilih tujuan tanda tangan', confirmButtonColor:'#1d4ed8'}); return; }
    
    // Validasi dinamis berdasarkan jenis surat
    if (form.jenisSurat === 'Sertifikat') {
      if (!form.namaKegiatan || !form.daftarPeserta) {
        Swal.fire({icon:'warning', title:'Perhatian', text:'Nama Kegiatan dan Daftar Peserta wajib diisi untuk Sertifikat', confirmButtonColor:'#1d4ed8'});
        return;
      }
    } else {
      if (!form.docLink || form.docLink.indexOf('docs.google.com') === -1) {
        Swal.fire({icon:'warning', title:'Perhatian', text:'Masukkan link Google Docs yang valid', confirmButtonColor:'#1d4ed8'});
        return;
      }
      // Konfirmasi Akses Editor untuk Google Docs
      const confirmAccess = await Swal.fire({
        title: 'Konfirmasi Akses Dokumen',
        html: 'Apakah Anda sudah mengatur Sharing dokumen ke <strong>Anyone with the link = Editor</strong>?<br/><br/><small>Jika belum, QR Code tidak bisa disisipkan saat disetujui.</small>',
        icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya, Sudah Editor!', cancelButtonText: 'Belum, Cek Dulu', confirmButtonColor: '#059669'
      });
      if (!confirmAccess.isConfirmed) return;
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
        departemen: form.departemen || '',
        perihal: form.perihal || '-',
        targetSigner: form.tujuanTtd,
        fileUrl: form.jenisSurat === 'Sertifikat' ? 'AUTO_GENERATED' : form.docLink,
        fileName: form.jenisSurat === 'Sertifikat' ? 'Sertifikat Batch' : 'Google Docs Template',
        namaKegiatan: form.namaKegiatan || '-',
        tanggalKegiatan: form.tanggalKegiatan || '-',
        daftarPeserta: form.daftarPeserta || '-',
        posisiTTD: form.posisiTTD || 'Kanan Bawah'
      };
      
      let res;
      if (editId) {
        res = await fetch(`/api/requests/${editId}`, {
          method:'PUT', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ documentType: form.jenisSurat, perihal: form.perihal || '-', targetSigner: form.tujuanTtd, requestType:'Tanda Tangan' }),
        }).then(r => r.json());
      } else {
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
        setForm({ nama:'', divisi:'', jabatan:'', jenisSurat:'', perihal:'', tujuanTtd:'', namaSigner:'', docLink:'', departemen:'', posisiTTD:'Kanan Bawah', namaKegiatan:'', tanggalKegiatan:'', daftarPeserta:'' });
        loadRequests(user);
        loadDropdowns();
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
      title:`Teruskan ke ${req.targetSigner}?`, html:`Permintaan dari <strong>${req.requesterName}</strong> akan diteruskan.`,
      icon:'question', showCancelButton:true, confirmButtonText:'Ya, Teruskan', cancelButtonText:'Batal', confirmButtonColor:'#7c3aed',
    }).then(async r => {
      if (r.isConfirmed) {
        Swal.fire({ title:'Meneruskan...', allowOutsideClick:false, didOpen: () => Swal.showLoading() });
        const res = await fetch(`/api/requests/${id}/forward`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ forwarderName: user.name, targetSigner: req.targetSigner }), }).then(r => r.json());
        Swal.close();
        if (res.success) { Swal.fire({icon:'success', title:'Diteruskan', text:res.message, timer:1500, showConfirmButton:false}); loadRequests(user); window.dispatchEvent(new Event('badge-update')); }
        else Swal.fire({icon:'error', title:'Gagal', text:res.message, confirmButtonColor:'#1d4ed8'});
      }
    });
  };

  const doApprove = async (id) => {
    Swal.fire({ title:'Setujui Permintaan?', icon:'question', showCancelButton:true, confirmButtonText:'Ya, Setujui', cancelButtonText:'Batal', confirmButtonColor:'#059669' })
      .then(async r => {
        if (r.isConfirmed) {
          Swal.fire({ title:'Memproses Persetujuan...', html:'Mohon tunggu, sistem sedang membuat dokumen...', allowOutsideClick:false, didOpen: () => Swal.showLoading() });
          const res = await fetch(`/api/requests/${id}/approve`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ approverName: user.name }), }).then(r => r.json());
          Swal.close();
          if (res.success) { Swal.fire({icon:'success', title:'Disetujui', text:res.message, timer:2000, showConfirmButton:false}); loadRequests(user); window.dispatchEvent(new Event('badge-update')); }
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
        const res = await fetch(`/api/requests/${id}/reject`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ rejecterName: `${user.name} (${user.role === 'atasan' ? 'Atasan' : 'Admin'})`, reason: r.value || '-' }), }).then(r => r.json());
        Swal.close();
        if (res.success) { Swal.fire({icon:'success', title:'Ditolak', text:res.message, timer:1500, showConfirmButton:false}); loadRequests(user); window.dispatchEvent(new Event('badge-update')); }
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
          if (res.success) { Swal.fire({icon:'success', title:'Dihapus', text:res.message, timer:1500, showConfirmButton:false}); loadRequests(user); window.dispatchEvent(new Event('badge-update')); }
          else Swal.fire({icon:'error', title:'Gagal', text:res.message, confirmButtonColor:'#1d4ed8'});
        }
      });
  };

  const openEdit = (req) => {
    setEditId(req.id);
    setForm({
      nama: req.requesterName, divisi: req.division === '-' ? '' : req.division, jabatan: req.position === '-' ? '' : req.position,
      jenisSurat: req.documentType === '-' ? '' : req.documentType, perihal: req.perihal === '-' ? '' : req.perihal,
      tujuanTtd: req.targetSigner === '-' ? '' : req.targetSigner, namaSigner: signers.find(s => s.jabatan === req.targetSigner)?.nama || '',
      docLink: req.fileUrl !== '-' ? req.fileUrl : '', departemen:'', posisiTTD: 'Kanan Bawah', namaKegiatan:'', tanggalKegiatan:'', daftarPeserta:''
    });
    setShowForm(true);
  };

  const openAdd = () => {
    setEditId('');
    setForm({ nama:'', divisi:user.division === '-' ? '' : user.division, jabatan:user.position === '-' ? '' : user.position, jenisSurat:'', perihal:'', tujuanTtd:'', namaSigner:'', docLink:'', departemen:'', posisiTTD:'Kanan Bawah', namaKegiatan:'', tanggalKegiatan:'', daftarPeserta:'' });
    setShowForm(true);
  };

  const statusBadge = (s) => {
    const cls = s === 'Menunggu' ? 'status-menunggu' : s === 'Diteruskan' ? 'status-diteruskan' : s === 'Disetujui' ? 'status-disetujui' : 'status-ditolak';
    return <span className={`status-badge ${cls}`}>{s}</span>;
  };

  const exportExcel = () => {
    if (filtered.length === 0) { Swal.fire({icon:'info', title:'Info', text:'Tidak ada data untuk diexport', confirmButtonColor:'#1d4ed8'}); return; }
    const ws_data = [['No', 'Pemohon', 'Divisi', 'Jabatan', 'Jenis Permintaan', 'Jenis Surat', 'Nomor Surat', 'Perihal', 'Tujuan TTD', 'Status', 'Tanggal Pengajuan', 'Diteruskan Oleh', 'Disetujui/Ditolak Oleh', 'Alasan']];
    filtered.forEach((r, i) => { ws_data.push([i + 1, r.requesterName, r.division, r.position, r.requestType, r.documentType, r.documentNumber, r.perihal || '-', r.targetSigner, r.status, r.createdAt, r.forwardedBy, (r.approvedBy || r.rejectedBy || '-'), r.rejectionReason || '-']); });
    const wb = XLSX.utils.book_new(); const ws = XLSX.utils.aoa_to_sheet(ws_data);
    ws['!cols'] = [{wch: 4}, {wch: 20}, {wch: 15}, {wch: 20}, {wch: 18}, {wch: 22}, {wch: 25}, {wch: 30}, {wch: 22}, {wch: 12}, {wch: 25}, {wch: 20}, {wch: 25}, {wch: 30}];
    XLSX.utils.book_append_sheet(wb, ws, "Data Permintaan"); XLSX.writeFile(wb, 'Data_Permintaan.xlsx');
  };

  const filtered = requests.filter(r => {
    const q = search.toLowerCase();
    return r.requesterName.toLowerCase().includes(q) || r.division.toLowerCase().includes(q) || r.requestType.toLowerCase().includes(q) || r.status.toLowerCase().includes(q) || (r.documentNumber || '-').toLowerCase().includes(q);
  });
  const totalPages = Math.ceil(filtered.length / pageSize);
  const pageData = filtered.slice((page-1)*pageSize, page*pageSize);

  if (!user) return <div className="spinner-wrap"><div className="spinner-box"><div className="spinner"></div><p>Memuat sesi...</p></div></div>;
  if (loading) return <Layout user={user}><div className="inline-loading"><div className="spinner-border" role="status"></div><p>Memuat data permintaan...</p></div></Layout>;

  // Komponen Form Dinamis (Dipakai Bersama oleh User & Admin Modal)
  const DynamicFormFields = () => (
    <>
      <div className="row g-3">
        <div className="col-md-4"><label className="form-label">Nama Pemohon</label><input type="text" className="form-control" value={form.nama || user.name} onChange={e => setForm({...form, nama: e.target.value})} /></div>
        <div className="col-md-4"><label className="form-label">Divisi</label><select className="form-select" value={form.divisi} onChange={e => setForm({...form, divisi: e.target.value})}><option value="">-- Pilih --</option>{divisi.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
        <div className="col-md-4"><label className="form-label">Jabatan</label><select className="form-select" value={form.jabatan} onChange={e => setForm({...form, jabatan: e.target.value})}><option value="">-- Pilih --</option>{jabatan.map(j => <option key={j} value={j}>{j}</option>)}</select></div>
      </div>
      <div className="mt-3 pt-3" style={{borderTop:'1px solid var(--border-color)'}}>
        <h6 style={{fontSize:14,fontWeight:700,color:'var(--primary)',marginBottom:16}}><i className="bi bi-file-earmark-text me-2"></i>Data Surat / Sertifikat</h6>
        <div className="row g-3">
          <div className="col-md-6"><label className="form-label">Jenis Surat</label><select className="form-select" value={form.jenisSurat} onChange={e => onDocTypeChange(e.target.value)}><option value="">-- Pilih --</option>{jenisSurat.map(j => <option key={j.nama} value={j.nama}>{j.nama}</option>)}</select></div>
          <div className="col-md-6">
            <label className="form-label">Nomor Surat</label>
            <input type="text" className="form-control" value={form.jenisSurat === 'Sertifikat' ? 'Auto Generate per Peserta' : 'Akan digenerate saat disetujui'} readOnly style={{background:'#f8fafc', fontWeight:600, color:'#64748b', fontStyle:'italic'}} />
          </div>
          {form.jenisSurat === 'Internal Memo/IM' && (
            <div className="col-md-6"><label className="form-label">Departemen</label><select className="form-select" value={form.departemen} onChange={e => onDeptChange(e.target.value)}><option value="">-- Pilih --</option>{departemenIM.map(d => <option key={d.nama} value={d.nama}>{d.nama}</option>)}</select></div>
          )}
          
          {/* KONDISI FORM: SERTIFIKAT */}
          {form.jenisSurat === 'Sertifikat' ? (
            <>
              <div className="col-md-6"><label className="form-label">Nama Kegiatan / Training</label><input type="text" className="form-control" value={form.namaKegiatan} onChange={e => setForm({...form, namaKegiatan: e.target.value})} placeholder="Contoh: Pelatihan Leadership" /></div>
              <div className="col-md-6"><label className="form-label">Tanggal Kegiatan</label><input type="date" className="form-control" value={form.tanggalKegiatan} onChange={e => setForm({...form, tanggalKegiatan: e.target.value})} /></div>
              <div className="col-12">
                <label className="form-label">Daftar Nama Peserta</label>
                <textarea className="form-control" rows={5} value={form.daftarPeserta} onChange={e => setForm({...form, daftarPeserta: e.target.value})} placeholder="Masukkan 1 nama per baris.&#10;Contoh:&#10;Budi Santoso&#10;Ani Lestari" />
                <small className="text-muted">Sistem akan otomatis membuat 1 halaman sertifikat per nama. Data & Logo bisa diedit di Google Slides nanti.</small>
              </div>
            </>
          ) : (
            <>
              <div className="col-12"><label className="form-label">Perihal</label><input type="text" className="form-control" value={form.perihal} onChange={e => setForm({...form, perihal: e.target.value})} placeholder="Tulis perihal surat..." /></div>
              <div className="col-12">
                <label className="form-label">Link Google Docs (Template Surat)</label>
                <div style={{background:'#fffbeb',border:'1px solid #fcd34d',borderRadius:8,padding:'12px 16px',marginBottom:8}}>
                  <p style={{fontSize:12,color:'#92400e',margin:'0 0 8px 0',lineHeight:1.6, fontWeight:600}}><i className="bi bi-exclamation-triangle-fill me-1"></i>WAJIB ATUR AKSES DOKUMEN!</p>
                  <p style={{fontSize:12,color:'#92400e',margin:0,lineHeight:1.6}}>1. Klik <strong>Share</strong> di Google Docs.<br/>2. Ubah akses menjadi <strong>Anyone with the link = Editor</strong>.</p>
                  <hr style={{borderColor:'#fde68a', margin:'8px 0'}}/>
                  <p style={{fontSize:12,color:'#0369a1',margin:0}}><i className="bi bi-info-circle me-1"></i>Pastikan ada penanda <strong>{'{'}{'}QR_CODE{'}{'}'}</strong> dan <strong>{'{'}{'}NO_SURAT{'}{'}'}</strong>.</p>
                </div>
                <input type="url" className="form-control" value={form.docLink} onChange={e => setForm({...form, docLink: e.target.value})} placeholder="https://docs.google.com/document/d/..." />
              </div>
            </>
          )}
        </div>
      </div>
      <div className="mt-3 pt-3" style={{borderTop:'1px solid var(--border-color)'}}>
        <h6 style={{fontSize:14,fontWeight:700,color:'var(--primary)',marginBottom:16}}><i className="bi bi-pen me-2"></i>Data Tanda Tangan</h6>
        <div className="row g-3">
          <div className="col-md-6"><label className="form-label">Tujuan Tanda Tangan</label><select className="form-select" value={form.tujuanTtd} onChange={e => onSignerChange(e.target.value)}><option value="">-- Pilih --</option>{signers.map(s => <option key={s.jabatan} value={s.jabatan}>{s.jabatan}</option>)}</select></div>
          <div className="col-md-6"><label className="form-label">Nama Penandatangan</label><input type="text" className="form-control" value={form.namaSigner} readOnly style={{background:'#f8fafc'}} /></div>
        </div>
      </div>
    </>
  );

  return (
    <Layout user={user}>
      {/* USER VIEW */}
      {user.role === 'user' ? (
        <>
          <div className="mb-3">
            <button className="btn-primary-custom" onClick={() => showForm ? setShowForm(false) : openAdd()}>
              <i className={`bi ${showForm ? 'bi-x-circle' : 'bi-plus-circle'}`}></i>{showForm ? 'Tutup Form' : 'Tambah Permintaan'}
            </button>
          </div>
          {showForm && (
            <div className="form-card mb-4">
              <div className="form-header"><h6><i className="bi bi-plus-circle me-2"></i>{editId ? 'Edit Permintaan' : 'Form Permintaan'}</h6><p>Isi form berikut untuk mengajukan permintaan tanda tangan</p></div>
              <div className="form-body">{dynamicFormFields}<div className="mt-4 text-end"><button className="btn-primary-custom" onClick={submitForm}><i className="bi bi-send"></i>{editId ? 'Update' : 'Kirim Permintaan'}</button></div></div>
            </div>
          )}
          <h6 style={{fontWeight:700,fontSize:16,marginBottom:16}}><i className="bi bi-clock-history me-2" style={{color:'var(--primary)'}}></i>Riwayat Permintaan</h6>
          {requests.length === 0 ? (<div className="empty-state"><i className="bi bi-inbox"></i><p>Belum ada riwayat permintaan</p></div>) : (
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
                  {r.fileUrl && r.fileUrl !== '-' && r.fileUrl !== 'AUTO_GENERATED' && r.status === 'Disetujui' && (
                    <>
                      <button onClick={() => handleOpenDoc(r.id, r.fileUrl)} className="btn-action" title="Buka di Google Docs/Slides" style={{ background: '#4285F4', color: 'white', border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13zM6 20V4h5v7h7v9H6z"/><path d="M8 13h8v1.5H8zm0 3h8v1.5H8z"/></svg>
                      </button>
                      <a href={`/api/requests/${r.id}/pdf`} target="_blank" rel="noopener noreferrer" className="btn-action" title="Download PDF" style={{ background: '#dc2626', color: 'white', border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="bi bi-file-earmark-pdf"></i>
                      </a>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </>
      ) : (
        // ADMIN / ATASAN VIEW (Table)
        <>
          <div className="table-card">
            <div className="table-header">
              <h6><i className="bi bi-list me-2" style={{color:'var(--primary)'}}></i>{user.role === 'atasan' ? 'Permintaan Masuk' : 'Data Permintaan'}</h6>
              <div className="table-tools">
                <div className="search-box"><i className="bi bi-search"></i><input type="text" placeholder="Cari..." value={search} onChange={e => {setSearch(e.target.value); setPage(1);}} /></div>
                {user.role === 'admin' && (<><button className="btn-primary-custom" onClick={exportExcel} style={{background:'linear-gradient(135deg, #059669, #10b981)'}}><i className="bi bi-file-earmark-excel"></i>Export</button><button className="btn-primary-custom" onClick={openAdd}><i className="bi bi-plus"></i>Tambah</button></>)}
              </div>
            </div>
            <div className="table-responsive">
              <table className="table table-custom"><thead><tr><th>No</th><th>Pemohon</th><th>Divisi</th><th>Jenis</th><th>Jenis Surat</th><th>No. Surat</th><th>Perihal</th><th>Tujuan TTD</th><th>Status</th><th>Tanggal</th><th>Aksi</th></tr></thead>
                <tbody>
                  {pageData.length === 0 ? (<tr><td colSpan="11" className="text-center py-4" style={{color:'var(--text-muted)'}}><i className="bi bi-inbox me-2"></i>Tidak ada data</td></tr>) : pageData.map((r, i) => (
                    <tr key={r.id}>
                      <td>{(page-1)*pageSize + i + 1}</td><td><strong>{r.requesterName}</strong></td><td>{r.division}</td><td>{r.requestType}</td><td>{r.documentType}</td><td>{r.documentNumber}</td>
                      <td style={{maxWidth:180,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}} title={r.perihal}>{r.perihal}</td><td>{r.targetSigner}</td><td>{statusBadge(r.status)}</td><td style={{whiteSpace:'nowrap',fontSize:12}}>{r.createdAt}</td>
                      <td><div className="action-btns">
                        {user.role === 'admin' && r.status === 'Menunggu' && (<><button className="btn-action btn-action-edit" title="Edit" onClick={() => openEdit(r)}><i className="bi bi-pen"></i></button><button className="btn-action btn-action-forward" title="Teruskan" onClick={() => doForward(r.id)}><i className="bi bi-share"></i></button><button className="btn-action btn-action-reject" title="Tolak" onClick={() => doReject(r.id)}><i className="bi bi-x"></i></button></>)}
                        {user.role === 'atasan' && r.status === 'Diteruskan' && (<><button className="btn-action btn-action-approve" title="Setujui" onClick={() => doApprove(r.id)}><i className="bi bi-check"></i></button><button className="btn-action btn-action-reject" title="Tolak" onClick={() => doReject(r.id)}><i className="bi bi-x"></i></button></>)}
                        {r.fileUrl && r.fileUrl !== '-' && r.fileUrl !== 'AUTO_GENERATED' && (
                          <button onClick={() => handleOpenDoc(r.id, r.fileUrl)} className="btn-action" title="Buka File" style={{ background: '#4285F4', color: 'white', border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13zM6 20V4h5v7h7v9H6z"/><path d="M8 13h8v1.5H8zm0 3h8v1.5H8z"/></svg>
                          </button>
                        )}
                        {r.status === 'Disetujui' && r.fileUrl && r.fileUrl !== '-' && r.fileUrl !== 'AUTO_GENERATED' && (
                          <a href={`/api/requests/${r.id}/pdf`} target="_blank" rel="noopener noreferrer" className="btn-action" title="Download PDF" style={{ background: '#dc2626', color: 'white', border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><i className="bi bi-file-earmark-pdf" style={{fontSize:14}}></i></a>
                        )}
                        {user.role === 'admin' && <button className="btn-action btn-action-delete" title="Hapus" onClick={() => doDelete(r.id)}><i className="bi bi-trash"></i></button>}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <div className="showing-text">Menampilkan {filtered.length === 0 ? 0 : (page-1)*pageSize+1}-{Math.min(page*pageSize, filtered.length)} dari {filtered.length} data</div>
              {totalPages > 1 && (<div className="pagination-custom"><button className="page-btn" disabled={page===1} onClick={() => setPage(page-1)}><i className="bi bi-chevron-left"></i></button>{Array.from({length: totalPages}, (_, i) => i+1).slice(Math.max(0, page-3), Math.max(0, page-3)+5).map(p => (<button key={p} className={`page-btn ${p===page?'active':''}`} onClick={() => setPage(p)}>{p}</button>))}<button className="page-btn" disabled={page===totalPages} onClick={() => setPage(page+1)}><i className="bi bi-chevron-right"></i></button></div>)}
            </div>
          </div>
          
          {showForm && user.role === 'admin' && (
            <div className="modal fade show d-block" tabIndex="-1"><div className="modal-dialog modal-lg"><div className="modal-content"><div className="modal-header"><h6 className="modal-title">{editId ? 'Edit Permintaan' : 'Tambah Permintaan'}</h6><button type="button" className="btn-close" onClick={() => setShowForm(false)}></button></div>
              <div className="modal-body">{dynamicFormFields}</div>
              <div className="modal-footer"><button className="btn-outline-custom" onClick={() => setShowForm(false)}>Batal</button><button className="btn-primary-custom" onClick={submitForm}><i className="bi bi-save"></i>Simpan</button></div>
            </div></div></div>
          )}
        </>
      )}
    </Layout>
  );
}