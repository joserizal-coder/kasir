'use client';

import React, { useEffect, useState } from 'react';
import { db } from '../lib/db';

export default function InvoiceModal({ transactionId, onClose }) {
  const [transaction, setTransaction] = useState(null);
  const [items, setItems] = useState([]);
  const [store, setStore] = useState(null);
  const [cashier, setCashier] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInvoiceData() {
      if (!transactionId) return;
      try {
        setLoading(true);
        const tx = await db.transactions.get(transactionId);
        if (!tx) {
          setLoading(false);
          return;
        }
        setTransaction(tx);

        const storeData = await db.stores.get(tx.store_id);
        setStore(storeData);

        if (tx.cashier_id) {
          const cashierData = await db.cashiers.get(tx.cashier_id);
          setCashier(cashierData);
        }

        const txItems = await db.transaction_items.where('transaction_id').equals(transactionId).toArray();
        const itemsWithDetails = await Promise.all(
          txItems.map(async (item) => {
            const prod = await db.products.get(item.product_id);
            return {
              ...item,
              productName: prod ? prod.name : 'Produk Terhapus',
              unit: prod ? prod.unit : 'pcs'
            };
          })
        );
        setItems(itemsWithDetails);
      } catch (err) {
        console.error('Failed to load invoice data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadInvoiceData();
  }, [transactionId]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6 print-hide">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl text-center space-y-4 max-w-sm w-full">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-400 text-sm">Memuat data invoice...</p>
        </div>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6 print-hide">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl text-center space-y-4 max-w-sm w-full">
          <p className="text-rose-400 font-bold">Transaksi tidak ditemukan</p>
          <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold">Tutup</button>
        </div>
      </div>
    );
  }

  const invoiceNo = `INV/${transaction.created_at.replace(/[-T:]/g, '').slice(0, 8)}/${transaction.id.slice(0, 6).toUpperCase()}`;
  const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
  const totalDiscount = items.reduce((sum, item) => sum + (item.discount * item.qty), 0);
  const subtotal = items.reduce((sum, item) => sum + (item.price_at_sale * item.qty), 0);

  const handlePrint = () => {
    document.body.classList.add('print-invoice-mode');
    window.print();
    document.body.classList.remove('print-invoice-mode');
  };

  const handleShareWA = () => {
    const formatRp = (n) => `Rp ${n.toLocaleString('id-ID')}`;
    let itemText = '';
    items.forEach((item) => {
      const discText = item.discount > 0 ? ` (Disc: -${formatRp(item.discount)})` : '';
      itemText += `- ${item.productName} x${item.qty} ${item.unit}: ${formatRp((item.price_at_sale - item.discount) * item.qty)}${discText}\n`;
    });

    const text =
      `📄 *INVOICE PENJUALAN - ${store?.name || ''}*\n` +
      `No: ${invoiceNo}\n` +
      `Tanggal: ${new Date(transaction.created_at).toLocaleString('id-ID')}\n` +
      `Kasir: ${cashier?.name || 'Pemilik Toko'}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `${itemText}` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Subtotal: ${formatRp(subtotal)}\n` +
      (totalDiscount > 0 ? `Total Diskon: -${formatRp(totalDiscount)}\n` : '') +
      `*Grand Total: ${formatRp(transaction.total)}*\n` +
      `Metode Bayar: ${transaction.payment_method}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Terima kasih atas kunjungan Anda!\n` +
      `📅 Dilayani oleh *KasirKita*`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <>
      {/* Printable Invoice Block (Hidden in screen, shown only when print-invoice-mode is active in body) */}
      <div className="invoice-printable">
        <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#000', padding: '10px', width: '280px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: '0 0 2px 0', fontSize: '14px', fontWeight: 'bold' }}>{store?.name}</h3>
            <p style={{ margin: '0', fontSize: '10px', color: '#666' }}>{store?.business_type}</p>
            {store?.address && <p style={{ margin: '2px 0 0 0', fontSize: '9px', color: '#666' }}>{store.address}</p>}
          </div>

          <div style={{ borderBottom: '1px dashed #000', marginBottom: '8px', paddingBottom: '8px' }}>
            <p style={{ margin: '0' }}>No: {invoiceNo}</p>
            <p style={{ margin: '0' }}>Tgl: {new Date(transaction.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</p>
            <p style={{ margin: '0' }}>Kasir: {cashier?.name || 'Pemilik Toko'}</p>
          </div>

          <div style={{ borderBottom: '1px dashed #000', marginBottom: '8px', paddingBottom: '8px' }}>
            {items.map((item, idx) => (
              <div key={idx} style={{ marginBottom: '6px' }}>
                <p style={{ margin: '0', fontWeight: 'bold' }}>{item.productName}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span>{item.qty} {item.unit} x Rp {item.price_at_sale.toLocaleString('id-ID')}</span>
                  <span>Rp {((item.price_at_sale - item.discount) * item.qty).toLocaleString('id-ID')}</span>
                </div>
                {item.discount > 0 && (
                  <p style={{ margin: '0', fontSize: '10px', color: '#555', fontStyle: 'italic' }}>
                    * Diskon: -Rp {(item.discount * item.qty).toLocaleString('id-ID')}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div style={{ borderBottom: '1px dashed #000', marginBottom: '8px', paddingBottom: '8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal:</span>
              <span>Rp {subtotal.toLocaleString('id-ID')}</span>
            </div>
            {totalDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Diskon:</span>
                <span>-Rp {totalDiscount.toLocaleString('id-ID')}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px', borderTop: '1px dashed #ccc', paddingTop: '3px' }}>
              <span>GRAND TOTAL:</span>
              <span>Rp {transaction.total.toLocaleString('id-ID')}</span>
            </div>
          </div>

          <div style={{ fontSize: '11px', lineHeight: '1.4' }}>
            <p style={{ margin: '0' }}>Metode Bayar: <strong>{transaction.payment_method}</strong></p>
            <p style={{ margin: '0', textAlign: 'center', marginTop: '15px', fontStyle: 'italic' }}>Terima kasih atas kunjungan Anda!</p>
          </div>
        </div>
      </div>

      {/* Screen Preview Modal */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6 print-hide">
        <div className="bg-slate-900 border border-slate-800 w-full max-w-md p-6 rounded-3xl shadow-2xl space-y-6 animate-zoom-in max-h-[90vh] flex flex-col">
          {/* Modal Header */}
          <div className="flex justify-between items-center shrink-0">
            <h3 className="font-bold text-xl text-white">Invoice Penjualan</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Modal Content / Preview Card */}
          <div className="flex-1 overflow-y-auto bg-slate-950/60 border border-slate-800/60 p-5 rounded-2xl space-y-4">
            {/* Header info */}
            <div className="text-center space-y-1 pb-3 border-b border-slate-800/80">
              <h4 className="font-extrabold text-lg text-emerald-400">{store?.name}</h4>
              <p className="text-xs text-slate-400 uppercase tracking-widest">{store?.business_type}</p>
              {store?.address && <p className="text-[10px] text-slate-500">{store.address}</p>}
            </div>

            {/* Invoice meta */}
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 border-b border-slate-800/80 pb-3">
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-semibold">No. Invoice</p>
                <p className="font-bold text-slate-200">{invoiceNo}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Tanggal / Waktu</p>
                <p className="text-slate-200">
                  {new Date(transaction.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}{' '}
                  {new Date(transaction.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Kasir</p>
                <p className="text-slate-200">{cashier?.name || 'Pemilik Toko'}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Metode Bayar</p>
                <p className="font-bold text-emerald-400">{transaction.payment_method}</p>
              </div>
            </div>

            {/* List items */}
            <div className="space-y-3 border-b border-slate-800/80 pb-3">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Daftar Belanjaan ({totalQty} item)</p>
              <div className="max-h-48 overflow-y-auto space-y-2.5 pr-1.5">
                {items.map((item, index) => (
                  <div key={index} className="flex justify-between items-start text-xs">
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-200">{item.productName}</p>
                      <p className="text-[10px] text-slate-500">
                        {item.qty} {item.unit} x Rp {item.price_at_sale.toLocaleString('id-ID')}
                        {item.discount > 0 && ` (Disc: -Rp ${item.discount.toLocaleString('id-ID')})`}
                      </p>
                    </div>
                    <p className="font-semibold text-slate-300">
                      Rp {((item.price_at_sale - item.discount) * item.qty).toLocaleString('id-ID')}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal</span>
                <span>Rp {subtotal.toLocaleString('id-ID')}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-rose-400">
                  <span>Total Diskon</span>
                  <span>-Rp {totalDiscount.toLocaleString('id-ID')}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-extrabold text-emerald-400 pt-1 border-t border-slate-800/80">
                <span>Total Bayar</span>
                <span>Rp {transaction.total.toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="grid grid-cols-2 gap-3 shrink-0 print-hide">
            <button
              onClick={handlePrint}
              className="bg-violet-600 hover:bg-violet-500 text-white py-3 font-bold rounded-xl text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-violet-600/10 transition-colors tap-effect"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Cetak Invoice
            </button>
            <button
              onClick={handleShareWA}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 py-3 font-bold rounded-xl text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/10 transition-colors tap-effect"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.012 2c-5.506 0-9.988 4.482-9.988 9.988 0 1.76.46 3.414 1.258 4.861L2.03 22l5.31-.1.01.01a9.96 9.96 0 004.662 1.15c5.506 0 9.988-4.482 9.988-9.988C22 6.482 17.518 2 12.012 2zm6.262 14.188c-.27.76-1.36 1.39-1.89 1.44-.48.05-1.1.22-3.23-.62a12.87 12.87 0 01-5.63-4.94c-.95-1.27-1.52-2.74-1.52-4.26 0-1.61.84-2.4 1.14-2.7.25-.26.54-.33.72-.33h.52c.16 0 .38-.02.58.46.22.52.74 1.8.8 1.93.07.13.11.28.02.46-.08.18-.13.3-.27.46-.14.16-.3.35-.42.47-.13.14-.27.29-.12.55a8.77 8.77 0 001.6 2c.74.66 1.37 1.08 1.91 1.34.25.12.5.1.69-.11.23-.26.97-1.12 1.22-1.5.1-.15.2-.12.35-.06l2.25 1.06c.15.07.25.1.29.17.04.07.04.42-.08.76z"/>
              </svg>
              Kirim Invoice
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
