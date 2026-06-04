'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    // Check if already logged in as admin
    const checkActiveAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && ADMIN_EMAIL && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        router.push('/admin');
      } else {
        setCheckingSession(false);
      }
    };
    checkActiveAdmin();
  }, [router]);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Sign in with password
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      const user = data?.user;

      // 2. Validate email is the admin email (case-insensitive)
      if (user && ADMIN_EMAIL && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        router.push('/admin');
      } else {
        // Sign out immediately if not admin
        await supabase.auth.signOut();
        if (!ADMIN_EMAIL) {
          setError('Gagal masuk: Konfigurasi NEXT_PUBLIC_ADMIN_EMAIL belum terbaca oleh sistem. Silakan restart server dev lokal Anda.');
        } else {
          setError('Akses ditolak. Email ini tidak terdaftar sebagai Administrator Kasir Kita.');
        }
      }
    } catch (err) {
      setError(err.message || 'Gagal login. Periksa kembali email dan password Anda.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-violet-400 font-semibold tracking-wide">Memverifikasi Gerbang Keamanan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center overflow-hidden relative px-6">
      {/* Background decoration */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-violet-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900/60 border border-slate-800/80 p-8 rounded-3xl shadow-2xl relative z-10 backdrop-blur-md">
        {/* Title Logo */}
        <div className="flex flex-col items-center text-center space-y-3 mb-8">
          <div className="w-14 h-14 bg-gradient-to-tr from-violet-600 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/20 text-white font-extrabold text-2xl tracking-tighter">
            K
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Kasir<span className="text-violet-400">Ku</span> Admin</h1>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-semibold">Security Gate</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/25 rounded-2xl text-rose-400 text-xs font-medium leading-relaxed">
            {error}
          </div>
        )}

        <form onSubmit={handleAdminLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Email Administrator
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@kasirkita.id"
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3.5 text-slate-100 placeholder:text-slate-700 focus:outline-none focus:border-violet-500 transition-colors text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Kata Sandi
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3.5 text-slate-100 placeholder:text-slate-700 focus:outline-none focus:border-violet-500 transition-colors text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-2xl shadow-xl shadow-violet-950/40 hover:shadow-violet-900/50 transition-all text-sm flex justify-center items-center gap-2 mt-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              'Verifikasi & Masuk'
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-800/60 text-center">
          <Link
            href="/"
            className="text-xs text-slate-500 hover:text-slate-300 font-semibold transition-colors"
          >
            ← Kembali ke Dashboard Utama
          </Link>
        </div>
      </div>
    </div>
  );
}
