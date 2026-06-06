'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

export default function AdminPage() {
  const { user, loading: authLoading } = useApp();
  const router = useRouter();
  
  const [stores, setStores] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Semua');
  const [selectedStore, setSelectedStore] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // overview, billing, audit

  // Form states
  const [actionType, setActionType] = useState('renew'); // renew, activate, change_plan
  const [selectedPlan, setSelectedPlan] = useState('Usaha');
  const [months, setMonths] = useState('1');
  const [notes, setNotes] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [ownerPhone, setOwnerPhone] = useState('');
  const [maxTransactions, setMaxTransactions] = useState(50);

  useEffect(() => {
    if (selectedStore) {
      setMaxTransactions(selectedStore.settings?.max_monthly_transactions ?? 50);
    }
  }, [selectedStore]);

  useEffect(() => {
    // Only fetch if user is verified admin
    if (!authLoading) {
      if (!user || !ADMIN_EMAIL || user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        router.push('/admin/login');
      } else {
        fetchAdminData();
      }
    }
  }, [user, authLoading, router]);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const res = await fetch('/api/admin', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.stores) {
        setStores(data.stores);
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminActionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStore) return;

    setSubmitLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          storeId: selectedStore.id,
          action: actionType,
          plan: actionType === 'renew' ? selectedStore.plan : selectedPlan,
          months: actionType === 'change_plan' ? null : months,
          maxTransactions: actionType === 'update_limit' ? maxTransactions : null,
          notes,
          adminId: user?.id
        })
      });

      const data = await res.json();
      if (data.success) {
        alert('Tindakan langganan berhasil disimpan!');
        setNotes('');
        setSelectedStore(null);
        await fetchAdminData();
      } else {
        alert(data.error || 'Terjadi kesalahan');
      }
    } catch (err) {
      console.error(err);
      alert('Gagal memproses tindakan admin');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Determine subscription status
  const getSubscriptionStatus = (storeObj) => {
    if (storeObj.plan === 'Gratis') {
      return { code: 'ACTIVE', text: 'Aktif (Gratis)', color: 'bg-emerald-500/10 text-emerald-400' };
    }
    if (!storeObj.subscription_end) {
      return { code: 'EXPIRED', text: 'Kedaluwarsa', color: 'bg-rose-500/10 text-rose-400' };
    }

    const now = new Date();
    const end = new Date(storeObj.subscription_end);
    const diffTime = end - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { code: 'EXPIRED', text: 'Kedaluwarsa', color: 'bg-rose-500/10 text-rose-400' };
    }
    if (diffDays <= 7) {
      return { code: 'EXPIRING', text: `Hampir Habis (${diffDays} hari)`, color: 'bg-amber-500/10 text-amber-400' };
    }
    return { code: 'ACTIVE', text: 'Aktif', color: 'bg-emerald-500/10 text-emerald-400' };
  };

  // Filter stores
  const filteredStores = stores.filter((st) => {
    const matchesSearch = st.name.toLowerCase().includes(search.toLowerCase());
    const status = getSubscriptionStatus(st);
    
    if (statusFilter === 'Semua') return matchesSearch;
    if (statusFilter === 'Aktif') return matchesSearch && status.code === 'ACTIVE';
    if (statusFilter === 'Hampir Habis') return matchesSearch && status.code === 'EXPIRING';
    if (statusFilter === 'Kedaluwarsa') return matchesSearch && status.code === 'EXPIRED';
    
    return matchesSearch;
  });

  const getWhatsAppShortcutLink = (storeObj) => {
    const endStr = storeObj.subscription_end 
      ? new Date(storeObj.subscription_end).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      : '-';

    const text = `Halo Kak pemilik toko *${storeObj.name}*,\n\n` +
      `Kami ingin menginfokan bahwa masa aktif langganan *Kasir Kita* Anda akan berakhir pada *${endStr}*.\n\n` +
      `Silakan hubungi kami kembali di nomor ini (085163612553) untuk melakukan perpanjangan paket agar transaksi kasir Anda tidak terhambat.\n\n` +
      `Terima kasih!`;

    const phone = ownerPhone.replace(/\D/g, ''); // strip non-numeric
    const targetPhone = phone.startsWith('0') ? '62' + phone.slice(1) : phone;

    return `https://wa.me/${targetPhone || ''}?text=${encodeURIComponent(text)}`;
  };

  // ACCESS CONTROL: Block non-admin users with clean redirect
  if (authLoading || !user || !ADMIN_EMAIL || user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-violet-400 font-semibold tracking-wide">Memverifikasi Gerbang Keamanan...</p>
        </div>
      </div>
    );
  }

  // Calculate metrics
  const totalStores = stores.length;
  const activeStores = stores.filter(st => getSubscriptionStatus(st).code === 'ACTIVE').length;
  const expiringStores = stores.filter(st => getSubscriptionStatus(st).code === 'EXPIRING').length;
  const expiredStores = stores.filter(st => getSubscriptionStatus(st).code === 'EXPIRED').length;

  const getEstimatedMRR = () => {
    let mrr = 0;
    stores.forEach((st) => {
      const status = getSubscriptionStatus(st);
      if (status.code === 'ACTIVE') {
        if (st.plan === 'Usaha') mrr += 49000;
        else if (st.plan === 'Berkembang') mrr += 99000;
        else if (st.plan === 'Bisnis') mrr += 199000;
      }
    });
    return mrr;
  };

  const planCounts = {
    Gratis: stores.filter(st => st.plan === 'Gratis').length,
    Usaha: stores.filter(st => st.plan === 'Usaha').length,
    Berkembang: stores.filter(st => st.plan === 'Berkembang').length,
    Bisnis: stores.filter(st => st.plan === 'Bisnis').length,
  };

  const getStoreName = (storeId) => {
    const store = stores.find(st => st.id === storeId);
    return store ? store.name : `Toko #${storeId.slice(0, 8)}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Admin Header */}
      <header className="bg-slate-900 border-b border-slate-800/80 px-6 py-4 flex items-center justify-between z-10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </Link>
          <div className="relative w-8 h-8 overflow-hidden rounded-lg shrink-0">
            <img src="/logo.png" alt="Kasir Kita Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg flex items-center gap-2">
              Kasir Kita<span className="text-violet-400">Console</span>
              <span className="bg-violet-500/10 text-violet-400 text-[10px] font-black uppercase px-2 py-0.5 rounded-md border border-violet-500/20">
                Back-Office
              </span>
            </h1>
            <p className="text-[10px] text-slate-500 font-medium tracking-wide">Pusat Manajemen Lisensi & Billing Toko</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex flex-col items-end text-right">
            <span className="text-xs font-semibold text-slate-300">{user?.email}</span>
            <span className="text-[9px] text-violet-400 uppercase tracking-widest font-bold">System Administrator</span>
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/admin/login');
            }}
            className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:border-rose-500/35 rounded-xl text-xs transition-all font-bold tracking-wide"
          >
            Keluar Admin
          </button>
        </div>
      </header>

      {/* Main Body Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 gap-6 text-sm">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3.5 font-bold transition-all relative flex items-center gap-2 ${
              activeTab === 'overview' ? 'text-violet-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2m0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            Ringkasan Platform
            {activeTab === 'overview' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-400" />}
          </button>
          <button
            onClick={() => setActiveTab('billing')}
            className={`pb-3.5 font-bold transition-all relative flex items-center gap-2 ${
              activeTab === 'billing' ? 'text-violet-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m-2 4a2 2 0 012 2m-2 4a2 2 0 012 2m-6-1h.01M9 16h.01M9 12h.01M9 8h.01M9 4h.01M12 4h.01M15 4h.01M12 1h.01M12 21h.01" /></svg>
            Kelola Lisensi Toko
            {activeTab === 'billing' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-400" />}
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-3.5 font-bold transition-all relative flex items-center gap-2 ${
              activeTab === 'audit' ? 'text-violet-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
            Audit Log Billing
            {activeTab === 'audit' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-400" />}
          </button>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-zoom-in">
            {/* Quick Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl flex flex-col justify-between">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Mitra Toko Terdaftar</p>
                <div className="flex items-baseline justify-between mt-3">
                  <span className="text-3xl font-black text-white">{totalStores}</span>
                  <span className="text-xs bg-slate-850 text-slate-400 font-bold px-2 py-0.5 rounded-md">Toko</span>
                </div>
              </div>
              <div className="bg-emerald-500/5 border border-emerald-500/10 p-6 rounded-2xl flex flex-col justify-between">
                <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Toko Aktif Berlangganan</p>
                <div className="flex items-baseline justify-between mt-3">
                  <span className="text-3xl font-black text-emerald-400">{activeStores}</span>
                  <span className="text-xs bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded-md">Aktif</span>
                </div>
              </div>
              <div className="bg-violet-500/5 border border-violet-500/10 p-6 rounded-2xl flex flex-col justify-between">
                <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Estimasi MRR Platform</p>
                <div className="flex items-baseline justify-between mt-3">
                  <span className="text-2xl font-black text-violet-400">Rp {getEstimatedMRR().toLocaleString('id-ID')}</span>
                  <span className="text-[10px] bg-violet-500/10 text-violet-400 font-bold px-2 py-0.5 rounded-md">Bulanan</span>
                </div>
              </div>
              <div className="bg-rose-500/5 border border-rose-500/10 p-6 rounded-2xl flex flex-col justify-between">
                <p className="text-xs font-semibold text-rose-400 uppercase tracking-wider">Masa Aktif Kedaluwarsa</p>
                <div className="flex items-baseline justify-between mt-3">
                  <span className="text-3xl font-black text-rose-400">{expiredStores}</span>
                  <span className="text-xs bg-rose-500/10 text-rose-400 font-bold px-2 py-0.5 rounded-md">Toko</span>
                </div>
              </div>
            </div>

            {/* Middle Section: Plan Distribution and Quick Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Plan Distribution */}
              <div className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl space-y-4 lg:col-span-1">
                <h3 className="font-extrabold text-md text-white">Distribusi Paket Berlangganan</h3>
                <div className="space-y-3 pt-2">
                  {[
                    { name: 'Gratis', count: planCounts.Gratis, price: 'Rp 0', color: 'bg-slate-400' },
                    { name: 'Usaha', count: planCounts.Usaha, price: 'Rp 49K', color: 'bg-emerald-400' },
                    { name: 'Berkembang', count: planCounts.Berkembang, price: 'Rp 99K', color: 'bg-violet-400' },
                    { name: 'Bisnis', count: planCounts.Bisnis, price: 'Rp 199K', color: 'bg-indigo-400' }
                  ].map((p) => {
                    const pct = totalStores > 0 ? (p.count / totalStores) * 100 : 0;
                    return (
                      <div key={p.name} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-300">{p.name} ({p.price})</span>
                          <span className="text-white">{p.count} Toko ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                          <div className={`h-full ${p.color}`} style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Latest Timeline Logs */}
              <div className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl space-y-4 lg:col-span-2">
                <h3 className="font-extrabold text-md text-white">Aktivitas Audit Langganan Terbaru</h3>
                <div className="space-y-4 pt-2">
                  {logs.slice(0, 4).length === 0 ? (
                    <p className="text-slate-500 text-xs py-8 text-center">Belum ada riwayat aktivitas terbaru.</p>
                  ) : (
                    logs.slice(0, 4).map((log) => (
                      <div key={log.id} className="flex gap-4 items-start text-xs border-b border-slate-800/40 pb-3 last:border-0 last:pb-0">
                        <div className="bg-violet-500/10 text-violet-400 font-bold p-2.5 rounded-xl uppercase text-[10px] tracking-wider mt-0.5">
                          {log.action}
                        </div>
                        <div className="flex-1 space-y-0.5">
                          <div className="flex justify-between font-semibold">
                            <span className="text-slate-200 font-bold">{getStoreName(log.store_id)}</span>
                            <span className="text-slate-500 text-[10px]">
                              {new Date(log.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-slate-400">
                            Perubahan plan: <span className="text-slate-200 font-bold">{log.plan_before} → {log.plan_after}</span> 
                            {log.period_months ? ` untuk ${log.period_months} Bulan` : ''}
                          </p>
                          {log.notes && (
                            <p className="text-slate-500 italic text-[10px] mt-0.5">Audit: "{log.notes}"</p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BILLING MANAGEMENT */}
        {activeTab === 'billing' && (
          <div className="flex flex-col lg:flex-row gap-8 items-start animate-zoom-in">
            {/* LEFT COLUMN: Stores List */}
            <section className="flex-1 w-full space-y-6">
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <h2 className="text-lg font-bold text-white self-start sm:self-auto flex items-center gap-2">
                  Manajemen Lisensi Toko
                  <span className="text-xs text-slate-500 font-normal">({filteredStores.length} hasil)</span>
                </h2>
                
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  {/* Search */}
                  <div className="relative text-xs w-full sm:w-64">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </span>
                    <input
                      type="text"
                      placeholder="Cari nama toko..."
                      className="w-full bg-slate-900/60 border border-slate-800/80 rounded-xl pl-9 pr-4 py-2.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>

                  {/* Filters */}
                  <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                    {['Semua', 'Aktif', 'Hampir Habis', 'Kedaluwarsa'].map((f) => (
                      <button
                        key={f}
                        onClick={() => setStatusFilter(f)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition-all ${
                          statusFilter === f
                            ? 'bg-violet-500 text-slate-950 shadow-md shadow-violet-500/10'
                            : 'bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="py-24 text-center text-slate-500">Memuat daftar toko...</div>
              ) : (
                <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
                  <div className="overflow-x-auto text-sm">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-500 font-semibold uppercase text-[10px] tracking-wider bg-slate-900/60">
                          <th className="px-6 py-4">Nama Toko & Tipe</th>
                          <th className="px-6 py-4">Tipe Plan</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Masa Aktif</th>
                          <th className="px-6 py-4 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {filteredStores.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                              Tidak ada toko terdaftar yang cocok dengan kriteria.
                            </td>
                          </tr>
                        ) : (
                          filteredStores.map((st) => {
                            const status = getSubscriptionStatus(st);
                            const endStr = st.subscription_end
                              ? new Date(st.subscription_end).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                              : 'Selamanya';

                            return (
                              <tr key={st.id} className={`hover:bg-slate-800/15 transition-colors ${selectedStore?.id === st.id ? 'bg-violet-500/5' : ''}`}>
                                <td className="px-6 py-4">
                                  <div className="font-bold text-slate-100">{st.name}</div>
                                  <div className="text-[10px] text-slate-500">{st.business_type}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`px-2 py-1 rounded text-xs font-semibold bg-slate-950 text-slate-300 border border-slate-800`}>
                                    {st.plan}
                                  </span>
                                  {st.plan === 'Gratis' && (
                                    <div className="text-[10px] text-slate-500 mt-1">Batas: {st.settings?.max_monthly_transactions ?? 50} tx/bln</div>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${status.color}`}>
                                    {status.text}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-xs text-slate-400 font-mono">{endStr}</td>
                                <td className="px-6 py-4 text-right">
                                  <button
                                    onClick={() => {
                                      setSelectedStore(st);
                                      setOwnerPhone('');
                                    }}
                                    className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl text-xs hover-scale transition-all"
                                  >
                                    Kelola
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>

            {/* RIGHT COLUMN: Action Management Panel */}
            <section className="w-full lg:w-96 shrink-0 space-y-6">
              {selectedStore ? (
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6 shadow-2xl animate-zoom-in">
                  <div>
                    <span className="text-[10px] text-violet-400 font-extrabold uppercase tracking-widest">Billing Controller</span>
                    <h3 className="font-extrabold text-xl text-white mt-1">{selectedStore.name}</h3>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">ID: {selectedStore.id}</p>
                  </div>

                  {/* ACTION FORM */}
                  <form onSubmit={handleAdminActionSubmit} className="space-y-4 text-sm">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Jenis Tindakan Billing
                      </label>
                      <div className={`grid ${selectedStore.plan === 'Gratis' ? 'grid-cols-4' : 'grid-cols-3'} gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800/80`}>
                        {[
                          { type: 'renew', text: 'Perpanjang' },
                          { type: 'activate', text: 'Aktifkan' },
                          { type: 'change_plan', text: 'Ubah Plan' },
                          ...(selectedStore.plan === 'Gratis' ? [{ type: 'update_limit', text: 'Batas Tx' }] : [])
                        ].map((opt) => (
                          <button
                            key={opt.type}
                            type="button"
                            onClick={() => setActionType(opt.type)}
                            className={`py-2 rounded-lg font-bold text-[9px] uppercase transition-all ${
                              actionType === opt.type
                                ? 'bg-violet-600 text-white shadow-md'
                                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                            }`}
                          >
                            {opt.text}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* If type is NOT renew and NOT update_limit, let them select plan */}
                    {actionType !== 'renew' && actionType !== 'update_limit' && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                          Pilih Paket Plan
                        </label>
                        <select
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-violet-500"
                          value={selectedPlan}
                          onChange={(e) => setSelectedPlan(e.target.value)}
                        >
                          <option value="Gratis">Gratis (Rp 0/bln)</option>
                          <option value="Usaha">Usaha (Rp 49.000/bln)</option>
                          <option value="Berkembang">Berkembang (Rp 99.000/bln)</option>
                          <option value="Bisnis">Bisnis (Rp 199.000/bln)</option>
                        </select>
                      </div>
                    )}

                    {/* If type is NOT change_plan and NOT update_limit, let them select period */}
                    {actionType !== 'change_plan' && actionType !== 'update_limit' && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                          Durasi Langganan
                        </label>
                        <select
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-violet-500"
                          value={months}
                          onChange={(e) => setMonths(e.target.value)}
                        >
                          <option value="1">1 Bulan</option>
                          <option value="3">3 Bulan</option>
                          <option value="6">6 Bulan</option>
                          <option value="12">12 Bulan (1 Tahun)</option>
                        </select>
                      </div>
                    )}

                    {/* If type is update_limit, render increment/decrement limit inputs */}
                    {actionType === 'update_limit' && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                          Batas Transaksi per Bulan
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setMaxTransactions(prev => Math.max(0, prev - 10))}
                            className="bg-slate-950 border border-slate-800 hover:bg-slate-800 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-300 transition-colors"
                          >
                            -10
                          </button>
                          <input
                            type="number"
                            required
                            min="0"
                            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-center text-slate-100 font-extrabold text-md focus:outline-none focus:border-violet-500"
                            value={maxTransactions}
                            onChange={(e) => setMaxTransactions(Math.max(0, parseInt(e.target.value) || 0))}
                          />
                          <button
                            type="button"
                            onClick={() => setMaxTransactions(prev => prev + 10)}
                            className="bg-slate-950 border border-slate-800 hover:bg-slate-800 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-300 transition-colors"
                          >
                            +10
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1.5">Batas transaksi bulanan default untuk plan Gratis adalah 50 transaksi.</p>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Catatan Audit
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="cth: Pembayaran via Transfer Bank BCA"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 placeholder:text-slate-700 focus:outline-none focus:border-violet-500"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitLoading}
                      className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-3 rounded-xl shadow-lg flex justify-center items-center gap-2 transition-colors mt-2"
                    >
                      {submitLoading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        'Terapkan Perubahan Billing'
                      )}
                    </button>
                  </form>

                  {/* WHATSAPP FOLLOW UP SHORTCUT */}
                  <div className="border-t border-slate-800/80 pt-5 space-y-3">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Hubungi Pemilik via WA
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="cth: 085163612553"
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                        value={ownerPhone}
                        onChange={(e) => setOwnerPhone(e.target.value)}
                      />
                      <a
                        href={getWhatsAppShortcutLink(selectedStore)}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 px-4 py-2.5 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shrink-0 transition-colors"
                      >
                        Hubungi
                      </a>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-normal">Membuka WhatsApp langsung dengan pesan reminder masa aktif terisi otomatis.</p>
                  </div>

                  {/* SHOW LOGS FOR THIS STORE */}
                  <div className="border-t border-slate-800/80 pt-5 space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Riwayat Log Langganan</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {logs.filter(l => l.store_id === selectedStore.id).length === 0 ? (
                        <p className="text-slate-600 text-xs">Belum ada riwayat perubahan.</p>
                      ) : (
                        logs
                          .filter(l => l.store_id === selectedStore.id)
                          .map((log) => (
                            <div key={log.id} className="bg-slate-950/65 border border-slate-850 p-3 rounded-xl text-[11px] space-y-1.5">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-violet-400 font-bold uppercase">{log.action}</span>
                                <span className="text-slate-500">
                                  {new Date(log.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                </span>
                              </div>
                              <p className="text-slate-300 font-semibold">{log.plan_before} → {log.plan_after} {log.period_months ? `(${log.period_months} bln)` : ''}</p>
                              {log.notes && <p className="text-slate-500 italic text-[10px]">Note: {log.notes}</p>}
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-64 border-2 border-dashed border-slate-800/80 rounded-2xl flex flex-col items-center justify-center text-center text-slate-600 p-6">
                  <svg className="w-10 h-10 mb-3 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                  <p className="text-xs font-semibold max-w-[200px] leading-relaxed">Pilih salah satu toko di daftar tabel untuk mengelola paket, billing, atau menghubungi pemilik toko.</p>
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 3: AUDIT LOGS */}
        {activeTab === 'audit' && (
          <div className="space-y-6 animate-zoom-in">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Audit Trail Log Penjualan Paket & Billing
                <span className="text-xs text-slate-500 font-normal">({logs.length} total entri)</span>
              </h2>
            </div>

            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto text-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 font-semibold uppercase text-[10px] tracking-wider bg-slate-900/60">
                      <th className="px-6 py-4">Waktu Audit</th>
                      <th className="px-6 py-4">Toko Penerima</th>
                      <th className="px-6 py-4">Tindakan</th>
                      <th className="px-6 py-4">Perubahan Plan</th>
                      <th className="px-6 py-4">Durasi Kontrak</th>
                      <th className="px-6 py-4">Catatan Administrator</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                          Tidak ada logs audit tersimpan.
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-800/10 transition-colors">
                          <td className="px-6 py-4 text-xs font-mono text-slate-400">
                            {new Date(log.created_at).toLocaleString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-200">
                            {getStoreName(log.store_id)}
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-0.5 bg-violet-500/10 text-violet-400 text-[10px] font-black uppercase rounded border border-violet-500/10">
                              {log.action}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-300">
                            {log.plan_before} → {log.plan_after}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-400">
                            {log.period_months ? `${log.period_months} Bulan` : '-'}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-400 max-w-xs truncate italic" title={log.notes}>
                            {log.notes || '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
