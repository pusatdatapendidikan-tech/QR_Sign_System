import { NextResponse } from 'next/server';
import { ensureSheets, readSheet } from '@/lib/googleSheets';
import { CONFIG } from '@/lib/config';
import { formatDate, formatDateLong, formatTime } from '@/lib/utils';

async function getSigners() {
  const data = await readSheet(CONFIG.SHEETS.SIGNERS);
  const list = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      list.push({
        jabatan: data[i][0].trim(),
        nama: (data[i][1] || '').trim(),
        email: (data[i][2] || '').trim(),
      });
    }
  }
  return list;
}

export default async function VerifyPage({ params }) {
  try {
    await ensureSheets();
    const data = await readSheet(CONFIG.SHEETS.REQUESTS);
    const signers = await getSigners();
    let verifyData = null;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === params.id) {
        const targetSigner = data[i][9];
        let signerTitle = targetSigner;
        const signerData = signers.find(s => s.jabatan === targetSigner);
        if (signerData) signerTitle = signerData.nama;
        
        verifyData = {
          documentType: data[i][6],
          documentNumber: data[i][7],
          perihal: data[i][8],
          requesterName: data[i][1],
          division: data[i][3],
          position: data[i][4],
          approvedBy: data[i][13],
          signerTitle,
          companyName: CONFIG.COMPANY_NAME,
          approvedAt: data[i][14] ? formatDate(data[i][14]) : '-',
          approvedAtLong: data[i][14] ? formatDateLong(data[i][14]) : '-',
          approvedAtTime: data[i][14] ? formatTime(data[i][14]) : '-',
          fileUrl: data[i][10],
          fileName: data[i][11],
          logoUrl: CONFIG.LOGO_URL,
        };
        break;
      }
    }

    if (!verifyData) {
      return (
        <html><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
        <body style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'100vh',margin:0,fontFamily:'Arial',background:'#fef2f2'}}>
          <div style={{textAlign:'center',padding:'48px',background:'#fff',borderRadius:'16px',boxShadow:'0 4px 24px rgba(0,0,0,.08)'}}>
            <h2 style={{color:'#dc2626'}}>Tidak Valid</h2>
            <p style={{color:'#64748b'}}>Data tanda tangan tidak ditemukan.</p>
          </div>
        </body></html>
      );
    }

    return (
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" rel="stylesheet" />
          <style>{`
            *{margin:0;padding:0;box-sizing:border-box}
            body{font-family:Arial,Helvetica,sans-serif;background:linear-gradient(135deg,#ecfdf5 0%,#f0f9ff 50%,#eff6ff 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
            .card{background:#fff;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,.08);max-width:520px;width:100%;overflow:hidden}
            .card-header{background:linear-gradient(135deg,#059669,#10b981);padding:32px 28px;text-align:center}
            .card-header .logo{height:60px;width:auto;object-fit:contain;margin:0 auto 16px;display:block}
            .card-header h1{color:#fff;font-size:20px;font-weight:700;margin:0}
            .card-header p{color:rgba(255,255,255,.85);font-size:13px;margin-top:6px}
            .card-body{padding:28px}
            .verify-text{text-align:center;padding:20px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;margin-bottom:24px;color:#065f46;font-size:14px;line-height:1.8}
            .verify-text .signer-full{font-weight:700;font-size:15px;color:#064e3b;margin-top:4px}
            .info-table{width:100%;border-collapse:collapse}
            .info-table tr{border-bottom:1px solid #f1f5f9}
            .info-table tr:last-child{border:none}
            .info-table td{padding:12px 0;font-size:14px;vertical-align:top}
            .info-table .label{color:#64748b;width:40%;padding-right:12px}
            .info-table .value{color:#0f172a;font-weight:600}
            .signer-block{text-align:center;padding:24px 20px;margin-top:8px;border-top:2px dashed #e2e8f0}
            .signer-name{font-size:20px;font-weight:800;color:#0f172a;margin-bottom:4px}
            .signer-title{font-size:14px;color:#475569;margin-bottom:4px}
            .signer-company{font-size:13px;color:#64748b;margin-bottom:16px}
            .signer-stamp{display:inline-block;padding:8px 20px;border:2px solid #059669;border-radius:8px;color:#059669;font-weight:700;font-size:12px;letter-spacing:1px;text-transform:uppercase}
            .footer{text-align:center;padding:16px 28px;background:#f8fafc;border-top:1px solid #f1f5f9}
            .footer p{font-size:11px;color:#94a3b8;line-height:1.5}
            .btn-doc{display:inline-block;padding:12px 28px;background:#059669;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;margin-top:20px;font-size:14px}
          `}</style>
        </head>
        <body>
          <div className="card">
            <div className="card-header">
              <img className="logo" src={verifyData.logoUrl} alt="Logo" />
              <h1>Tanda Tangan Digital Valid</h1>
              <p>Dokumen ini telah ditandatangani secara digital</p>
            </div>
            <div className="card-body">
              <div className="verify-text">
                <i className="fas fa-check-circle" style={{marginRight:'6px'}}></i> Surat ini telah ditandatangani secara digital oleh:
                <div className="signer-full">{verifyData.approvedBy}, {verifyData.signerTitle}</div>
                <div className="signer-full">{verifyData.companyName}</div>
              </div>
              <table className="info-table">
                <tbody>
                  <tr><td className="label">Jenis Surat</td><td className="value">{verifyData.documentType}</td></tr>
                  <tr><td className="label">Nomor Surat</td><td className="value">{verifyData.documentNumber}</td></tr>
                  <tr><td className="label">Perihal</td><td className="value">{verifyData.perihal}</td></tr>
                  <tr><td className="label">Pemohon</td><td className="value">{verifyData.requesterName}</td></tr>
                  <tr><td className="label">Divisi / Jabatan</td><td className="value">{verifyData.division} / {verifyData.position}</td></tr>
                  <tr><td className="label">Hari / Tanggal</td><td className="value">{verifyData.approvedAtLong}</td></tr>
                  <tr><td className="label">Pukul</td><td className="value">{verifyData.approvedAtTime}</td></tr>
                </tbody>
              </table>
              <div className="signer-block">
                <div className="signer-name">{verifyData.approvedBy}</div>
                <div className="signer-title">{verifyData.signerTitle}</div>
                <div className="signer-company">{verifyData.companyName}</div>
                <div className="signer-stamp">Digitally Signed</div>
              </div>
              {verifyData.fileUrl && verifyData.fileUrl !== '-' && (
                <div style={{textAlign:'center'}}>
                  <a href={verifyData.fileUrl} target="_blank" className="btn-doc">
                    <i className="fas fa-file-alt" style={{marginRight:'8px'}}></i>Lihat Lampiran Surat
                  </a>
                </div>
              )}
            </div>
            <div className="footer">
              <p><i className="fas fa-qrcode" style={{marginRight:'4px'}}></i> Dokumen ini diverifikasi melalui Sistem QR Sign {verifyData.companyName}. QR Code bersifat unik dan tidak dapat dipalsukan.</p>
            </div>
          </div>
        </body>
      </html>
    );
  } catch (e) {
    return <div>Error: {e.message}</div>;
  }
}