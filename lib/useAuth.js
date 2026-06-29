import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function useAuth(requiredRole = null) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Ambil data user dari memory browser dulu (agar tidak kedip)
    const cachedUser = sessionStorage.getItem('qrSignUser');
    if (cachedUser) {
      setUser(JSON.parse(cachedUser));
    }

    // 2. Validasi ke server apakah sesi masih aktif
    fetch('/api/auth/me').then(r => r.json()).then(res => {
      if (!res.success || !res.user) {
        sessionStorage.removeItem('qrSignUser');
        router.push('/');
        return;
      }
      if (requiredRole && res.user.role !== requiredRole) {
        router.push('/dashboard');
        return;
      }
      setUser(res.user);
      sessionStorage.setItem('qrSignUser', JSON.stringify(res.user));
      setLoading(false);
    });
  }, [router]);

  return { user, loading };
}