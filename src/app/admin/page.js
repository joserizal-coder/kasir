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

  // Form states
  const [actionType, setActionType] = useState('renew'); // renew, activate, change_plan
  const [selectedPlan, setSelectedPlan] = useState('Usaha');
  const [months, setMonths] = useState('1');
  const [notes, setNotes] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [ownerPhone, setOwnerPhone] = useState('');

  useEffect(() => {
    // Only fetch if user is verified admin
    if (!authLoading) {
      if (!user || user.email !== ADMIN_EMAIL) {
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
      `Kami ingin menginfokan bahwa masa aktif langganan *KasirKu* Anda akan berakhir pada *${endStr}*.\n\n` +
      `Silakan hubungi kami kembali di nomor ini (085163612553) untuk melakukan perpanjangan paket agar transaksi kasir Anda tidak terhambat.\n\n` +
      `Terima kasih!`;

    const phone = ownerPhone.replace(/\D/g, ''); // strip non-numeric
    const targetPhone = phone.startsWith('0') ? '62' + phone.slice(1) : phone;

    return `https://wa.me/${targetPhone || ''}?text=${encodeURIComponent(text)}`;
  };

  // ACCESS CONTROL: Block non-admin users with clean redirect
  if (authLoading || !user || user.email !== ADMIN_EMAIL) {
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Admin Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </Link>
          <div>
            <h1 className="font-bold text-md flex items-center gap-2">
              Panel Admin KasirKu
              <span className="bg-violet-500 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                Billing Manager
              </span>
            </h1>
            <p className="text-[10px] text-slate-400">Kelola aktivasi & perpanjangan paket berlangganan manual</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 hidden sm:inline">{user?.email}</span>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/admin/login');
            }}
            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs transition-all font-semibold"
          >
            Keluar Admin
          </button>
        </div>
      </header>

      {/* Main Body Grid */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 flex flex-col lg:flex-row gap-8">
        
        {/* LEFT COLUMN: Stores List */}
        <section className="flex-1 space-y-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative text-sm">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </span>
              <input
                type="text"
                placeholder="Cari toko berdasarkan nama..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex gap-1.5 overflow-x-auto">
              {['Semua', 'Aktif', 'Hampir Habis', 'Kedaluwarsa'].map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all ${
                    statusFilter === f
                      ? 'bg-violet-500 text-slate-950 shadow-md shadow-violet-500/10'
                      : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-slate-500">Memuat daftar toko...</div>
          ) : (
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto text-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider bg-slate-900/60">
                      <th className="px-6 py-4">Nama Toko</th>
                      <th className="px-6 py-4">Tipe Plan</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Masa Aktif</th>
                      <th className="px-6 py-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredStores.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-10 text-center text-slate-500">
                          Tidak ada toko yang cocok.
                        </td>
                      </tr>
                    ) : (
                      filteredStores.map((st) => {
                        const status = getSubscriptionStatus(st);
                        const endStr = st.subscription_end
                          ? new Date(st.subscription_end).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                          : 'Selamanya';

                        return (
                          <tr key={st.id} className={`hover:bg-slate-800/20 transition-colors ${selectedStore?.id === st.id ? 'bg-violet-500/5' : ''}`}>
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-100">{st.name}</div>
                              <div className="text-[10px] text-slate-500">{st.business_type}</div>
                            </td>
                            <td className="px-6 py-4 font-semibold text-slate-300">{st.plan}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${status.color}`}>
                                {status.text}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-400">{endStr}</td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => {
                                  setSelectedStore(st);
                                  // Reset phone state if available
                                  setOwnerPhone('');
                                }}
                                className="px-3.5 py-1.5 bg-violet-500 hover:bg-violet-400 text-slate-950 font-bold rounded-lg text-xs hover-scale transition-all"
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
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6 shadow-2xl animate-zoom-in">
              <div>
                <span className="text-[10px] text-violet-400 font-extrabold uppercase tracking-widest">KELOLA TOKO</span>
                <h3 className="font-extrabold text-xl text-white mt-1">{selectedStore.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">ID: {selectedStore.id.slice(0, 8)}</p>
              </div>

              {/* ACTION FORM */}
              <form onSubmit={handleAdminActionSubmit} className="space-y-4 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Jenis Tindakan Billing
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { type: 'renew', text: 'Perpanjang' },
                      { type: 'activate', text: 'Aktifkan' },
                      { type: 'change_plan', text: 'Ubah Plan' }
                    ].map((opt) => (
                      <button
                        key={opt.type}
                        type="button"
                        onClick={() => setActionType(opt.type)}
                        className={`py-2 rounded-lg font-bold text-[10px] uppercase border transition-all ${
                          actionType === opt.type
                            ? 'bg-violet-500 border-violet-500 text-slate-950'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-850'
                        }`}
                      >
                        {opt.text}
                      </button>
                    ))}
                  </div>
                </div>

                {/* If type is NOT renew, let them select plan */}
                {actionType !== 'renew' && (
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

                {/* If type is NOT change_plan, let them select period */}
                {actionType !== 'change_plan' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Durasi Langganan (Bulan)
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
                  className="w-full bg-violet-500 hover:bg-violet-400 text-slate-950 font-bold py-3 rounded-xl shadow-lg flex justify-center items-center gap-2 tap-effect"
                >
                  {submitLoading ? (
                    <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'Terapkan Perubahan Billing'
                  )}
                </button>
              </form>

              {/* WHATSAPP FOLLOW UP SHORTCUT */}
              <div className="border-t border-slate-800 pt-5 space-y-3">
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
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2.5 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shrink-0"
                  >
                    Hubungi
                  </a>
                </div>
                <p className="text-[10px] text-slate-500">Membuka WhatsApp langsung dengan pesan reminder masa aktif terisi otomatis.</p>
              </div>

              {/* SHOW LOGS FOR THIS STORE */}
              <div className="border-t border-slate-800 pt-5 space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Riwayat Log Langganan</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {logs.filter(l => l.store_id === selectedStore.id).length === 0 ? (
                    <p className="text-slate-600 text-xs">Belum ada riwayat perubahan.</p>
                  ) : (
                    logs
                      .filter(l => l.store_id === selectedStore.id)
                      .map((log) => (
                        <div key={log.id} className="bg-slate-950/60 border border-slate-850 p-3 rounded-xl text-xs space-y-1.5">
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
            <div className="h-48 border-2 border-dashed border-slate-800 rounded-3xl flex flex-col items-center justify-center text-center text-slate-600 p-6">
              <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <p className="text-sm font-semibold">Pilih toko di tabel sebelah kiri untuk mengelola paket berlangganan atau follow up.</p>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
