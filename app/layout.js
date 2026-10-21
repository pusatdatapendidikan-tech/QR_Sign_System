import { Plus_Jakarta_Sans } from 'next/font/google';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'sweetalert2/dist/sweetalert2.min.css';
import './globals.css';

// Inisialisasi font Plus Jakarta Sans
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-jakarta',
});

export const metadata = {
  title: 'SIPASTI - Sistem Persetujuan dan Administrasi Surat Terintegrasi',
  description: 'Sistem Persetujuan dan Administrasi Surat Terintegrasi',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={jakarta.variable}>
      <body>
        {children}
      </body>
    </html>
  );
}