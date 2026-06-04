'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { db } from '../../../lib/db';
import Link from 'next/link';

export default function ReportsPage() {
  const {
    store,
    expenses,
    addExpense,
    online,
    triggerSync
  } = useApp();

  // Report calculations states
  const [salesToday, setSalesToday] = useState(0);
  const [modalToday, setModalToday] = useState(0); // HPP
  const [profitToday, setProfitToday] = useState(0); // Laba kotor
  
  const [salesThisMonth, setSalesThisMonth] = useState(0);
  const [modalThisMonth, setModalThisMonth] = useState(0);
  const [profitThisMonth, setProfitThisMonth] = useState(0);
  
  const [totalExpensesThisMonth, setTotalExpensesThisMonth] = useState(0);
  
  const [transactionsList, setTransactionsList] = useState([]);
  
  // Expenses modal form states
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState('Operasional');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseLoading, setExpenseLoading] = useState(false);

  useEffect(() => {
    if (store?.id) {
      calculateMetrics();
    }
  }, [store?.id, expenses]);

  const calculateMetrics = async () => {
    if (!store?.id) return;

    // Get today's start and month's start ISO timestamps
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // 1. Fetch transactions from Dexie
    const txs = await db.transactions
      .where('store_id').equals(store.id)
      .toArray();

    // Sort by newest
    txs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    setTransactionsList(txs.slice(0, 10)); // Show last 10 transactions

    // Calculate today's sales
    const txsToday = txs.filter(tx => tx.created_at >= startOfToday);
    const totalSalesToday = txsToday.reduce((sum, tx) => sum + tx.total, 0);
    setSalesToday(totalSalesToday);

    // Calculate this month's sales
    const txsThisMonth = txs.filter(tx => tx.created_at >= startOfMonth);
    const totalSalesThisMonth = txsThisMonth.reduce((sum, tx) => sum + tx.total, 0);
    setSalesThisMonth(totalSalesThisMonth);

    // 2. Fetch transaction items to calculate HPP (modal barang terjual)
    let totalModalToday = 0;
    let totalModalThisMonth = 0;

    for (const tx of txsThisMonth) {
      const items = await db.transaction_items
        .where('transaction_id').equals(tx.id)
        .toArray();

      for (const item of items) {
        const prod = await db.products.get(item.product_id);
        const costPrice = prod ? prod.cost_price : (item.price_at_sale * 0.6); // fallback to 60% of sale price
        const itemCostTotal = costPrice * item.qty;

        totalModalThisMonth += itemCostTotal;
        if (tx.created_at >= startOfToday) {
          totalModalToday += itemCostTotal;
        }
      }
    }

    setModalToday(totalModalToday);
    setProfitToday(totalSalesToday - totalModalToday);

    setModalThisMonth(totalModalThisMonth);
    setProfitThisMonth(totalSalesThisMonth - totalModalThisMonth);

    // 3. Calculate total expenses this month
    const currentMonthStr = now.toISOString().slice(0, 7); // "YYYY-MM"
    const expsThisMonth = expenses.filter(exp => exp.date.startsWith(currentMonthStr));
    const totalExps = expsThisMonth.reduce((sum, exp) => sum + exp.amount, 0);
    setTotalExpensesThisMonth(totalExps);
  };

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
      calculateMetrics();
    } else {
      alert(res.error || 'Gagal menyimpan pengeluaran');
    }
  };

  // Tax calculations details (PP 55/2022)
  // Threshold: PPh Final 0.5% only applies on the portion of annual turnover exceeding Rp 500.000.000 (for individuals)
  const estimatedYearlySales = salesThisMonth * 12;
  const isTaxExempt = estimatedYearlySales < 500000000;
  
  // Quick calculation: If not exempt, we show potential 0.5% final PPh
  const pphFinalEstimate = isTaxExempt ? 0 : (salesThisMonth * 0.005);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between z-10">
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
          <button
            onClick={() => setShowExpenseModal(true)}
            className="bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/25 text-rose-400 px-4 py-2 font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-lg tap-effect transition-all"
          >
            - Catat Pengeluaran
          </button>
        </div>
      </header>

      {/* Report Cards Grid */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-8 space-y-8">
        
        {/* TODAY METRICS SUMMARY */}
        <section className="space-y-4">
          <h2 className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Hasil Penjualan Hari Ini</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            
            <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-3xl space-y-1 hover-scale">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Uang Penjualan</span>
              <p className="text-2xl font-extrabold text-white">Rp {salesToday.toLocaleString('id-ID')}</p>
              <p className="text-[10px] text-slate-500">Semua omzet kasir masuk hari ini</p>
            </div>

            <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-3xl space-y-1 hover-scale">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Modal Barang Terjual</span>
              <p className="text-2xl font-extrabold text-amber-400/90">Rp {modalToday.toLocaleString('id-ID')}</p>
              <p className="text-[10px] text-slate-500">Harga beli modal dari produk laku</p>
            </div>

            <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-3xl space-y-1 hover-scale">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Untung Bersih Penjualan</span>
              <p className="text-2xl font-extrabold text-emerald-400">Rp {profitToday.toLocaleString('id-ID')}</p>
              <p className="text-[10px] text-slate-500">Uang omzet dikurangi harga modal</p>
            </div>

          </div>
        </section>

        {/* MONTHLY REPORT SUMMARY */}
        <section className="space-y-4">
          <h2 className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Rekap Laporan Bulan Ini</h2>
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 md:p-8 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              
              <div className="space-y-1 border-b sm:border-b-0 sm:border-r border-slate-800 pb-4 sm:pb-0">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Penjualan (A)</span>
                <p className="text-xl font-bold text-slate-100">Rp {salesThisMonth.toLocaleString('id-ID')}</p>
              </div>

              <div className="space-y-1 border-b sm:border-b-0 sm:border-r border-slate-800 pb-4 sm:pb-0">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Modal Barang (B)</span>
                <p className="text-xl font-bold text-slate-100">Rp {modalThisMonth.toLocaleString('id-ID')}</p>
              </div>

              <div className="space-y-1 border-b sm:border-b-0 sm:border-r border-slate-800 pb-4 sm:pb-0">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Biaya Operasional/Listrik (C)</span>
                <p className="text-xl font-bold text-rose-400">Rp {totalExpensesThisMonth.toLocaleString('id-ID')}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Sisa Untung Toko (A - B - C)</span>
                <p className="text-xl font-bold text-emerald-400">
                  Rp {(profitThisMonth - totalExpensesThisMonth).toLocaleString('id-ID')}
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* KILLER FEATURE: UMKM TAX CALCULATION (PPh FINAL 0.5%) */}
        <section className="space-y-4">
          <h2 className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Kalkulator Pajak UMKM (PP No. 55/2022)</h2>
          <div className="bg-gradient-brand text-slate-950 p-6 sm:p-8 rounded-3xl shadow-xl space-y-4 relative overflow-hidden">
            {/* Design light circle */}
            <div className="absolute right-[-10%] top-[-20%] w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>

            <div className="space-y-1">
              <span className="bg-slate-950 text-emerald-400 font-black px-3 py-1 rounded-full text-[9px] tracking-wider uppercase">
                Fitur Kunci KasirKu
              </span>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight mt-2 text-white">Laporan PPh Final 0.5% Otomatis</h3>
              <p className="text-white/80 text-xs sm:text-sm">
                Menurut PP 55/2022, peredaran bruto/omzet UMKM perorangan sampai dengan **Rp 500 Juta per tahun** bebas dari pajak.
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
                <span>PPh Final Bulan Ini</span>
                <span>Rp {pphFinalEstimate.toLocaleString('id-ID')}</span>
              </div>
            </div>

            <p className="text-white/70 text-[10px]">
              *Catatan: Sistem mengasumsikan pemilik usaha adalah perorangan dengan PT/CV disesuaikan. Laporan di atas siap diekspor dalam format CSV/PDF.
            </p>
          </div>
        </section>

        {/* LOG ARUS KAS (CASH FLOW LOG - Transactions & Expenses Combined) */}
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Uang Masuk & Keluar Terakhir</h2>
            <span className="text-[10px] text-slate-500">Maks. 10 baris terakhir</span>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider bg-slate-900/60">
                    <th className="px-6 py-4">Waktu</th>
                    <th className="px-6 py-4">Kategori Aksi</th>
                    <th className="px-6 py-4">Metode/Detil</th>
                    <th className="px-6 py-4 text-right">Uang Masuk (+)</th>
                    <th className="px-6 py-4 text-right">Uang Keluar (-)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {transactionsList.length === 0 && expenses.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                        Belum ada aktivitas kas yang tercatat.
                      </td>
                    </tr>
                  ) : (
                    // Combine, sort, and display last 10 rows
                    [
                      ...transactionsList.map(t => ({
                        date: t.created_at,
                        type: 'Transaksi Penjualan',
                        detail: `Nota #${t.id.slice(0, 8).toUpperCase()} (${t.payment_method})`,
                        in: t.total,
                        out: 0,
                        isExpense: false
                      })),
                      ...expenses.map(e => ({
                        date: e.created_at,
                        type: `Pengeluaran (${e.category})`,
                        detail: e.description || 'Pengeluaran operasional',
                        in: 0,
                        out: e.amount,
                        isExpense: true
                      }))
                    ]
                      .sort((a, b) => new Date(b.date) - new Date(a.date))
                      .slice(0, 10)
                      .map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/20 transition-colors">
                          <td className="px-6 py-4 text-slate-400 text-xs">
                            {new Date(row.date).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
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

      </main>

      {/* CATAT EXPENSE MODAL */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md p-8 rounded-3xl shadow-2xl space-y-6 animate-zoom-in">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-xl">Catat Pengeluaran Baru</h3>
              <button 
                onClick={() => setShowExpenseModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExpenseSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Kategori Pengeluaran
                </label>
                <select
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-rose-500"
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                >
                  <option value="Operasional">Operasional (Minyak, Gas, Bahan Pokok)</option>
                  <option value="Listrik & Air">Biaya Listrik, Air & Internet</option>
                  <option value="Sewa Tempat">Sewa Kios / Tempat Usaha</option>
                  <option value="Gaji Karyawan">Gaji / Upah Karyawan</option>
                  <option value="Lain-lain">Lain-lain</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Jumlah Pengeluaran (Rp)
                </label>
                <input
                  type="number"
                  required
                  placeholder="cth: 25000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder:text-slate-700 font-extrabold text-lg focus:outline-none focus:border-rose-500"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Keterangan Singkat
                </label>
                <input
                  type="text"
                  required
                  placeholder="cth: Beli telur 2kg, bayar Token Listrik"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 placeholder:text-slate-700 focus:outline-none focus:border-rose-500"
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={expenseLoading}
                className="w-full bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold py-3.5 rounded-xl shadow-lg mt-4 flex justify-center items-center gap-2"
              >
                {expenseLoading ? (
                  <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  'Catat Sekarang'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
