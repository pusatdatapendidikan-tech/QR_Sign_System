'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/lib/useAuth';
import Swal from 'sweetalert2';

export default function RegistrasiPage() {
  const { user, loading } = useAuth('admin');
  const [pending, setPending] = useState([]);

  useEffect(() => {
    if (user) {
      loadPending();
    }
  }, [user]);

  const loadPending = async () => {
    const res = await fetch('/api/users/pending').then(r => r.json());
    if (res.success) setPending(res.data);
  };

  const doApprove = (id, name) => {
    Swal.fire({ title:'Setujui Akun?', text:`Akun ${name} akan aktif`, icon:'question', showCancelButton:true, confirmButtonText:'Ya, Setujui', cancelButtonText:'Batal', confirmButtonColor:'#059669' })
      .then(async r => {
        if (r.isConfirmed) {
          Swal.fire({ title:'Memproses...', allowOutsideClick:false, didOpen: () => Swal.showLoading() });
          const res = await fetch(`/api/users/${id}/approve`, { method:'POST' }).then(r => r.json());
          Swal.close();
          if (res.success) { Swal.fire({icon:'success', title:'Disetujui', text:res.message, timer:1500, showConfirmButton:false}); loadPending(); }
          else Swal.fire({icon:'error', title:'Gagal', text:res.message, confirmButtonColor:'#1d4ed8'});
        }
      });
  };

  const doReject = (id, name) => {
    Swal.fire({
      title:`Tolak ${name}?`, text:'Akun tidak akan dapat digunakan', icon:'warning',
      showCancelButton:true, confirmButtonText:'Ya, Tolak', cancelButtonText:'Batal', confirmButtonColor:'#dc2626',
      input:'textarea', inputLabel:'Alasan penolakan (opsional)', inputPlaceholder:'Tulis alasan...',
    }).then(async r => {
      if (r.isConfirmed) {
        Swal.fire({ title:'Memproses...', allowOutsideClick:false, didOpen: () => Swal.showLoading() });
        const res = await fetch(`/api/users/${id}/reject`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ reason: r.value || '' }),
        }).then(r => r.json());
        Swal.close();
        if (res.success) { Swal.fire({icon:'success', title:'Ditolak', text:res.message, timer:1500, showConfirmButton:false}); loadPending(); }
        else Swal.fire({icon:'error', title:'Gagal', text:res.message, confirmButtonColor:'#1d4ed8'});
      }
    });
  };

  if (!user) {
    return <div className="spinner-wrap"><div className="spinner-box"><div className="spinner"></div><p>Memuat sesi...</p></div></div>;
  }

  if (loading) {
    return (
      <Layout user={user}>
        <div className="inline-loading">
          <div className="spinner-border" role="status"></div>
          <p>Memuat data pendaftaran...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user}>
      <div className="table-card">
        <div className="table-header">
          <h6><i className="bi bi-person-check me-2" style={{color:'var(--warning)'}}></i>Persetujuan Pendaftaran Akun</h6>
          <button className="btn-outline-custom" onClick={loadPending}><i className="bi bi-arrow-clockwise"></i>Refresh</button>
        </div>
        <div className="table-responsive">
          <table className="table table-custom">
            <thead>
              <tr>
                <th>No</th><th>Tanggal Daftar</th><th>Nama</th><th>Username</th><th>Email</th><th>Divisi</th><th>Jabatan</th><th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pending.length === 0 ? (
                <tr><td colSpan="8" className="text-center py-4" style={{color:'var(--text-muted)'}}><i className="bi bi-check-circle me-2" style={{color:'var(--success)'}}></i>Tidak ada permintaan pendaftaran</td></tr>
              ) : pending.map((u, i) => (
                <tr key={u.id}>
                  <td>{i + 1}</td>
                  <td style={{fontSize:12,whiteSpace:'nowrap'}}>{u.createdAt}</td>
                  <td><strong>{u.name}</strong></td>
                  <td>{u.username}</td>
                  <td style={{fontSize:12}}>{u.email}</td>
                  <td>{u.division}</td>
                  <td>{u.position}</td>
                  <td>
                    <div className="action-btns">
                      <button className="btn-action btn-action-approve" title="Setujui" onClick={() => doApprove(u.id, u.name)}><i className="bi bi-check"></i></button>
                      <button className="btn-action btn-action-reject" title="Tolak" onClick={() => doReject(u.id, u.name)}><i className="bi bi-x"></i></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}