'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import Link from 'next/link';

export default function Home() {
  const {
    user,
    loading,
    store,
    cashier,
    online,
    syncing,
    products,
    createStore,
    triggerSync,
    updateStoreSettings,
    updateStore
  } = useApp();

  // Auth form states
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Onboarding states
  const [storeName, setStoreName] = useState('');
  const [businessType, setBusinessType] = useState('Warung Makan');
  const [onboardingStep, setOnboardingStep] = useState(1); // 1: Info Toko, 2: Produk Sukses, 3: Transaksi Pertama

  // QRIS state and handlers
  const [uploadingQris, setUploadingQris] = useState(false);

  // Store profile edit states
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [savingStore, setSavingStore] = useState(false);

  useEffect(() => {
    if (store) {
      setEditName(store.name || '');
      setEditAddress(store.address || '');
      setEditPhone(store.settings?.whatsapp_phone || '');
    }
  }, [store]);

  const handleUpdateStore = async (e) => {
    e.preventDefault();
    if (!editName.trim()) {
      alert('Nama toko tidak boleh kosong.');
      return;
    }
    setSavingStore(true);
    try {
      const res = await updateStore({
        name: editName.trim(),
        address: editAddress.trim(),
        settings: {
          whatsapp_phone: editPhone.trim()
        }
      });
      if (res.success) {
        alert('Profil Toko berhasil diperbarui!');
      } else {
        alert(res.error || 'Gagal memperbarui profil toko.');
      }
    } catch (err) {
      alert(err.message || 'Terjadi kesalahan.');
    } finally {
      setSavingStore(false);
    }
  };

  // Upgrade Modal states & helpers
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradePlan, setUpgradePlan] = useState('Usaha');
  const [upgradeDuration, setUpgradeDuration] = useState(1); // 1, 3, 6, 12 months

  const getUpgradePriceDetails = () => {
    const prices = {
      Usaha: 49000,
      Berkembang: 99000,
      Bisnis: 199000
    };
    
    const basePrice = prices[upgradePlan] || 49000;
    const totalBeforeDiscount = basePrice * upgradeDuration;
    
    let discountPercent = 0;
    if (upgradeDuration === 3) discountPercent = 5;
    else if (upgradeDuration === 6) discountPercent = 10;
    else if (upgradeDuration === 12) discountPercent = 20;
    
    const discountAmount = Math.round(totalBeforeDiscount * (discountPercent / 100));
    const totalPrice = totalBeforeDiscount - discountAmount;
    
    return {
      basePrice,
      totalBeforeDiscount,
      discountPercent,
      discountAmount,
      totalPrice
    };
  };

  const getUpgradeWhatsAppLink = () => {
    const details = getUpgradePriceDetails();
    const formatRp = (n) => `Rp ${n.toLocaleString('id-ID')}`;
    
    const text = 
      `Halo Admin Kasir Kita,\n\n` +
      `Saya ingin mengajukan perpanjangan/upgrade langganan toko:\n` +
      `• *Nama Toko*: ${store?.name || ''}\n` +
      `• *ID Toko*: ${store?.id || ''}\n` +
      `• *Paket Pilihan*: Paket ${upgradePlan}\n` +
      `• *Durasi*: ${upgradeDuration} Bulan\n` +
      `• *Rincian Biaya*: ${formatRp(details.totalPrice)} ` + 
      (details.discountPercent > 0 ? `(Sudah diskon ${details.discountPercent}%)` : '') + `\n\n` +
      `Mohon rincian rekening untuk pembayaran. Terima kasih!`;
      
    return `https://wa.me/6285163612553?text=${encodeURIComponent(text)}`;
  };

  const handleQrisUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Cek format file gambar
    if (!file.type.startsWith('image/')) {
      alert('File harus berupa gambar (PNG, JPG, dll).');
      return;
    }

    setUploadingQris(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 400;
            const MAX_HEIGHT = 400;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
            resolve(compressedDataUrl);
          };
          img.onerror = () => reject(new Error('Gagal memuat gambar. Pastikan file gambar valid.'));
          img.src = event.target.result;
        };
        reader.onerror = () => reject(new Error('Gagal membaca file.'));
        reader.readAsDataURL(file);
      });

      const res = await updateStoreSettings({ qris_code: dataUrl });
      if (res.success) {
        alert('QRIS Toko berhasil diperbarui!');
      } else {
        alert(res.error || 'Gagal memperbarui QRIS.');
      }
    } catch (err) {
      alert(err.message || 'Terjadi kesalahan saat memproses gambar.');
    } finally {
      setUploadingQris(false);
    }
  };

  const handleQrisDelete = async () => {
    if (!confirm('Apakah Anda yakin ingin menghapus QRIS Toko?')) return;
    setUploadingQris(true);
    try {
      const res = await updateStoreSettings({ qris_code: null });
      if (res.success) {
        alert('QRIS Toko berhasil dihapus.');
      } else {
        alert(res.error || 'Gagal menghapus QRIS.');
      }
    } catch (err) {
      alert(err.message || 'Terjadi kesalahan saat menghapus QRIS.');
    } finally {
      setUploadingQris(false);
    }
  };

  // Handle Login / Registration
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      if (isRegister) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        alert('Pendaftaran berhasil! Silakan cek email Anda untuk konfirmasi, atau langsung coba masuk jika email konfirmasi dilewati.');
        setIsRegister(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err) {
      setAuthError(err.message || 'Terjadi kesalahan otentikasi');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleCreateStoreSubmit = async (e) => {
    e.preventDefault();
    if (!storeName.trim()) return;
    const res = await createStore(storeName, businessType);
    if (res.success) {
      setOnboardingStep(2); // Proceed to starter products added step
    } else {
      alert(res.error || 'Gagal membuat toko');
    }
  };

  // Loading state screen
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-emerald-400 font-semibold tracking-wide">Memuat Kasir Kita...</p>
        </div>
      </div>
    );
  }

  // CASE 1: User is NOT logged in. Show beautiful landing page & Auth forms.
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden relative">
        {/* Abstract Background Lights */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-600/10 rounded-full blur-[120px] pointer-events-none"></div>

        {/* Header */}
        <header className="max-w-6xl w-full mx-auto px-6 py-6 flex items-center justify-between border-b border-slate-900/80 z-10">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-500 text-slate-950 w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xl shadow-lg shadow-emerald-500/20">
              K
            </div>
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              Kasir<span className="text-emerald-400">Kita</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${online ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
              {online ? 'Online' : 'Offline'}
            </span>
          </div>
        </header>

        {/* Hero Section */}
        <main className="max-w-6xl w-full mx-auto px-6 py-12 flex-1 flex flex-col lg:flex-row items-center gap-12 z-10">
          <div className="flex-1 text-center lg:text-left space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 text-slate-300 text-xs border border-slate-800">
              <span className="bg-emerald-500 text-slate-950 font-bold px-2 py-0.5 rounded-full text-[10px]">
                BARU
              </span>
              <span>Platform Pembukuan Khusus UKM Indonesia</span>
            </div>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight text-white">
              Kelola Toko Lebih <br />
              <span className="text-emerald-400 bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                Mudah & Bisa Offline
              </span>
            </h1>
            <p className="text-slate-400 text-lg max-w-xl mx-auto lg:mx-0">
              Kasir mobile offline-first dengan pembukuan otomatis dan laporan pajak siap saji. Sangat simpel untuk pemilik warung, kafe, dan ritel.
            </p>
            <div className="flex flex-wrap justify-center lg:justify-start gap-6 pt-4 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                <span>Bisa Offline Penuh</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                <span>Struk WA Otomatis</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                <span>Gratis (Maks. 100 Trx/Bulan)</span>
              </div>
            </div>
          </div>

          {/* Auth Card */}
          <div className="w-full max-w-md bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl">
            <h2 className="text-2xl font-bold mb-2">
              {isRegister ? 'Buat Akun Baru' : 'Masuk ke Kasir Kita'}
            </h2>
            <p className="text-slate-400 text-sm mb-6">
              {isRegister 
                ? 'Daftarkan email Anda untuk mulai mengelola pembukuan toko.' 
                : 'Masukkan email dan sandi Anda untuk mengakses mesin kasir.'}
            </p>

            {authError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-sm mb-4">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Alamat Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="nama@tokomu.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Kata Sandi
                </label>
                <input
                  type="password"
                  required
                  placeholder="Min. 6 Karakter"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-500/15 tap-effect transition-all flex justify-center items-center gap-2"
              >
                {authLoading ? (
                  <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  isRegister ? 'Daftar Sekarang' : 'Masuk Sekarang'
                )}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-400">
              {isRegister ? (
                <p>
                  Sudah punya akun?{' '}
                  <button onClick={() => setIsRegister(false)} className="text-emerald-400 font-semibold hover:underline">
                    Masuk di sini
                  </button>
                </p>
              ) : (
                <p>
                  Belum punya akun?{' '}
                  <button onClick={() => setIsRegister(true)} className="text-emerald-400 font-semibold hover:underline">
                    Daftar gratis
                  </button>
                </p>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // CASE 2: User is logged in but has NO store. Show Onboarding Flow Step 1: Create Store.
  if (user && !store) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-6 relative">
        <div className="absolute top-[-10%] w-[80%] h-[30%] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="w-full max-w-lg bg-slate-900/50 border border-slate-800 p-8 rounded-3xl shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <span className="text-emerald-400 font-bold text-xs uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full">
              Langkah 1 dari 3
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Siapkan Toko Pertama Anda
            </h1>
            <p className="text-slate-400 text-sm">
              Mulai pencatatan dengan memasukkan informasi dasar usaha Anda.
            </p>
          </div>

          <form onSubmit={handleCreateStoreSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Nama Toko / Warung
              </label>
              <input
                type="text"
                required
                placeholder="cth: Warung Makan Bu Kris, Toko Sembako Jaya"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Jenis Usaha
              </label>
              <select
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-emerald-500 transition-colors"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
              >
                <option value="Warung Makan">Warung Makan / Kuliner</option>
                <option value="Toko Kelontong">Toko Kelontong / Retail</option>
                <option value="Pakaian">Pakaian / Fashion</option>
                <option value="Jasa">Jasa / Salon / Bengkel</option>
                <option value="Lain-lain">Lain-lain</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3.5 px-4 rounded-xl shadow-lg tap-effect transition-all flex justify-center items-center gap-2"
            >
              Buat Toko & Lanjut
            </button>
          </form>
        </div>
      </div>
    );
  }

  // CASE 3: User logged in, has store, but onboarding is not fully complete (Step 2 or 3).
  // Step 2 shows: "We added 3 starter products for you!" and allows transitioning.
  if (user && store && onboardingStep === 2) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-6 relative">
        <div className="w-full max-w-lg bg-slate-900/50 border border-slate-800 p-8 rounded-3xl shadow-2xl space-y-6 text-center">
          <span className="text-emerald-400 font-bold text-xs uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full">
            Langkah 2 dari 3
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Produk Pemula Ditambahkan!
          </h1>
          <p className="text-slate-400 text-sm">
            Kami telah menambahkan **3 produk contoh** ke toko Anda agar Anda bisa langsung mencoba transaksi tanpa mengetik dari nol:
          </p>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 text-left space-y-3 text-sm">
            {products.map((p) => (
              <div key={p.id} className="flex justify-between items-center border-b border-slate-900 pb-2 last:border-0 last:pb-0">
                <div>
                  <p className="font-semibold text-slate-200">{p.name}</p>
                  <p className="text-slate-500 text-xs">{p.category} · {p.stock} {p.unit}</p>
                </div>
                <p className="font-bold text-emerald-400">Rp {p.price.toLocaleString('id-ID')}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => setOnboardingStep(3)}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3.5 px-4 rounded-xl shadow-lg tap-effect transition-all flex justify-center items-center gap-2"
          >
            Lanjut ke Simulasi Transaksi
          </button>
        </div>
      </div>
    );
  }

  // Step 3 shows: "Try your first transaction simulation!"
  if (user && store && onboardingStep === 3) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-6 relative">
        <div className="w-full max-w-lg bg-slate-900/50 border border-slate-800 p-8 rounded-3xl shadow-2xl space-y-6 text-center">
          <span className="text-emerald-400 font-bold text-xs uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full">
            Langkah 3 dari 3
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Simulasi Transaksi Pertama
          </h1>
          <p className="text-slate-400 text-sm">
            Ayo coba buka layar kasir, tap salah satu produk contoh, pilih metode pembayaran tunai, dan selesaikan transaksi pertama Anda dalam kurang dari 30 detik!
          </p>

          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-2xl text-sm flex gap-3 text-left">
            <svg className="w-6 h-6 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p>
              <strong>Tips Warung:</strong> Setelah mencoba simulasi transaksi pertama, onboarding Anda selesai dan tombol menu laporan otomatis terbuka!
            </p>
          </div>

          <Link
            href="/app/cashier"
            onClick={() => setOnboardingStep(4)} // Complete onboarding step state
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3.5 px-4 rounded-xl shadow-lg tap-effect transition-all flex justify-center items-center gap-2"
          >
            Buka Layar Kasir Sekarang
          </Link>
        </div>
      </div>
    );
  }

  // CASE 4: Logged in, store created, onboarding complete. Show Dashboard HUB.
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-500 text-slate-950 w-9 h-9 rounded-lg flex items-center justify-center font-bold text-lg">
            K
          </div>
          <div>
            <h1 className="font-extrabold text-md tracking-tight leading-tight">
              {store.name}
            </h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">{store.business_type}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${store.plan === 'Gratis' ? 'bg-slate-800 text-slate-300' : 'bg-emerald-500/10 text-emerald-400'}`}>
            Plan {store.plan}
          </span>
          <button
            onClick={triggerSync}
            disabled={syncing}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors shrink-0"
            title="Sinkronisasi Data"
          >
            <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3m0 0l3 3m-3-3v12" /></svg>
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs transition-all font-semibold"
          >
            Keluar
          </button>
        </div>
      </header>

      {/* Main Panel HUB */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-10 space-y-8">
        {/* Status Box */}
        <div className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Status Toko Anda</p>
            <h2 className="text-xl font-bold flex items-center gap-2">
              Masa Aktif Langganan
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${online ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} title={online ? 'Sistem Online' : 'Sistem Offline'}></span>
            </h2>
            <p className="text-sm text-slate-400">
              {store.subscription_end 
                ? `Berakhir pada: ${new Date(store.subscription_end).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`
                : 'Masa aktif: Selamanya (Free Plan)'}
            </p>
          </div>

          <div className="flex gap-3">
            {user && user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL && (
              <Link
                href="/admin"
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-semibold rounded-xl transition-all"
              >
                Ke Panel Admin
              </Link>
            )}
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold rounded-xl shadow-lg transition-all tap-effect"
            >
              Perpanjang/Upgrade Plan
            </button>
          </div>
        </div>

        {/* Store Profile Card */}
        <div className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-3xl space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Profil & Identitas Toko
            </h2>
            <p className="text-sm text-slate-400">
              Ubah informasi dasar toko Anda. Detail ini otomatis ditampilkan pada bagian atas nota dan invoice belanja.
            </p>
          </div>

          <form onSubmit={handleUpdateStore} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Nama Toko
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nama toko/warung Anda"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-violet-500"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  No. WhatsApp Toko
                </label>
                <input
                  type="text"
                  placeholder="cth: 08123456789"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-violet-500"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Alamat Toko
              </label>
              <textarea
                placeholder="Alamat lengkap toko (akan ditampilkan di nota)"
                rows="2"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-violet-500"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingStore}
                className="bg-violet-600 hover:bg-violet-500 text-white font-bold px-6 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-violet-600/10 transition-colors tap-effect"
              >
                {savingStore ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </form>
        </div>

        {/* QRIS Settings Card */}
        <div className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-3xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                QRIS Pembayaran Toko
              </h2>
              <p className="text-sm text-slate-400">
                Unggah QR code QRIS toko Anda agar pelanggan bisa memindai pembayaran non-tunai secara langsung di layar kasir.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <label className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold rounded-xl shadow-lg cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-50">
                {uploadingQris ? (
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                )}
                <span>{store.settings?.qris_code ? 'Ganti Gambar' : 'Unggah QRIS'}</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingQris}
                  className="hidden"
                  onChange={handleQrisUpload}
                />
              </label>
              
              {store.settings?.qris_code && (
                <button
                  onClick={handleQrisDelete}
                  disabled={uploadingQris}
                  className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-sm font-semibold rounded-xl transition-all"
                >
                  Hapus
                </button>
              )}
            </div>
          </div>

          {store.settings?.qris_code ? (
            <div className="flex items-center gap-4 bg-slate-950/40 border border-slate-800/80 p-4 rounded-2xl max-w-sm">
              <div className="w-24 h-24 bg-white rounded-xl overflow-hidden flex items-center justify-center p-1.5 shrink-0 shadow-md">
                <img
                  src={store.settings.qris_code}
                  alt="QRIS Toko"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Tampilan Aktif</p>
                <p className="text-sm font-bold text-white">QRIS Kustom Terpasang</p>
                <p className="text-xs text-slate-500">QR Code ini otomatis muncul di layar kasir ketika memilih pembayaran QRIS.</p>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950/20 border border-dashed border-slate-800 p-6 rounded-2xl text-center space-y-2">
              <p className="text-sm text-slate-400">Belum ada QRIS kustom yang diunggah.</p>
              <p className="text-xs text-slate-500">Saat transaksi QRIS, sistem kasir akan menampilkan QRIS simulasi default.</p>
            </div>
          )}
        </div>

        {/* Shortcut Menus */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Link
            href="/app/cashier"
            className="group bg-slate-900 hover:bg-emerald-500/5 hover:border-emerald-500/40 border border-slate-800/80 p-8 rounded-3xl transition-all flex flex-col space-y-4 hover-scale"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-slate-950 transition-all shadow-md">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-lg">Buka Kasir</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Catat transaksi penjualan kasir, cetak atau kirim struk online via WhatsApp.</p>
            </div>
          </Link>

          <Link
            href="/app/products"
            className="group bg-slate-900 hover:bg-violet-500/5 hover:border-violet-500/40 border border-slate-800/80 p-8 rounded-3xl transition-all flex flex-col space-y-4 hover-scale"
          >
            <div className="w-12 h-12 rounded-2xl bg-violet-500/10 text-violet-400 flex items-center justify-center group-hover:bg-violet-500 group-hover:text-slate-950 transition-all shadow-md">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-lg">Kelola Produk</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Ubah harga jual, pantau dan isi ulang stok, serta kelola kategori barang dagangan.</p>
            </div>
          </Link>

          <Link
            href="/app/reports"
            className="group bg-slate-900 hover:bg-amber-500/5 hover:border-accent/40 border border-slate-800/80 p-8 rounded-3xl transition-all flex flex-col space-y-4 hover-scale"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-slate-950 transition-all shadow-md">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-lg">Laporan Toko</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Analisis untung-rugi bersih, HPP produk, rekap pajak UMKM, dan grafik penjualan harian.</p>
            </div>
          </Link>
        </div>
      </main>

      {/* UPGRADE PLAN MODAL */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg p-6 sm:p-8 rounded-3xl shadow-2xl space-y-6 animate-zoom-in max-h-[95vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-xl text-white">Upgrade / Perpanjang Plan</h3>
                <p className="text-xs text-slate-400">Pilih paket terbaik untuk tingkatkan operasional toko Anda</p>
              </div>
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Plan Selector Grid */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Pilih Paket
              </label>
              <div className="grid grid-cols-1 gap-3">
                {/* Paket Usaha — Tersedia */}
                <button
                  type="button"
                  onClick={() => setUpgradePlan('Usaha')}
                  className={`text-left p-4 rounded-2xl border transition-all flex flex-col sm:flex-row justify-between gap-3 ${
                    upgradePlan === 'Usaha'
                      ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/5'
                      : 'border-slate-800 bg-slate-950/40 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${upgradePlan === 'Usaha' ? 'bg-emerald-400' : 'bg-slate-700'}`}></span>
                      <h4 className="font-extrabold text-sm text-slate-100">Paket Usaha</h4>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
                      Transaksi tanpa batas, QRIS kustom, laporan pajak, & pencatatan struk thermal.
                    </p>
                  </div>
                  <div className="sm:text-right shrink-0">
                    <p className="font-black text-sm text-emerald-400">Rp 49.000</p>
                    <p className="text-[10px] text-slate-500">/bulan</p>
                  </div>
                </button>

                {/* Paket Berkembang — Coming Soon */}
                <div className="relative p-4 rounded-2xl border border-slate-800/50 bg-slate-950/20 opacity-60 cursor-not-allowed flex flex-col sm:flex-row justify-between gap-3">
                  <div className="absolute top-3 right-3">
                    <span className="bg-slate-800 text-slate-400 text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full">Segera Hadir</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-slate-700"></span>
                      <h4 className="font-extrabold text-sm text-slate-500">Paket Berkembang</h4>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed max-w-sm">
                      Semua fitur Usaha + dukung hingga 5 akun kasir karyawan & kelola multi-otoritas.
                    </p>
                  </div>
                  <div className="sm:text-right shrink-0">
                    <p className="font-black text-sm text-slate-600">Rp 99.000</p>
                    <p className="text-[10px] text-slate-700">/bulan</p>
                  </div>
                </div>

                {/* Paket Bisnis — Coming Soon */}
                <div className="relative p-4 rounded-2xl border border-slate-800/50 bg-slate-950/20 opacity-60 cursor-not-allowed flex flex-col sm:flex-row justify-between gap-3">
                  <div className="absolute top-3 right-3">
                    <span className="bg-slate-800 text-slate-400 text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full">Segera Hadir</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-slate-700"></span>
                      <h4 className="font-extrabold text-sm text-slate-500">Paket Bisnis</h4>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed max-w-sm">
                      Semua fitur Berkembang + manajemen multi-toko (cabang), & inventaris stok lanjutan.
                    </p>
                  </div>
                  <div className="sm:text-right shrink-0">
                    <p className="font-black text-sm text-slate-600">Rp 199.000</p>
                    <p className="text-[10px] text-slate-700">/bulan</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Duration Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Pilih Durasi Langganan
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: 1, label: '1 Bln', disc: 'Normal' },
                  { value: 3, label: '3 Bln', disc: 'Disc 5%' },
                  { value: 6, label: '6 Bln', disc: 'Disc 10%' },
                  { value: 12, label: '12 Bln', disc: 'Disc 20%' }
                ].map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setUpgradeDuration(d.value)}
                    className={`py-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-0.5 ${
                      upgradeDuration === d.value
                        ? 'bg-emerald-500 text-slate-950 border-emerald-500 font-extrabold shadow-lg shadow-emerald-500/10'
                        : 'bg-slate-950/60 text-slate-300 border-slate-800 hover:bg-slate-900'
                    }`}
                  >
                    <span className="text-xs">{d.label}</span>
                    <span className={`text-[8px] uppercase tracking-wider ${upgradeDuration === d.value ? 'text-slate-950/70' : 'text-slate-500'}`}>{d.disc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Cost Summary Box */}
            <div className="bg-slate-950/60 border border-slate-800/80 p-5 rounded-2xl space-y-2.5 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>Harga Normal ({upgradeDuration} bulan)</span>
                <span>Rp {getUpgradePriceDetails().totalBeforeDiscount.toLocaleString('id-ID')}</span>
              </div>
              {getUpgradePriceDetails().discountAmount > 0 && (
                <div className="flex justify-between text-rose-400">
                  <span>Diskon Paket ({getUpgradePriceDetails().discountPercent}%)</span>
                  <span>-Rp {getUpgradePriceDetails().discountAmount.toLocaleString('id-ID')}</span>
                </div>
              )}
              <div className="flex justify-between text-md font-extrabold text-emerald-400 pt-2 border-t border-slate-900">
                <span>Total Pembayaran</span>
                <span>Rp {getUpgradePriceDetails().totalPrice.toLocaleString('id-ID')}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowUpgradeModal(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 py-3.5 font-bold rounded-xl text-sm transition-colors"
              >
                Kembali
              </button>
              <a
                href={getUpgradeWhatsAppLink()}
                target="_blank"
                rel="noreferrer"
                onClick={() => setShowUpgradeModal(false)}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 py-3.5 font-bold rounded-xl text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/10 transition-colors tap-effect"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.012 2c-5.506 0-9.988 4.482-9.988 9.988 0 1.76.46 3.414 1.258 4.861L2.03 22l5.31-.1.01.01a9.96 9.96 0 004.662 1.15c5.506 0 9.988-4.482 9.988-9.988C22 6.482 17.518 2 12.012 2zm6.262 14.188c-.27.76-1.36 1.39-1.89 1.44-.48.05-1.1.22-3.23-.62a12.87 12.87 0 01-5.63-4.94c-.95-1.27-1.52-2.74-1.52-4.26 0-1.61.84-2.4 1.14-2.7.25-.26.54-.33.72-.33h.52c.16 0 .38-.02.58.46.22.52.74 1.8.8 1.93.07.13.11.28.02.46-.08.18-.13.3-.27.46-.14.16-.3.35-.42.47-.13.14-.27.29-.12.55a8.77 8.77 0 001.6 2c.74.66 1.37 1.08 1.91 1.34.25.12.5.1.69-.11.23-.26.97-1.12 1.22-1.5.1-.15.2-.12.35-.06l2.25 1.06c.15.07.25.1.29.17.04.07.04.42-.08.76z"/>
                </svg>
                Hubungi via WA
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
