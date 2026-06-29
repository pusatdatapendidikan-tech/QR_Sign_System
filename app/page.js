'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [divisi, setDivisi] = useState([]);
  const [jabatan, setJabatan] = useState([]);
  
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [regForm, setRegForm] = useState({ username:'', password:'', name:'', email:'', division:'', position:'' });

  useEffect(() => {
    // Check existing session
    fetch('/api/auth/me').then(r => r.json()).then(res => {
      if (res.success && res.user) router.push('/dashboard');
    });
    // Load dropdowns
    Promise.all([
      fetch('/api/divisi').then(r => r.json()),
      fetch('/api/jabatan').then(r => r.json()),
    ]).then(([d, j]) => { setDivisi(d); setJabatan(j); });
  }, [router]);

  const doLogin = async (e) => {
    e?.preventDefault();
    if (!loginForm.username || !loginForm.password) {
      Swal.fire({ icon:'warning', title:'Perhatian', text:'Username dan password harus diisi', confirmButtonColor:'#1d4ed8' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(loginForm),
      }).then(r => r.json());
      if (res.success) {
        sessionStorage.setItem('qrSignUser', JSON.stringify(res.user)); // Tambahkan baris ini
        Swal.fire({ icon:'success', title:'Berhasil', text:`Selamat datang, ${res.user.name}`, timer:800, showConfirmButton:false });
        setTimeout(() => router.push('/dashboard'), 200);
      } else {
        Swal.fire({ icon:'error', title:'Gagal', text:res.message, confirmButtonColor:'#1d4ed8' });
      }
    } catch (err) {
      Swal.fire({ icon:'error', title:'Error', text:String(err), confirmButtonColor:'#1d4ed8' });
    } finally { setLoading(false); }
  };

  const doRegister = async (e) => {
    e?.preventDefault();
    const d = regForm;
    if (!d.username || !d.password || !d.name || !d.email || !d.division || !d.position) {
      Swal.fire({ icon:'warning', title:'Perhatian', text:'Semua field wajib diisi', confirmButtonColor:'#1d4ed8' });
      return;
    }
    if (d.password.length < 4) {
      Swal.fire({ icon:'warning', title:'Perhatian', text:'Password minimal 4 karakter', confirmButtonColor:'#1d4ed8' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(d),
      }).then(r => r.json());
      if (res.success) {
        Swal.fire({ icon:'success', title:'Berhasil Daftar', html:res.message, confirmButtonColor:'#059669' });
        setIsLogin(true);
        setRegForm({ username:'', password:'', name:'', email:'', division:'', position:'' });
      } else {
        Swal.fire({ icon:'error', title:'Gagal', text:res.message, confirmButtonColor:'#1d4ed8' });
      }
    } catch (err) {
      Swal.fire({ icon:'error', title:'Error', text:String(err), confirmButtonColor:'#1d4ed8' });
    } finally { setLoading(false); }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        {isLogin ? (
          <>
            <div className="login-header">
              <div className="logo-icon"><i className="bi bi-qr-code"></i></div>
              <h2>QR Sign System</h2>
              <p className="sub">Sistem Permintaan Tanda Tangan Digital</p>
            </div>
            <form onSubmit={doLogin}>
              <div className="mb-3">
                <div className="input-group">
                  <span className="input-group-text"><i className="bi bi-person"></i></span>
                  <input type="text" className="form-control" placeholder="Username" required
                    value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})} />
                </div>
              </div>
              <div className="mb-4">
                <div className="input-group">
                  <span className="input-group-text"><i className="bi bi-lock"></i></span>
                  <input type={showPwd ? 'text':'password'} className="form-control" placeholder="Password" required
                    value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} />
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowPwd(!showPwd)}>
                    <i className={`bi ${showPwd ? 'bi-eye-slash':'bi-eye'}`}></i>
                  </button>
                </div>
              </div>
              <button type="submit" className="btn-login" disabled={loading}>
                {loading ? <><span className="spinner-border spinner-border-sm me-2"></span>Memproses...</> : <><i className="bi bi-box-arrow-in-right me-2"></i>Masuk</>}
              </button>
            </form>
            <div className="text-center mt-3 pt-3" style={{borderTop:'1px solid #e2e8f0'}}>
              <span style={{color:'#64748b',fontSize:13}}>Belum punya akun? </span>
              <a href="#" onClick={e => {e.preventDefault(); setIsLogin(false);}} style={{color:'#1d4ed8',fontSize:13,fontWeight:600,textDecoration:'none'}}>Daftar Akun Baru</a>
            </div>
          </>
        ) : (
          <>
            <div className="login-header">
              <div className="logo-icon" style={{background:'linear-gradient(135deg,#059669,#10b981)'}}><i className="bi bi-person-plus"></i></div>
              <h2>Daftar Akun Baru</h2>
              <p className="sub">Isi data berikut untuk mendaftar</p>
            </div>
            <form onSubmit={doRegister}>
              <div className="mb-3"><input type="text" className="form-control" placeholder="Username" required value={regForm.username} onChange={e => setRegForm({...regForm, username: e.target.value})} /></div>
              <div className="mb-3"><input type="password" className="form-control" placeholder="Password" required value={regForm.password} onChange={e => setRegForm({...regForm, password: e.target.value})} /></div>
              <div className="mb-3"><input type="text" className="form-control" placeholder="Nama Lengkap" required value={regForm.name} onChange={e => setRegForm({...regForm, name: e.target.value})} /></div>
              <div className="mb-3"><input type="email" className="form-control" placeholder="Email" required value={regForm.email} onChange={e => setRegForm({...regForm, email: e.target.value})} /></div>
              <div className="mb-3">
                <select className="form-select" required value={regForm.division} onChange={e => setRegForm({...regForm, division: e.target.value})}>
                  <option value="">-- Pilih Divisi --</option>
                  {divisi.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="mb-4">
                <select className="form-select" required value={regForm.position} onChange={e => setRegForm({...regForm, position: e.target.value})}>
                  <option value="">-- Pilih Jabatan --</option>
                  {jabatan.map(j => <option key={j} value={j}>{j}</option>)}
                </select>
              </div>
              <button type="submit" className="btn-login" style={{background:'linear-gradient(135deg,#059669,#10b981)'}} disabled={loading}>
                {loading ? <><span className="spinner-border spinner-border-sm me-2"></span>Memproses...</> : <><i className="bi bi-send me-2"></i>Daftar</>}
              </button>
            </form>
            <div className="text-center mt-3 pt-3" style={{borderTop:'1px solid #e2e8f0'}}>
              <span style={{color:'#64748b',fontSize:13}}>Sudah punya akun? </span>
              <a href="#" onClick={e => {e.preventDefault(); setIsLogin(true);}} style={{color:'#1d4ed8',fontSize:13,fontWeight:600,textDecoration:'none'}}>Masuk</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}