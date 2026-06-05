'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../../context/AppContext';
import { db } from '../../../lib/db';
import Link from 'next/link';

// Format tanggal lokal ke format YYYY-MM-DD (untuk nilai input[type=date])
function toInputDate(date) {
  return date.toISOString().split('T')[0];
}

export default function ReportsPage() {
  const { store, expenses, addExpense, online, triggerSync } = useApp();

  // ── Rentang Tanggal ────────────────────────────────────────────────────────
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultEnd   = now;

  const [startDate, setStartDate] = useState(toInputDate(defaultStart));
  const [endDate,   setEndDate]   = useState(toInputDate(defaultEnd));
  const [activePreset, setActivePreset] = useState('month'); // today | week | month | custom

  // ── Metrik ─────────────────────────────────────────────────────────────────
  const [salesToday,   setSalesToday]   = useState(0);
  const [modalToday,  setModalToday]   = useState(0);
  const [profitToday, setProfitToday]  = useState(0);

  const [salesRange,   setSalesRange]   = useState(0);
  const [modalRange,   setModalRange]   = useState(0);
  const [profitRange,  setProfitRange]  = useState(0);
  const [txCountRange, setTxCountRange] = useState(0);

  const [totalExpensesRange, setTotalExpensesRange] = useState(0);
  const [transactionsList,   setTransactionsList]   = useState([]);

  // ── Pengeluaran Modal ───────────────────────────────────────────────────────
  const [showExpenseModal,  setShowExpenseModal]  = useState(false);
  const [expenseCategory,   setExpenseCategory]   = useState('Operasional');
  const [expenseAmount,     setExpenseAmount]     = useState('');
  const [expenseDesc,       setExpenseDesc]       = useState('');
  const [expenseLoading,    setExpenseLoading]    = useState(false);

  // ── Hitung Metrik ──────────────────────────────────────────────────────────
  const calculateMetrics = useCallback(async () => {
    if (!store?.id) return;

    const start = new Date(startDate + 'T00:00:00.000');
    const end   = new Date(endDate   + 'T23:59:59.999');
    const startISO = start.toISOString();
    const endISO   = end.toISOString();

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

    // ── Semua transaksi toko ─────────────────────────────────────────────────
    const allTx = await db.transactions
      .where('store_id').equals(store.id)
      .toArray();

    // Hari ini
    const txsToday = allTx.filter(tx => tx.created_at >= todayStart && tx.created_at <= todayEnd);
    const totalSalesToday = txsToday.reduce((s, tx) => s + tx.total, 0);
    setSalesToday(totalSalesToday);

    // Rentang terpilih
    const txsRange = allTx.filter(tx => tx.created_at >= startISO && tx.created_at <= endISO);
    txsRange.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    setTransactionsList(txsRange.slice(0, 50));
    setTxCountRange(txsRange.length);
    const totalSalesRange = txsRange.reduce((s, tx) => s + tx.total, 0);
    setSalesRange(totalSalesRange);

    // ── HPP (Modal) ───────────────────────────────────────────────────────────
    let totalModalToday = 0;
    let totalModalRange = 0;

    for (const tx of txsRange) {
      const items = await db.transaction_items
        .where('transaction_id').equals(tx.id)
        .toArray();

      for (const item of items) {
        const prod = await db.products.get(item.product_id);
        const costPrice = prod ? prod.cost_price : (item.price_at_sale * 0.6);
        const itemCost  = costPrice * item.qty;
        totalModalRange += itemCost;

        if (tx.created_at >= todayStart && tx.created_at <= todayEnd) {
          totalModalToday += itemCost;
        }
      }
    }

    setModalToday(totalModalToday);
    setProfitToday(totalSalesToday - totalModalToday);
    setModalRange(totalModalRange);
    setProfitRange(totalSalesRange - totalModalRange);

    // ── Pengeluaran dalam rentang ─────────────────────────────────────────────
    const expsRange = expenses.filter(exp => {
      const expDate = exp.date;
      return expDate >= startDate && expDate <= endDate;
    });
    setTotalExpensesRange(expsRange.reduce((s, e) => s + e.amount, 0));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id, startDate, endDate, expenses]);

  useEffect(() => {
    calculateMetrics();
  }, [calculateMetrics]);

  // ── Preset Rentang Tanggal ─────────────────────────────────────────────────
  const applyPreset = (preset) => {
    const today = new Date();
    setActivePreset(preset);
    if (preset === 'today') {
      setStartDate(toInputDate(today));
      setEndDate(toInputDate(today));
    } else if (preset === 'week') {
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 6);
      setStartDate(toInputDate(weekAgo));
      setEndDate(toInputDate(today));
    } else if (preset === 'month') {
      setStartDate(toInputDate(new Date(today.getFullYear(), today.getMonth(), 1)));
      setEndDate(toInputDate(today));
    }
  };

  // ── Expense Submit ─────────────────────────────────────────────────────────
  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    if (!expenseAmount || parseFloat(expenseAmount) <= 0) return;
    setExpenseLoading(true);
    const res = await addExpense(expenseCategory, expenseAmount, expenseDesc);
    setExpenseLoading(false);
    if (res.success) {
      setShowExpenseModal(false);
      setExpenseAmount('');
      setExpenseDesc('');
    } else {
      alert(res.error || 'Gagal menyimpan pengeluaran');
    }
  };

  // ── Cetak PDF ──────────────────────────────────────────────────────────────
  const handlePrint = () => {
    window.print();
  };

  // ── Kirim via WhatsApp ─────────────────────────────────────────────────────
  const handleShareWA = () => {
    const formatRp = (n) => `Rp ${n.toLocaleString('id-ID')}`;
    const labaBersih = profitRange - totalExpensesRange;

    const text =
      `📊 *LAPORAN KEUANGAN - ${store?.name || ''}*\n` +
      `Periode: ${startDate} s/d ${endDate}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🛒 Jumlah Transaksi : ${txCountRange} transaksi\n` +
      `💰 Total Penjualan  : ${formatRp(salesRange)}\n` +
      `📦 Modal Barang     : ${formatRp(modalRange)}\n` +
      `🔴 Biaya Operasional: ${formatRp(totalExpensesRange)}\n` +
      `✅ Laba Bersih Toko : ${formatRp(labaBersih)}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📅 Dikirim otomatis dari *KasirKita*`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // ── Pajak ──────────────────────────────────────────────────────────────────
  const rangeMonths = Math.max(1,
    (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24 * 30)
  );
  const estimatedYearlySales = salesRange / rangeMonths * 12;
  const isTaxExempt   = estimatedYearlySales < 500_000_000;
  const pphFinalEst   = isTaxExempt ? 0 : (salesRange * 0.005);

  // Label rentang terpilih untuk kartu
  const rangeLabel = startDate === endDate
    ? `${new Date(startDate).toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' })}`
    : `${new Date(startDate).toLocaleDateString('id-ID', { day:'numeric', month:'short' })} – ${new Date(endDate).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' })}`;

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">

      {/* ── Header cetak (hanya muncul saat print) ─────────────────────────── */}
      <div className="print-header hidden">
        <p className="text-2xl font-black text-slate-900">{store?.name}</p>
        <p className="text-sm text-slate-600">Laporan Keuangan Periode: {rangeLabel}</p>
        <p className="text-xs text-slate-400 mt-1">Dicetak oleh KasirKita pada {new Date().toLocaleString('id-ID')}</p>
      </div>

      {/* ── App Header ─────────────────────────────────────────────────────── */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between z-10 print-hide">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </Link>
          <div>
            <h1 className="font-bold text-md">Laporan Keuangan Toko</h1>
            <p className="text-[10px] text-slate-400">Pencatatan bahasa sederhana pemilik warung</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Catat Pengeluaran */}
          <button
            onClick={() => setShowExpenseModal(true)}
            className="bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/25 text-rose-400 px-4 py-2 font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-lg tap-effect transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20 12H4M12 4v16" /></svg>
            Catat Pengeluaran
          </button>
          {/* Kirim WA */}
          <button
            onClick={handleShareWA}
            className="bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/20 text-emerald-400 px-4 py-2 font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-lg tap-effect transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.012 2c-5.506 0-9.988 4.482-9.988 9.988 0 1.76.46 3.414 1.258 4.861L2.03 22l5.31-.1.01.01a9.96 9.96 0 004.662 1.15c5.506 0 9.988-4.482 9.988-9.988C22 6.482 17.518 2 12.012 2z"/></svg>
            Kirim (WA)
          </button>
          {/* Simpan PDF */}
          <button
            onClick={handlePrint}
            className="bg-violet-500/10 hover:bg-violet-500/25 border border-violet-500/20 text-violet-400 px-4 py-2 font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-lg tap-effect transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Simpan PDF
          </button>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-8 space-y-8">

        {/* ── Filter Rentang Tanggal ──────────────────────────────────────── */}
        <section className="print-hide space-y-4">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-4">
            <h2 className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Filter Rentang Tanggal Laporan</h2>
            {/* Preset Buttons */}
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'today', label: 'Hari Ini' },
                { key: 'week',  label: '7 Hari Terakhir' },
                { key: 'month', label: 'Bulan Ini' },
                { key: 'custom', label: 'Kustom' }
              ].map(p => (
                <button
                  key={p.key}
                  onClick={() => applyPreset(p.key)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    activePreset === p.key
                      ? 'bg-violet-600 text-white shadow-md shadow-violet-500/10'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {/* Date inputs */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">Dari Tanggal</label>
                <input
                  type="date"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-violet-500 text-sm"
                  value={startDate}
                  max={endDate}
                  onChange={e => { setStartDate(e.target.value); setActivePreset('custom'); }}
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">Sampai Tanggal</label>
                <input
                  type="date"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-violet-500 text-sm"
                  value={endDate}
                  min={startDate}
                  max={toInputDate(new Date())}
                  onChange={e => { setEndDate(e.target.value); setActivePreset('custom'); }}
                />
              </div>
              <div className="flex items-end">
                <div className="w-full sm:w-auto bg-slate-800/60 border border-slate-700/60 px-4 py-2.5 rounded-xl text-xs text-slate-300 font-semibold text-center whitespace-nowrap">
                  📅 {rangeLabel}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Label Rentang untuk Print ────────────────────────────────────── */}
        <div className="hidden print:block text-slate-600 text-sm font-semibold mb-2">Periode: {rangeLabel}</div>

        {/* ── TODAY METRICS SUMMARY ──────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Hasil Penjualan Hari Ini</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-3xl space-y-1 hover-scale print-card">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Uang Penjualan</span>
              <p className="text-2xl font-extrabold text-white">Rp {salesToday.toLocaleString('id-ID')}</p>
              <p className="text-[10px] text-slate-500">Semua omzet kasir masuk hari ini</p>
            </div>
            <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-3xl space-y-1 hover-scale print-card">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Modal Barang Terjual</span>
              <p className="text-2xl font-extrabold text-amber-400/90">Rp {modalToday.toLocaleString('id-ID')}</p>
              <p className="text-[10px] text-slate-500">Harga beli modal dari produk laku</p>
            </div>
            <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-3xl space-y-1 hover-scale print-card">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Untung Bersih Penjualan</span>
              <p className="text-2xl font-extrabold text-emerald-400">Rp {profitToday.toLocaleString('id-ID')}</p>
              <p className="text-[10px] text-slate-500">Uang omzet dikurangi harga modal</p>
            </div>
          </div>
        </section>

        {/* ── RANGE REPORT SUMMARY ───────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-xs text-slate-400 uppercase tracking-widest font-semibold">
            Rekap Laporan — {rangeLabel}
            <span className="ml-2 text-violet-400">({txCountRange} transaksi)</span>
          </h2>
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 md:p-8 space-y-6 print-card">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-1 border-b sm:border-b-0 sm:border-r border-slate-800 pb-4 sm:pb-0">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Penjualan (A)</span>
                <p className="text-xl font-bold text-slate-100">Rp {salesRange.toLocaleString('id-ID')}</p>
              </div>
              <div className="space-y-1 border-b sm:border-b-0 sm:border-r border-slate-800 pb-4 sm:pb-0">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Modal Barang (B)</span>
                <p className="text-xl font-bold text-slate-100">Rp {modalRange.toLocaleString('id-ID')}</p>
              </div>
              <div className="space-y-1 border-b sm:border-b-0 sm:border-r border-slate-800 pb-4 sm:pb-0">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Biaya Operasional (C)</span>
                <p className="text-xl font-bold text-rose-400">Rp {totalExpensesRange.toLocaleString('id-ID')}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Sisa Untung Toko (A-B-C)</span>
                <p className={`text-xl font-bold ${profitRange - totalExpensesRange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  Rp {(profitRange - totalExpensesRange).toLocaleString('id-ID')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── TAX SECTION ─────────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Kalkulator Pajak UMKM (PP No. 55/2022)</h2>
          <div className="bg-gradient-brand text-slate-950 p-6 sm:p-8 rounded-3xl shadow-xl space-y-4 relative overflow-hidden">
            <div className="absolute right-[-10%] top-[-20%] w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="space-y-1">
              <span className="bg-slate-950 text-emerald-400 font-black px-3 py-1 rounded-full text-[9px] tracking-wider uppercase">Fitur Kunci Kasir Kita</span>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight mt-2 text-white">Laporan PPh Final 0.5% Otomatis</h3>
              <p className="text-white/80 text-xs sm:text-sm">
                Menurut PP 55/2022, peredaran bruto/omzet UMKM perorangan sampai dengan Rp 500 Juta per tahun bebas dari pajak.
              </p>
            </div>
            <div className="bg-slate-950/20 border border-white/10 p-5 rounded-2xl space-y-2 text-white">
              <div className="flex justify-between items-center text-sm">
                <span>Estimasi Omzet Toko (Tahunan)</span>
                <span className="font-bold">Rp {estimatedYearlySales.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>Status Wajib Pajak</span>
                <span className={`font-extrabold ${isTaxExempt ? 'text-teal-300' : 'text-amber-300'}`}>
                  {isTaxExempt ? 'BEBAS PAJAK (Omzet < 500jt)' : 'KENA PAJAK PPh 0.5%'}
                </span>
              </div>
              <div className="flex justify-between items-center text-md font-black border-t border-white/10 pt-2 mt-2">
                <span>PPh Final Periode Ini</span>
                <span>Rp {pphFinalEst.toLocaleString('id-ID')}</span>
              </div>
            </div>
            <p className="text-white/70 text-[10px]">*Catatan: Estimasi berdasarkan rata-rata rentang periode terpilih yang disetahunkan.</p>
          </div>
        </section>

        {/* ── ARUS KAS ──────────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xs text-slate-400 uppercase tracking-widest font-semibold">
              Arus Kas — {rangeLabel}
            </h2>
            <span className="text-[10px] text-slate-500">Maks. 50 transaksi terakhir</span>
          </div>
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl print-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider bg-slate-900/60">
                    <th className="px-6 py-4">Waktu</th>
                    <th className="px-6 py-4">Kategori Aksi</th>
                    <th className="px-6 py-4">Detail</th>
                    <th className="px-6 py-4 text-right">Masuk (+)</th>
                    <th className="px-6 py-4 text-right">Keluar (-)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {transactionsList.length === 0 && expenses.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                        Tidak ada aktivitas kas pada rentang tanggal ini.
                      </td>
                    </tr>
                  ) : (
                    [
                      ...transactionsList.map(t => ({
                        date: t.created_at,
                        type: 'Transaksi Penjualan',
                        detail: `Nota #${t.id.slice(0, 8).toUpperCase()} (${t.payment_method})`,
                        in: t.total,
                        out: 0
                      })),
                      ...expenses
                        .filter(e => e.date >= startDate && e.date <= endDate)
                        .map(e => ({
                          date: e.created_at,
                          type: `Pengeluaran (${e.category})`,
                          detail: e.description || 'Pengeluaran operasional',
                          in: 0,
                          out: e.amount
                        }))
                    ]
                      .sort((a, b) => new Date(b.date) - new Date(a.date))
                      .slice(0, 50)
                      .map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/20 transition-colors">
                          <td className="px-6 py-4 text-slate-400 text-xs">
                            {new Date(row.date).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-200">{row.type}</td>
                          <td className="px-6 py-4 text-slate-400 text-xs">{row.detail}</td>
                          <td className="px-6 py-4 text-right text-emerald-400 font-bold">
                            {row.in > 0 ? `+Rp ${row.in.toLocaleString('id-ID')}` : '-'}
                          </td>
                          <td className="px-6 py-4 text-right text-rose-400 font-bold">
                            {row.out > 0 ? `-Rp ${row.out.toLocaleString('id-ID')}` : '-'}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Tombol Aksi Bawah (duplikat untuk kenyamanan) ─────────────────── */}
        <section className="print-hide flex flex-col sm:flex-row gap-3 pb-4">
          <button
            onClick={handleShareWA}
            className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all tap-effect"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.012 2c-5.506 0-9.988 4.482-9.988 9.988 0 1.76.46 3.414 1.258 4.861L2.03 22l5.31-.1.01.01a9.96 9.96 0 004.662 1.15c5.506 0 9.988-4.482 9.988-9.988C22 6.482 17.518 2 12.012 2zm6.262 14.188c-.27.76-1.36 1.39-1.89 1.44-.48.05-1.1.22-3.23-.62a12.87 12.87 0 01-5.63-4.94c-.95-1.27-1.52-2.74-1.52-4.26 0-1.61.84-2.4 1.14-2.7.25-.26.54-.33.72-.33h.52c.16 0 .38-.02.58.46.22.52.74 1.8.8 1.93.07.13.11.28.02.46-.08.18-.13.3-.27.46-.14.16-.3.35-.42.47-.13.14-.27.29-.12.55a8.77 8.77 0 001.6 2c.74.66 1.37 1.08 1.91 1.34.25.12.5.1.69-.11.23-.26.97-1.12 1.22-1.5.1-.15.2-.12.35-.06l2.25 1.06c.15.07.25.1.29.17.04.07.04.42-.08.76z"/></svg>
            Kirim Ringkasan via WhatsApp
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 text-violet-400 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all tap-effect"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Simpan / Cetak PDF
          </button>
        </section>

      </main>

      {/* ── EXPENSE MODAL ──────────────────────────────────────────────────── */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 flex items-center justify-center p-6 print-hide">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md p-8 rounded-3xl shadow-2xl space-y-6 animate-zoom-in">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-xl">Catat Pengeluaran Baru</h3>
              <button
                onClick={() => setShowExpenseModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400"
              >✕</button>
            </div>
            <form onSubmit={handleExpenseSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Kategori Pengeluaran</label>
                <select
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-rose-500"
                  value={expenseCategory}
                  onChange={e => setExpenseCategory(e.target.value)}
                >
                  <option value="Operasional">Operasional (Minyak, Gas, Bahan Pokok)</option>
                  <option value="Listrik & Air">Biaya Listrik, Air &amp; Internet</option>
                  <option value="Sewa Tempat">Sewa Kios / Tempat Usaha</option>
                  <option value="Gaji Karyawan">Gaji / Upah Karyawan</option>
                  <option value="Lain-lain">Lain-lain</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Jumlah Pengeluaran (Rp)</label>
                <input
                  type="number"
                  required
                  placeholder="cth: 25000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder:text-slate-700 font-extrabold text-lg focus:outline-none focus:border-rose-500"
                  value={expenseAmount}
                  onChange={e => setExpenseAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Keterangan Singkat</label>
                <input
                  type="text"
                  required
                  placeholder="cth: Beli telur 2kg, bayar Token Listrik"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 placeholder:text-slate-700 focus:outline-none focus:border-rose-500"
                  value={expenseDesc}
                  onChange={e => setExpenseDesc(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={expenseLoading}
                className="w-full bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold py-3.5 rounded-xl shadow-lg mt-4 flex justify-center items-center gap-2"
              >
                {expenseLoading ? <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div> : 'Catat Sekarang'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
