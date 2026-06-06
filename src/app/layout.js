import { AppProvider } from '../context/AppContext';
import { ToastProvider } from '../components/Toast';
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
      <body className="flex flex-col min-h-screen">
        <AppProvider>
          <ToastProvider>
            <div className="flex-1 flex flex-col main-app-content">
              {children}
            </div>
            <footer className="py-6 text-center text-xs text-slate-500 bg-slate-950 border-t border-slate-900 z-10 shrink-0">
              By Ratakiri | 2026
            </footer>
          </ToastProvider>
        </AppProvider>
        <div id="print-root"></div>
      </body>
    </html>
  );
}
