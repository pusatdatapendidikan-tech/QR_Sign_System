import nodemailer from 'nodemailer';

// Inisialisasi transporter Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // true untuk port 465
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Fungsi utama untuk kirim email
 */
export async function sendEmail({ to, subject, html }) {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn('EMAIL_USER atau EMAIL_PASS belum diset di env');
      return { success: false, error: 'Email credentials not set' };
    }

    await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'QR Sign System'}" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log(`Email terkirim ke: ${to}`);
    return { success: true };
  } catch (error) {
    console.error('Gagal kirim email:', error.message);
    return { success: false, error: error.message };
  }
}