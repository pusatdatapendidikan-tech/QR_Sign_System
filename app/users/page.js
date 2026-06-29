'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/lib/useAuth';
import Swal from 'sweetalert2';

export default function UsersPage() {
  const { user, loading } = useAuth('admin');
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 8;
  
  const [divisi, setDivisi] = useState([]);
  const [jabatan, setJabatan] = useState([]);
  const [signers, setSigners] = useState([]);
  
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState('');
  const [form, setForm] = useState({ username:'', password:'', name:'', role:'user', email:'', signerRole:'', division:'', position:'' });

  useEffect(() => {
    if (user) {
      loadUsers();
      loadDropdowns();
    }
  }, [user]);

  const loadUsers = async () => {
    const res = await fetch('/api/users').then(r => r.json());
    if (res.success) setUsers(res.data);
  };

  const loadDropdowns = async () => {
    const [d, j, s] = await Promise.all([
      fetch('/api/divisi').then(r => r.json()),
      fetch('/api/jabatan').then(r => r.json()),
      fetch('/api/signers').then(r => r.json()),
    ]);
    setDivisi(d); setJabatan(j); setSigners(s);
  };

  const openAdd = () => {
    setEditId('');
    setForm({ username:'', password:'', name:'', role:'user', email:'', signerRole:'', division:'', position:'' });
    setShowForm(true);
  };

  const openEdit = (u) => {
    setEditId(u.id);
    setForm({
      username: u.username, password: '', name: u.name, role: u.role,
      email: u.email, signerRole: u.signerRole || '',
      division: u.division === '-' ? '' : u.division,
      position: u.position === '-' ? '' : u.position,
    });
    setShowForm(true);
  };

  const submitForm = async () => {
    if (!form.username || !form.name) { Swal.fire({icon:'warning', title:'Perhatian', text:'Username dan nama wajib diisi', confirmButtonColor:'#1d4ed8'}); return; }
    if (!editId && !form.password) { Swal.fire({icon:'warning', title:'Perhatian', text:'Password wajib diisi untuk user baru', confirmButtonColor:'#1d4ed8'}); return; }
    if (form.role === 'atasan' && !form.signerRole) { Swal.fire({icon:'warning', title:'Perhatian', text:'Signer Role wajib diisi untuk Atasan', confirmButtonColor:'#1d4ed8'}); return; }

    Swal.fire({ title:'Menyimpan...', allowOutsideClick:false, didOpen: () => Swal.showLoading() });
    try {
      let res;
      if (editId) {
        res = await fetch(`/api/users/${editId}`, {
          method:'PUT', headers:{'Content-Type':'application/json'},
          body: JSON.stringify(form),
        }).then(r => r.json());
      } else {
        res = await fetch('/api/users', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify(form),
        }).then(r => r.json());
      }
      Swal.close();
      if (res.success) {
        Swal.fire({icon:'success', title:'Berhasil', text:res.message, timer:1500, showConfirmButton:false});
        setShowForm(false);
        loadUsers();
      } else {
        Swal.fire({icon:'error', title:'Gagal', text:res.message, confirmButtonColor:'#1d4ed8'});
      }
    } catch (e) {
      Swal.close();
      Swal.fire({icon:'error', title:'Error', text:String(e), confirmButtonColor:'#1d4ed8'});
    }
  };

  const doDelete = async (id) => {
    Swal.fire({ title:'Hapus User?', text:'Tidak dapat dikembalikan', icon:'warning', showCancelButton:true, confirmButtonText:'Ya, Hapus', cancelButtonText:'Batal', confirmButtonColor:'#dc2626' })
      .then(async r => {
        if (r.isConfirmed) {
          Swal.fire({ title:'Menghapus...', allowOutsideClick:false, didOpen: () => Swal.showLoading() });
          const res = await fetch(`/api/users/${id}`, { method:'DELETE' }).then(r => r.json());
          Swal.close();
          if (res.success) { Swal.fire({icon:'success', title:'Dihapus', text:res.message, timer:1500, showConfirmButton:false}); loadUsers(); }
          else Swal.fire({icon:'error', title:'Gagal', text:res.message, confirmButtonColor:'#1d4ed8'});
        }
      });
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q) || u.role.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
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
          <p>Memuat data user...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user}>
      <div className="table-card">
        <div className="table-header">
          <h6><i className="bi bi-people me-2" style={{color:'var(--primary)'}}></i>Manajemen User</h6>
          <div className="table-tools">
            <div className="search-box"><i className="bi bi-search"></i><input type="text" placeholder="Cari user..." value={search} onChange={e => {setSearch(e.target.value); setPage(1);}} /></div>
            <button className="btn-primary-custom" onClick={openAdd}><i className="bi bi-person-plus"></i>Tambah User</button>
          </div>
        </div>
        <div className="table-responsive">
          <table className="table table-custom">
            <thead>
              <tr>
                <th>No</th><th>Username</th><th>Nama</th><th>Role</th><th>Signer Role</th><th>Divisi</th><th>Jabatan</th><th>Status</th><th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 ? (
                <tr><td colSpan="9" className="text-center py-4" style={{color:'var(--text-muted)'}}><i className="bi bi-inbox me-2"></i>Tidak ada data</td></tr>
              ) : pageData.map((u, i) => (
                <tr key={u.id}>
                  <td>{(page-1)*pageSize + i + 1}</td>
                  <td><strong>{u.username}</strong></td>
                  <td>{u.name}</td>
                  <td><span className={`status-badge ${u.role === 'admin' ? 'status-disetujui' : u.role === 'atasan' ? 'status-diteruskan' : 'status-menunggu'}`}>{u.role}</span></td>
                  <td>{u.signerRole || '-'}</td>
                  <td>{u.division}</td>
                  <td>{u.position}</td>
                  <td><span className={`status-badge ${u.status === 'active' ? 'status-disetujui' : u.status === 'pending' ? 'status-menunggu' : 'status-ditolak'}`}>{u.status}</span></td>
                  <td>
                    <div className="action-btns">
                      <button className="btn-action btn-action-edit" title="Edit" onClick={() => openEdit(u)}><i className="bi bi-pen"></i></button>
                      {u.username !== 'admin' && <button className="btn-action btn-action-delete" title="Hapus" onClick={() => doDelete(u.id)}><i className="bi bi-trash"></i></button>}
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

      {showForm && (
        <div className="modal fade show d-block" tabIndex="-1">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h6 className="modal-title">{editId ? 'Edit User' : 'Tambah User'}</h6>
                <button type="button" className="btn-close" onClick={() => setShowForm(false)}></button>
              </div>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-12"><label className="form-label">Username</label><input type="text" className="form-control" value={form.username} onChange={e => setForm({...form, username: e.target.value})} /></div>
                  <div className="col-12"><label className="form-label">Password</label><input type="text" className="form-control" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder={editId ? 'Kosongkan jika tidak diubah' : ''} /></div>
                  <div className="col-12"><label className="form-label">Nama Lengkap</label><input type="text" className="form-control" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
                  <div className="col-md-6">
                    <label className="form-label">Role</label>
                    <select className="form-select" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                      <option value="atasan">Atasan</option>
                    </select>
                  </div>
                  {form.role === 'atasan' && (
                    <div className="col-md-6">
                      <label className="form-label">Signer Role</label>
                      <select className="form-select" value={form.signerRole} onChange={e => setForm({...form, signerRole: e.target.value})}>
                        <option value="">-- Pilih --</option>
                        {signers.map(s => <option key={s.jabatan} value={s.jabatan}>{s.jabatan}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="col-12"><label className="form-label">Email</label><input type="email" className="form-control" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
                  <div className="col-md-6"><label className="form-label">Divisi</label><select className="form-select" value={form.division} onChange={e => setForm({...form, division: e.target.value})}><option value="">-- Pilih --</option>{divisi.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                  <div className="col-md-6"><label className="form-label">Jabatan</label><select className="form-select" value={form.position} onChange={e => setForm({...form, position: e.target.value})}><option value="">-- Pilih --</option>{jabatan.map(j => <option key={j} value={j}>{j}</option>)}</select></div>
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