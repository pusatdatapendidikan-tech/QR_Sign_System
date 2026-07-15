'use client';
import { useState, useEffect } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import Layout from '@/components/Layout';
import { useAuth } from '@/lib/useAuth';

Chart.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const [stats, setStats] = useState({ total:0, menunggu:0, diteruskan:0, disetujui:0, ditolak:0, disetujuiUnread:0 });
  const [chartData, setChartData] = useState(null);
  const [chartFilter, setChartFilter] = useState({ year: new Date().getFullYear(), month: -1 });

  useEffect(() => {
    if (user) {
      loadStats(user);
      loadChart(user);
    }
  }, [user, chartFilter]);

  const loadStats = async (u) => {
    const res = await fetch(`/api/dashboard?role=${u.role}&userName=${u.username}&signerRole=${u.signerRole||''}`, { cache: 'no-store' }).then(r => r.json());
    if (res.success) setStats(res.data);
  };

  const loadChart = async (u) => {
    const res = await fetch(`/api/chart?year=${chartFilter.year}&month=${chartFilter.month}&role=${u.role}&userName=${u.username}&signerRole=${u.signerRole||''}`).then(r => r.json());
    if (res.success) {
      setChartData({
        labels: res.labels,
        datasets: [
          { label:'Menunggu', data:res.menunggu, backgroundColor:'rgba(217,119,6,0.8)', borderRadius:4 },
          { label:'Diteruskan', data:res.diteruskan, backgroundColor:'rgba(124,58,237,0.8)', borderRadius:4 },
          { label:'Disetujui', data:res.disetujui, backgroundColor:'rgba(5,150,105,0.8)', borderRadius:4 },
          { label:'Ditolak', data:res.ditolak, backgroundColor:'rgba(220,38,38,0.8)', borderRadius:4 },
        ],
      });
    }
  };

  if (!user) {
    return <div className="spinner-wrap"><div className="spinner-box"><div className="spinner"></div><p>Memuat sesi...</p></div></div>;
  }

  if (loading) {
    return (
      <Layout user={user}>
        <div className="inline-loading">
          <div className="spinner-border" role="status"></div>
          <p>Memuat data dashboard...</p>
        </div>
      </Layout>
    );
  }

  // UBAH BAGIAN INI: Menghapus Total Permintaan untuk User, dan Menambahkan Ditolak
  const statCards = user.role === 'user' ? [
    { cls:'stat-amber', icon:'bi-clock', value:stats.menunggu, label:'Menunggu' },
    { cls:'stat-purple', icon:'bi-share', value:stats.diteruskan, label:'Diteruskan' },
    { cls:'stat-green', icon:'bi-check-circle', value:stats.disetujui, label:'Disetujui' },
    { cls:'stat-red', icon:'bi-x-circle', value:stats.ditolak, label:'Ditolak' },
  ] : user.role === 'atasan' ? [
    { cls:'stat-purple', icon:'bi-inbox', value:stats.diteruskan, label:'Menunggu Review' },
    { cls:'stat-green', icon:'bi-check-circle', value:stats.disetujui, label:'Disetujui' },
    { cls:'stat-red', icon:'bi-x-circle', value:stats.ditolak, label:'Ditolak' },
    { cls:'stat-blue', icon:'bi-list', value:stats.total, label:'Total Masuk' },
  ] : [
    { cls:'stat-amber', icon:'bi-clock', value:stats.menunggu, label:'Menunggu' },
    { cls:'stat-purple', icon:'bi-share', value:stats.diteruskan, label:'Diteruskan' },
    { cls:'stat-green', icon:'bi-check-circle', value:stats.disetujui, label:'Disetujui' },
    { cls:'stat-red', icon:'bi-x-circle', value:stats.ditolak, label:'Ditolak' },
  ];

  const mo = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const curYear = new Date().getFullYear();
  const years = [curYear-3, curYear-2, curYear-1, curYear, curYear+1];

  return (
    <Layout user={user}>
      <div className="row g-3 mb-4">
        {statCards.map((s, i) => (
          <div key={i} className="col-6 col-lg-3">
            <div className={`stat-card ${s.cls} animate-in`}>
              <div className="stat-icon"><i className={`bi ${s.icon}`}></i></div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="chart-card animate-in">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
          <h6 className="m-0"><i className="bi bi-bar-chart me-2" style={{color:'var(--primary)'}}></i>Grafik Permintaan</h6>
          <div className="d-flex gap-2 flex-wrap">
            <select className="form-select" style={{width:'auto',fontSize:13,padding:'6px 32px 6px 12px'}} value={chartFilter.year} onChange={e => setChartFilter({...chartFilter, year: parseInt(e.target.value)})}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select className="form-select" style={{width:'auto',fontSize:13,padding:'6px 32px 6px 12px'}} value={chartFilter.month} onChange={e => setChartFilter({...chartFilter, month: parseInt(e.target.value)})}>
              <option value={-1}>Semua Bulan</option>
              {mo.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          </div>
        </div>
        {chartData && <Bar data={chartData} options={{
          responsive:true, maintainAspectRatio:true,
          plugins:{ legend:{ position:'top', labels:{ usePointStyle:true, pointStyle:'circle', padding:20 } } },
          scales:{ x:{ grid:{display:false} }, y:{ beginAtZero:true, ticks:{stepSize:1} } },
        }} />}
      </div>
    </Layout>
  );
}