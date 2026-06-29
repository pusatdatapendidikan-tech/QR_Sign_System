'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Swal from 'sweetalert2';

export default function Layout({ user, children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [badgeCount, setBadgeCount] = useState(0);
  
  const currentPage = pathname.replace('/', '') || 'dashboard';

  const [today] = useState(() => {
    const d = new Date();
    const bln = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const hari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    return `${hari[d.getDay()]}, ${d.getDate()} ${bln[d.getMonth()]} ${d.getFullYear()}`;
  });

  useEffect(() => {
    if (!user) return;

    const fetchBadge = async () => {
      try {
        const res = await fetch(`/api/dashboard?role=${user.role}&userName=${user.username}&signerRole=${user.signerRole||''}`).then(r => r.json());
        if (res.success) {
          if (user.role === 'admin') {
            setBadgeCount(res.data.menunggu || 0);
          } else if (user.role === 'atasan') {
            setBadgeCount(res.data.diteruskan || 0);
          } else if (user.role === 'user') {
            setBadgeCount(res.data.disetujui || 0);
          }
        }
      } catch (e) {}
    };

    fetchBadge();
    const interval = setInterval(fetchBadge, 60000); // Cek setiap 60 detik

    // TAMBAHKAN INI: Listener agar badge bisa di-refresh secara instan dari halaman lain
    const handleBadgeUpdate = () => fetchBadge();
    window.addEventListener('badge-update', handleBadgeUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('badge-update', handleBadgeUpdate);
    };
  }, [user]);

  const navItems = [
    { id:'dashboard', label:'Dashboard', icon:'bi-speedometer2', path:'/dashboard' },
    { id:'permintaan', label:'Permintaan', icon:'bi-pencil-square', path:'/permintaan' },
  ];
  
  if (user?.role === 'admin') {
    navItems.push({ id:'registrasi', label:'Persetujuan Akun', icon:'bi-person-check', isAdmin:true, path:'/registrasi' });
    navItems.push({ id:'users', label:'Manajemen User', icon:'bi-people', isAdmin:true, path:'/users' });
  }

  const doLogout = async () => {
    Swal.fire({ title:'Konfirmasi', text:'Yakin ingin keluar?', icon:'question', showCancelButton:true, confirmButtonText:'Ya, Keluar', cancelButtonText:'Batal', confirmButtonColor:'#dc2626' })
      .then(async r => {
        if (r.isConfirmed) {
          await fetch('/api/auth/logout', { method:'POST' });
          sessionStorage.removeItem('qrSignUser');
          router.push('/');
        }
      });
  };

  const toggleSidebar = () => {
    if (window.innerWidth < 992) setSidebarOpen(!sidebarOpen);
    else setCollapsed(!collapsed);
  };

  const pageTitle = { dashboard:'Dashboard', permintaan:'Permintaan', registrasi:'Persetujuan Akun', users:'Manajemen User' }[currentPage] || 'Dashboard';

  return (
    <>
      <div className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`} onClick={() => setSidebarOpen(false)} />
      <nav className={`sidebar ${collapsed ? 'collapsed' : ''} ${sidebarOpen ? 'show' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-icon"><i className="bi bi-qr-code"></i></div>
          <div><h6>QR Sign</h6><small>Signature System</small></div>
        </div>
        <div className="sidebar-nav">
          <div className="nav-label">Menu Utama</div>
          {navItems.filter(n => !n.isAdmin).map(n => (
            <Link key={n.id} href={n.path} className={`nav-item-link ${currentPage === n.id ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
              <i className={`bi ${n.icon}`}></i>{n.label}
              {n.id === 'permintaan' && badgeCount > 0 && (
                <span style={{
                  background: '#dc2626', 
                  color: '#fff', 
                  fontSize: '11px', 
                  padding: '2px 8px', 
                  borderRadius: '10px', 
                  marginLeft: 'auto', 
                  fontWeight: 700,
                  boxShadow: '0 0 8px rgba(220, 38, 38, 0.6)'
                }}>
                  {badgeCount}
                </span>
              )}
            </Link>
          ))}
          {user?.role === 'admin' && (
            <>
              <div className="nav-label">Administrasi</div>
              {navItems.filter(n => n.isAdmin).map(n => (
                <Link key={n.id} href={n.path} className={`nav-item-link ${currentPage === n.id ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                  <i className={`bi ${n.icon}`}></i>{n.label}
                </Link>
              ))}
            </>
          )}
        </div>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{user?.name?.charAt(0).toUpperCase() || 'U'}</div>
            <div>
              <div className="user-name">{user?.name}</div>
              <div className="user-role">{user?.role}{user?.signerRole ? ` (${user.signerRole})` : ''}</div>
            </div>
          </div>
          <button className="btn-logout" onClick={doLogout}><i className="bi bi-box-arrow-right me-2"></i>Keluar</button>
        </div>
      </nav>
      <div className={`main-content ${collapsed ? 'expanded' : ''}`}>
        <div className="top-bar">
          <div className="d-flex align-items-center gap-2">
            <button className="btn-toggle-sidebar" onClick={toggleSidebar}><i className="bi bi-list"></i></button>
            <span className="page-title">{pageTitle}</span>
          </div>
          <span style={{fontSize:13,color:'var(--text-muted)'}}>{today}</span>
        </div>
        <div className="content-area">{children}</div>
      </div>
    </>
  );
}