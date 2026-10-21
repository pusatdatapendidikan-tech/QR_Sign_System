'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { CONFIG } from '@/lib/config';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (!t) {
      Swal.fire({ 
        icon: 'error', 
        title: 'Token Tidak Valid', 
        text: 'Token reset password tidak ditemukan', 
        confirmButtonColor: '#1d4ed8' 
      }).then(() => router.push('/'));
    } else {
      setToken(t);
    }
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!newPassword || !confirmPassword) {
      Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Semua field wajib diisi', confirmButtonColor: '#1d4ed8' });
      return;
    }
    if (newPassword !== confirmPassword) {
      Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Password tidak cocok', confirmButtonColor: '#1d4ed8' });
      return;
    }
    if (newPassword.length < 4) {
      Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Password minimal 4 karakter', confirmButtonColor: '#1d4ed8' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      }).then(r => r.json());

      if (res.success) {
        Swal.fire({
          icon: 'success',
          title: 'Berhasil!',
          text: res.message,
          confirmButtonColor: '#059669'
        }).then(() => router.push('/'));
      } else {
        Swal.fire({ icon: 'error', title: 'Gagal', text: res.message, confirmButtonColor: '#1d4ed8' });
      }
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: String(err), confirmButtonColor: '#1d4ed8' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-header">
          <img src={CONFIG.LOGO_URL} alt="Logo" style={{ height: '50px', width: 'auto', objectFit: 'contain', marginBottom: '8px' }} />
          <h2>Reset Password</h2>
          <p className="sub">Masukkan password baru Anda</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <input
              type="password"
              className="form-control"
              placeholder="Password Baru"
              required
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
          </div>
          <div className="mb-4">
            <input
              type="password"
              className="form-control"
              placeholder="Konfirmasi Password Baru"
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-login" style={{ background: 'linear-gradient(135deg,#059669,#10b981)' }} disabled={loading}>
            {loading ? <><span className="spinner-border spinner-border-sm me-2"></span>Memproses...</> : <><i className="bi bi-check-circle me-2"></i>Reset Password</>}
          </button>
        </form>
      </div>
    </div>
  );
}