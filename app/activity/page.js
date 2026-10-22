'use client';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/lib/useAuth';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';

const ACTIVITY_TYPES = {
  PENGAJUAN: { label: 'Pengajuan', color: '#1d4ed8', bg: '#dbeafe' },
  PERUBAHAN_DOKUMEN: { label: 'Perubahan Dokumen', color: '#d97706', bg: '#fef3c7' },
  CATATAN_PEMERIKSAAN: { label: 'Catatan Pemeriksaan', color: '#ea580c', bg: '#ffedd5' },
  KEPUTUSAN_PIMPINAN: { label: 'Keputusan Pimpinan', color: '#059669', bg: '#d1fae5' },
  PENERBITAN_NOMOR: { label: 'Penerbitan Nomor', color: '#7c3aed', bg: '#ede9fe' },
  PENERUSKAN: { label: 'Peneruskan', color: '#0891b2', bg: '#cffafe' },
  PEMBATALAN: { label: 'Pembatalan', color: '#6b7280', bg: '#f3f4f6' },
};

export default function ActivityLogPage() {
  const { user, loading } = useAuth('admin');
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    if (user) loadLogs();
  }, [user]);

  const loadLogs = async () => {
    const res = await fetch('/api/activity-log?limit=1000', { cache: 'no-store' }).then(r => r.json());
    if (res.success) setLogs(res.data);
  };

  const exportExcel = () => {
    if (filtered.length === 0) { Swal.fire({ icon: 'info', title: 'Info', text: 'Tidak ada data', confirmButtonColor: '#1d4ed8' }); return; }
    const ws_data = [['Timestamp', 'Actor', 'Role', 'Tipe', 'Deskripsi', 'Details', 'Request ID']];
    filtered.forEach(l => { ws_data.push([l.timestamp, l.actor, l.actorRole, l.activityType, l.description, l.details, l.requestId]); });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    ws['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 22 }, { wch: 50 }, { wch: 40 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Activity Log');
    XLSX.writeFile(wb, 'Activity_Log.xlsx');
  };

  const filtered = logs.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !q || (l.actor || '').toLowerCase().includes(q) || (l.description || '').toLowerCase().includes(q) || (l.requestId || '').toLowerCase().includes(q);
    const matchType = !filterType || l.activityType === filterType;
    return matchSearch && matchType;
  });
  
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageData = filtered.slice((page-1)*pageSize, page*pageSize);

  if (!user) return <div className="spinner-wrap"><div className="spinner-box"><div className="spinner"></div><p>Memuat sesi...</p></div></div>;
  if (loading) return <Layout user={user}><div className="inline-loading"><div className="spinner-border" role="status"></div><p>Memuat...</p></div></Layout>;

  return (
    <Layout user={user}>
      <div className="table-card">
        <div className="table-header">
          <h6><i className="bi bi-clock-history me-2" style={{ color: 'var(--primary)' }}></i>Riwayat Aktivitas Sistem</h6>
          <div className="table-tools">
            <div className="search-box"><i className="bi bi-search"></i><input type="text" placeholder="Cari..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div>
            <select className="form-select" value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }} style={{ width: 'auto', maxWidth: '200px' }}>
              <option value="">Semua Jenis</option>
              {Object.entries(ACTIVITY_TYPES).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
            <button className="btn-primary-custom" onClick={exportExcel} style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}>
              <i className="bi bi-file-earmark-excel"></i>Export
            </button>
            <button className="btn-primary-custom" onClick={loadLogs}>
              <i className="bi bi-arrow-clockwise"></i>Refresh
            </button>
          </div>
        </div>
        
        <div className="table-responsive">
          <table className="table table-custom">
            <thead>
              <tr>
                <th>No</th><th>Waktu</th><th>Aktor</th><th>Role</th><th>Tipe Aktivitas</th><th>Deskripsi</th><th>Request ID</th>
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 ? (
                <tr><td colSpan="7" className="text-center py-4" style={{ color: 'var(--text-muted)' }}>
                  <i className="bi bi-inbox me-2"></i>Tidak ada data
                </td></tr>
              ) : pageData.map((l, i) => {
                const typeInfo = ACTIVITY_TYPES[l.activityType] || { label: l.activityType, color: '#6b7280', bg: '#f3f4f6' };
                return (
                  <tr key={l.id}>
                    <td>{(page-1)*pageSize + i + 1}</td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{l.timestamp}</td>
                    <td><strong>{l.actor}</strong></td>
                    <td>
                      <span className="badge bg-secondary">{l.actorRole}</span>
                    </td>
                    <td>
                      <span className="status-badge" style={{ 
                        background: typeInfo.bg, 
                        color: typeInfo.color, 
                        border: `1px solid ${typeInfo.color}`,
                        padding: '4px 10px', 
                        borderRadius: 12, 
                        fontSize: 12, 
                        fontWeight: 600 
                      }}>
                        {typeInfo.label}
                      </span>
                    </td>
                    <td>
                      <div>{l.description}</div>
                      {l.details && l.details !== '-' && (
                        <small style={{ color: '#94a3b8', fontSize: 11 }}>{l.details}</small>
                      )}
                    </td>
                    <td style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b' }}>
                      {l.requestId?.substring(0, 12)}...
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        <div className="table-footer">
          <div className="showing-text">
            Menampilkan {filtered.length === 0 ? 0 : (page-1)*pageSize+1}-{Math.min(page*pageSize, filtered.length)} dari {filtered.length} data
            {pageSize === 999999 && filtered.length > 0 ? ' (Semua)' : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <select className="form-select form-select-sm" value={pageSize} onChange={e => { const val = e.target.value; setPageSize(val === 'all' ? 999999 : parseInt(val)); setPage(1); }} style={{ width: 'auto', maxWidth: '130px', cursor: 'pointer' }}>
              <option value="20">20 data</option>
              <option value="50">50 data</option>
              <option value="100">100 data</option>
              <option value="all">Semua Data</option>
            </select>
            {totalPages > 1 && (
              <div className="pagination-custom">
                <button className="page-btn" disabled={page===1} onClick={() => setPage(page-1)}>
                  <i className="bi bi-chevron-left"></i>
                </button>
                {Array.from({length: totalPages}, (_, i) => i+1).slice(Math.max(0, page-3), Math.max(0, page-3)+5).map(p => (
                  <button key={p} className={`page-btn ${p===page?'active':''}`} onClick={() => setPage(p)}>{p}</button>
                ))}
                <button className="page-btn" disabled={page===totalPages} onClick={() => setPage(page+1)}>
                  <i className="bi bi-chevron-right"></i>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}