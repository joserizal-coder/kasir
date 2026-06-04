import { AppProvider } from '../context/AppContext';
import './globals.css';

export const metadata = {
  title: "Kasir Kita - Aplikasi Kasir & Pembukuan UKM Indonesia",
  description: "Platform Kasir & Pembukuan Simpel, Terjangkau, dan Bisa Offline khusus untuk UKM Indonesia.",
  manifest: "/manifest.json",
  icons: {
    icon: '/favicon.svg?v=2',
    apple: '/favicon.svg?v=2',
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
