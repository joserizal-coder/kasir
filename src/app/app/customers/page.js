'use client';

import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import Link from 'next/link';
import { useToast } from '../../../components/Toast';

export default function CustomersPage() {
  const toast = useToast();
  const { store, customers, saveCustomer, payCustomerDebt, online, triggerSync } = useApp();

  const [search, setSearch] = useState('');

  // Add / Edit Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('Tambah Pelanggan Baru');
  const [customerId, setCustomerId] = useState('');
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custDebt, setCustDebt] = useState(0);
  const [custCreatedAt, setCustCreatedAt] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);

  // Pay Debt Modal states
  const [showPayModal, setShowPayModal] = useState(false);
  const [payTarget, setPayTarget] = useState(null); // { id, name, total_debt }
  const [payAmount, setPayAmount] = useState('');
  const [payLoading, setPayLoading] = useState(false);

  // Filtered list
  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return c.name?.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q);
  });

  const totalDebtAll = customers.reduce((sum, c) => sum + (parseFloat(c.total_debt) || 0), 0);

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const openAddModal = () => {
    setModalTitle('Tambah Pelanggan Baru');
    setCustomerId('');
    setCustName('');
    setCustPhone('');
    setCustDebt(0);
    setCustCreatedAt('');
    setShowModal(true);
  };

  const openEditModal = (cust) => {
    setModalTitle('Ubah Data Pelanggan');
    setCustomerId(cust.id);
    setCustName(cust.name || '');
    setCustPhone(cust.phone || '');
    setCustDebt(parseFloat(cust.total_debt) || 0);
    setCustCreatedAt(cust.created_at || '');
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!custName.trim()) return;
    setSaveLoading(true);
    try {
      const res = await saveCustomer({
        id: customerId || null,
        name: custName.trim(),
        phone: custPhone.trim(),
        total_debt: custDebt,
        created_at: custCreatedAt || undefined,
      });
      if (res.success) {
        toast.success(
          customerId ? 'Data Diperbarui' : 'Pelanggan Ditambahkan',
          customerId
            ? `Data ${custName} berhasil diperbarui.`
            : `Pelanggan ${res.customer.name} berhasil disimpan.`
        );
        setShowModal(false);
      } else {
        toast.error('Gagal Menyimpan', res.error || 'Terjadi kesalahan.');
      }
    } catch (err) {
      toast.error('Terjadi Kesalahan', err.message);
    } finally {
      setSaveLoading(false);
    }
  };

  const openPayModal = (cust) => {
    setPayTarget(cust);
    setPayAmount('');
    setShowPayModal(true);
  };

  const handlePayDebt = async (e) => {
    e.preventDefault();
    if (!payTarget || !payAmount) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.warning('Nominal Tidak Valid', 'Masukkan nominal pembayaran yang benar.');
      return;
    }
    if (amount > parseFloat(payTarget.total_debt)) {
      toast.warning('Nominal Terlalu Besar', 'Pembayaran melebihi total hutang pelanggan.');
      return;
    }
    setPayLoading(true);
    try {
      const res = await payCustomerDebt(payTarget.id, amount);
      if (res.success) {
        const sisa = res.newDebt;
        toast.success(
          'Pembayaran Dicatat',
          sisa === 0
            ? `Hutang ${payTarget.name} lunas! 🎉`
            : `Sisa hutang ${payTarget.name}: Rp ${sisa.toLocaleString('id-ID')}`
        );
        setShowPayModal(false);
        setPayTarget(null);
        setPayAmount('');
      } else {
        toast.error('Gagal Mencatat', res.error || 'Terjadi kesalahan.');
      }
    } catch (err) {
      toast.error('Terjadi Kesalahan', err.message);
    } finally {
      setPayLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </Link>
          <div>
            <h1 className="font-bold text-md">Kelola Pelanggan</h1>
            <p className="text-[10px] text-slate-400">
              Total: <strong className="text-slate-200">{customers.length} pelanggan</strong>
              {totalDebtAll > 0 && (
                <span className="ml-2 text-rose-400">
                  · Piutang: <strong>Rp {totalDebtAll.toLocaleString('id-ID')}</strong>
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={triggerSync}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors"
            title="Sinkronisasi Data"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3m0 0l3 3m-3-3v12" /></svg>
          </button>
          <button
            onClick={openAddModal}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/10 tap-effect transition-all"
          >
            + Tambah Pelanggan
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-8 space-y-6">
        {/* Search */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </span>
          <input
            type="text"
            placeholder="Cari nama atau nomor HP pelanggan..."
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-3 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Offline notice */}
        {!online && (
          <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3">
            <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
            <p className="text-xs text-amber-300 font-medium">Mode Offline — perubahan tersimpan lokal & otomatis sync saat online kembali.</p>
          </div>
        )}

        {/* Customer list */}
        {filtered.length === 0 ? (
          <div className="py-24 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center mx-auto text-slate-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            <div>
              <p className="text-slate-400 font-semibold">
                {search ? 'Pelanggan tidak ditemukan.' : 'Belum ada pelanggan.'}
              </p>
              {!search && (
                <p className="text-slate-600 text-sm mt-1">
                  Tambahkan pelanggan tetap untuk mencatat transaksi kredit dan memantau hutang.
                </p>
              )}
            </div>
            {!search && (
              <button
                onClick={openAddModal}
                className="mt-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-sm shadow-lg transition-all"
              >
                + Tambah Pelanggan Pertama
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((cust) => {
              const debt = parseFloat(cust.total_debt) || 0;
              return (
                <div
                  key={cust.id}
                  className="group bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
                >
                  {/* Info */}
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500/20 to-rose-500/5 border border-rose-500/20 flex items-center justify-center shrink-0 font-bold text-rose-400 text-lg">
                      {cust.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-100 truncate">{cust.name}</p>
                      {cust.phone ? (
                        <p className="text-xs text-slate-500">{cust.phone}</p>
                      ) : (
                        <p className="text-xs text-slate-700 italic">Belum ada nomor HP</p>
                      )}
                    </div>
                  </div>

                  {/* Debt Badge + Actions */}
                  <div className="flex items-center gap-3 shrink-0">
                    {debt > 0 ? (
                      <div className="text-right">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Hutang</p>
                        <p className="font-extrabold text-rose-400 text-sm">Rp {debt.toLocaleString('id-ID')}</p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-bold">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                        Lunas
                      </div>
                    )}

                    {debt > 0 && (
                      <button
                        onClick={() => openPayModal(cust)}
                        className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold transition-all"
                        title="Catat Pembayaran Hutang"
                      >
                        Bayar Hutang
                      </button>
                    )}

                    <button
                      onClick={() => openEditModal(cust)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-xl transition-colors"
                      title="Ubah data pelanggan"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── ADD / EDIT MODAL ─────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-[#1c1716] border border-[#2c2524] w-full max-w-md p-8 rounded-3xl shadow-2xl space-y-6 animate-toast-in">
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-xl text-slate-100">{modalTitle}</h3>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Nama Pelanggan <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="cth: Budi Santoso"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Nomor WhatsApp <span className="text-slate-600">(Opsional)</span>
                </label>
                <input
                  type="text"
                  placeholder="cth: 081234567890"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                />
                <p className="text-[10px] text-slate-600">Digunakan untuk kirim struk via WhatsApp saat transaksi kredit.</p>
              </div>

              {/* Debt field — only shown in edit mode */}
              {customerId && (
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Total Hutang (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-400 cursor-not-allowed"
                    value={custDebt}
                    readOnly
                    title="Gunakan tombol 'Bayar Hutang' untuk mengubah saldo hutang"
                  />
                  <p className="text-[10px] text-slate-600">Hutang diubah via tombol "Bayar Hutang" pada daftar pelanggan.</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saveLoading || !custName.trim()}
                  className="flex-1 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all flex justify-center items-center gap-2"
                >
                  {saveLoading ? (
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                      Simpan
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── PAY DEBT MODAL ───────────────────────────────────────────────────────── */}
      {showPayModal && payTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-[#1c1716] border border-[#2c2524] w-full max-w-sm p-8 rounded-3xl shadow-2xl space-y-6 animate-toast-in">
            {/* Icon */}
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto text-rose-400">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-slate-100">Bayar Hutang</h3>
                <p className="text-xs text-slate-400 mt-0.5">Pelanggan: <strong className="text-slate-200">{payTarget.name}</strong></p>
              </div>
            </div>

            {/* Debt info */}
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 text-center">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Total Hutang Saat Ini</p>
              <p className="text-2xl font-extrabold text-rose-400">
                Rp {parseFloat(payTarget.total_debt).toLocaleString('id-ID')}
              </p>
            </div>

            {/* Input */}
            <form onSubmit={handlePayDebt} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Nominal Pembayaran (Rp)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={parseFloat(payTarget.total_debt)}
                  placeholder="cth: 50000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 font-bold text-lg focus:outline-none focus:border-rose-500 transition-colors placeholder:text-slate-700"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
              </div>

              {/* Quick amounts */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  parseFloat(payTarget.total_debt),
                  parseFloat(payTarget.total_debt) / 2,
                  50000,
                ].filter((v, i, arr) => v > 0 && arr.indexOf(v) === i).map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setPayAmount(Math.min(amt, parseFloat(payTarget.total_debt)).toString())}
                    className="py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs text-slate-300 font-semibold transition-colors"
                  >
                    {amt === parseFloat(payTarget.total_debt) ? 'Lunas' : `Rp ${amt.toLocaleString('id-ID')}`}
                  </button>
                ))}
              </div>

              {payAmount && parseFloat(payAmount) > 0 && parseFloat(payAmount) <= parseFloat(payTarget.total_debt) && (
                <div className="flex justify-between items-center text-sm font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5">
                  <span>Sisa Hutang Setelah Bayar</span>
                  <span>Rp {Math.max(0, parseFloat(payTarget.total_debt) - parseFloat(payAmount)).toLocaleString('id-ID')}</span>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowPayModal(false); setPayTarget(null); }}
                  className="flex-1 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={payLoading || !payAmount || parseFloat(payAmount) <= 0 || parseFloat(payAmount) > parseFloat(payTarget.total_debt)}
                  className="flex-1 py-3 rounded-2xl bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-rose-500/20 transition-all flex justify-center items-center gap-2"
                >
                  {payLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : 'Konfirmasi Bayar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
