'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { CONFIG } from '@/lib/config';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Email wajib diisi', confirmButtonColor: '#1d4ed8' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }).then(r => r.json());

      if (res.success) {
        Swal.fire({
          icon: 'success',
          title: 'Email Terkirim',
          html: res.message,
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
          <h2>Lupa Password?</h2>
          <p className="sub">Masukkan email Anda untuk reset password</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <input
              type="email"
              className="form-control"
              placeholder="Email Anda"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-login" style={{ background: 'linear-gradient(135deg,#dc2626,#ef4444)' }} disabled={loading}>
            {loading ? <><span className="spinner-border spinner-border-sm me-2"></span>Mengirim...</> : <><i className="bi bi-send me-2"></i>Kirim Link Reset</>}
          </button>
        </form>
        <div className="text-center mt-3 pt-3" style={{ borderTop: '1px solid #e2e8f0' }}>
          <a href="/" style={{ color: '#1d4ed8', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>← Kembali ke Login</a>
        </div>
      </div>
    </div>
  );
}