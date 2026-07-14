'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function VerifyPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) fetchVerification();
  }, [id]);

  const fetchVerification = async () => {
    try {
      const res = await fetch(`/api/verify/${id}`).then(r => r.json());
      if (res.success) {
        setData(res.data);
      } else {
        setError('Dokumen tidak valid, belum disetujui, atau tidak ditemukan.');
      }
    } catch (e) {
      setError('Terjadi kesalahan saat menghubungi server.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'#f8fafc' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{width:40, height:40, border:'4px solid #e2e8f0', borderTop:'4px solid #3b82f6', borderRadius:'50%', animation:'spin 1s linear infinite', margin:'0 auto'}}></div>
          <p style={{marginTop:16, color:'#475569'}}>Memvalidasi dokumen...</p>
        </div>
        <style>{`@keyframes spin {0% { transform: rotate(0deg); }100% { transform: rotate(360deg); }}`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'#fef2f2', padding:20 }}>
        <div style={{ background:'white', padding:32, borderRadius:16, boxShadow:'0 4px 6px -1px rgba(0,0,0,0.1)', maxWidth:400, width:'100%', textAlign:'center' }}>
          <div style={{ fontSize:48, color:'#dc2626', marginBottom:16 }}>✕</div>
          <h2 style={{ fontSize:20, fontWeight:700, color:'#991b1b', marginBottom:8 }}>Dokumen Tidak Valid</h2>
          <p style={{ color:'#7f1d1d', fontSize:14 }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', background:'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', padding:20 }}>
      <div style={{ background:'white', padding:'32px 24px', borderRadius:16, boxShadow:'0 10px 25px -5px rgba(0,0,0,0.1)', maxWidth:450, width:'100%', border:'1px solid #bbf7d0' }}>
        
        {/* Header dengan Logo dan Nama Perusahaan */}
        <div style={{ textAlign:'center', marginBottom:24 }}>
          {data.logoUrl && (
            <img src={data.logoUrl} alt="Logo" style={{ height:50, marginBottom:12, objectFit:'contain' }} />
          )}
          <h1 style={{ fontSize:20, fontWeight:800, color:'#166534', margin:0 }}>Dokumen Sah & Terverifikasi</h1>
          <p style={{ fontSize:13, color:'#15803d', marginTop:4, fontWeight:500 }}>{data.companyName || 'Sistem Tanda Tangan Elektronik'}</p>
        </div>

        {/* Kotak Nomor Surat */}
        <div style={{ background:'#f0fdf4', borderRadius:12, padding:16, border:'1px solid #dcfce7', marginBottom:20, textAlign:'center' }}>
          <div style={{ fontSize:12, color:'#166534', fontWeight:600, marginBottom:4 }}>Nomor Surat</div>
          <div style={{ fontSize:20, fontWeight:800, color:'#14532d', letterSpacing:1 }}>{data.documentNumber || '-'}</div>
        </div>

        {/* Detail Informasi */}
        <div style={{ display:'flex', flexDirection:'column', gap:12, fontSize:14, color:'#334155' }}>
          <div>
            <span style={{ fontWeight:600, display:'block', fontSize:12, color:'#64748b' }}>Jenis Surat</span>
            {data.documentType || '-'}
          </div>
          <div>
            <span style={{ fontWeight:600, display:'block', fontSize:12, color:'#64748b' }}>Perihal</span>
            {data.perihal || '-'}
          </div>
          <div style={{ display:'flex', gap:16 }}>
            <div style={{ flex:1 }}>
              <span style={{ fontWeight:600, display:'block', fontSize:12, color:'#64748b' }}>Pemohon</span>
              {data.requesterName || '-'}
            </div>
            <div style={{ flex:1 }}>
              <span style={{ fontWeight:600, display:'block', fontSize:12, color:'#64748b' }}>Divisi/Jabatan</span>
              {data.division || '-'} / {data.position || '-'}
            </div>
          </div>
          <hr style={{ border:'none', borderTop:'1px dashed #cbd5e1', margin:'4px 0' }} />
          <div>
            <span style={{ fontWeight:600, display:'block', fontSize:12, color:'#64748b' }}>Ditandatangani Secara Elektronik Oleh</span>
            <span style={{ fontWeight:700, color:'#0f172a', fontSize:15 }}>{data.approvedBy || '-'}</span>
            <br/>
            <span style={{ fontSize:13, color:'#64748b' }}>Sebagai {data.signerTitle || '-'}</span>
          </div>
          <div>
            <span style={{ fontWeight:600, display:'block', fontSize:12, color:'#64748b' }}>Waktu Persetujuan</span>
            {data.approvedAtLong || '-'} Pukul {data.approvedAtTime || '-'}
          </div>
        </div>

        {/* Tombol Lihat Dokumen Asli */}
        {data.fileUrl && data.fileUrl !== '-' && (
          <a href={data.fileUrl} target="_blank" rel="noopener noreferrer" style={{
            display:'block', textAlign:'center', marginTop:20, background:'#059669', color:'white', 
            padding:'10px 16px', borderRadius:8, textDecoration:'none', fontWeight:600, fontSize:14
          }}>
            📄 Lihat Dokumen Asli
          </a>
        )}

        <div style={{ marginTop:24, textAlign:'center', fontSize:11, color:'#94a3b8' }}>
          Divalidasi secara otomatis oleh Sistem QR Sign
        </div>
      </div>
    </div>
  );
}