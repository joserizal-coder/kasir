'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { db } from '../../../lib/db';
import Link from 'next/link';
import InvoiceModal from '../../../components/InvoiceModal';

export default function CashierPage() {
  const {
    store,
    cashier,
    online,
    products,
    customers,
    cart,
    addToCart,
    updateCartQty,
    updateCartDiscount,
    clearCart,
    loginCashier,
    logoutCashier,
    checkout,
    triggerSync,
    updateStoreSettings
  } = useApp();

  // PIN screen state
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  // Cashier screen state
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [categories, setCategories] = useState(['Semua']);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  
  // Checkout Modal states
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Tunai'); // Tunai, QRIS, Kredit
  const [amountReceived, setAmountReceived] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  
  // Success Modal states
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastTxId, setLastTxId] = useState('');
  const [lastTxTotal, setLastTxTotal] = useState(0);
  const [lastTxChange, setLastTxChange] = useState(0);
  const [customerPhone, setCustomerPhone] = useState('');

  // Invoice Modal states
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceTxId, setInvoiceTxId] = useState('');

  // QRIS state and handlers
  const [uploadingQris, setUploadingQris] = useState(false);

  const handleQrisUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

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

  // Extract unique categories from products
  useEffect(() => {
    if (products.length > 0) {
      const cats = ['Semua', ...new Set(products.map(p => p.category).filter(Boolean))];
      setCategories(cats);
    }
  }, [products]);

  // Handle PIN submit
  const handlePinSubmit = async (e) => {
    e.preventDefault();
    if (pin.length !== 4) return;
    setPinError('');
    setPinLoading(true);
    const res = await loginCashier(pin);
    setPinLoading(false);
    if (!res.success) {
      setPinError(res.error);
      setPin('');
    }
  };

  const handlePinKeyPress = (val) => {
    if (pin.length < 4) {
      setPin(prev => prev + val);
    }
  };

  const handlePinDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  // If no store is selected yet, prompt user to go home
  if (!store) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center gap-4">
        <p>Anda belum membuat toko. Silakan masuk ke halaman utama.</p>
        <Link href="/" className="px-6 py-2.5 bg-emerald-500 text-slate-950 font-bold rounded-xl">
          Kembali ke Beranda
        </Link>
      </div>
    );
  }

  // SCREEN 1: Cashier Login PIN Screen (4-digit input)
  if (!cashier) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-6 relative">
        <div className="absolute top-[-10%] w-[80%] h-[30%] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="w-full max-w-sm bg-slate-900/50 border border-slate-800 p-8 rounded-3xl shadow-2xl text-center space-y-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">{store.name}</h1>
            <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">PIN KASIR DIPERLUKAN</p>
          </div>

          <div className="flex justify-center gap-4 py-4">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full border-2 border-emerald-400 ${pin.length > idx ? 'bg-emerald-400' : 'bg-transparent'}`}
              ></div>
            ))}
          </div>

          {pinError && (
            <p className="text-rose-400 text-sm font-semibold">{pinError}</p>
          )}

          {/* Quick PIN Pad UI */}
          <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => handlePinKeyPress(val.toString())}
                className="w-16 h-16 rounded-full bg-slate-800/80 hover:bg-slate-700 active:scale-95 font-bold text-xl flex items-center justify-center transition-all"
              >
                {val}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handlePinKeyPress('0')}
              className="col-start-2 w-16 h-16 rounded-full bg-slate-800/80 hover:bg-slate-700 active:scale-95 font-bold text-xl flex items-center justify-center transition-all"
            >
              0
            </button>
            <button
              type="button"
              onClick={handlePinDelete}
              className="w-16 h-16 rounded-full bg-slate-800/30 hover:bg-rose-500/10 text-rose-400 active:scale-95 font-bold text-sm flex items-center justify-center transition-all"
            >
              Hapus
            </button>
          </div>

          <form onSubmit={handlePinSubmit} className="pt-2">
            <button
              type="submit"
              disabled={pin.length !== 4 || pinLoading}
              className="w-full bg-emerald-500 disabled:opacity-50 hover:bg-emerald-400 text-slate-950 font-bold py-3 px-4 rounded-xl shadow-lg tap-effect transition-all"
            >
              Masuk Kasir
            </button>
          </form>

          <p className="text-[10px] text-slate-500 italic">Petunjuk: PIN default pemilik toko adalah 1234</p>

          <Link href="/" className="inline-block text-slate-400 hover:text-white text-sm pt-2 hover:underline">
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    );
  }

  // Helper values
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  const cartTotal = cart.reduce((sum, item) => sum + ((item.product.price - item.discount) * item.qty), 0);

  // Filtered Products list
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'Semua' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleQuickCash = (amt) => {
    setAmountReceived(amt.toString());
  };

  const handleCheckoutSubmit = async () => {
    if (paymentMethod === 'Tunai' && (!amountReceived || parseFloat(amountReceived) < cartTotal)) {
      alert('Uang yang diterima kurang dari total belanja.');
      return;
    }
    if (paymentMethod === 'Kredit' && !selectedCustomer) {
      alert('Pilih pelanggan tetap untuk pembayaran kredit/hutang.');
      return;
    }

    setCheckoutLoading(true);
    try {
      const received = paymentMethod === 'Tunai' ? parseFloat(amountReceived) : cartTotal;
      const res = await checkout(paymentMethod, received, selectedCustomer || null);
      
      if (res.success) {
        setLastTxId(res.transactionId);
        setLastTxTotal(res.total);
        setLastTxChange(received - res.total);
        
        // Populate customer phone if customer is selected
        if (paymentMethod === 'Kredit' && selectedCustomer) {
          const cust = customers.find(c => c.id === selectedCustomer);
          if (cust?.phone) setCustomerPhone(cust.phone);
        }
        
        setShowCheckoutModal(false);
        setShowSuccessModal(true);
        // Clear inputs
        setAmountReceived('');
        setSelectedCustomer('');
      } else {
        alert(res.error || 'Gagal memproses transaksi');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const getWhatsAppLink = () => {
    const text = `Halo, terima kasih telah berbelanja di *${store.name}*!\n\n` +
      `*Detail Transaksi:*\n` +
      `No. Nota: #${lastTxId.slice(0, 8).toUpperCase()}\n` +
      `Total Belanja: Rp ${lastTxTotal.toLocaleString('id-ID')}\n` +
      `Metode Bayar: ${paymentMethod}\n\n` +
      `Simpan struk ini sebagai bukti pembelian. Sampai jumpa kembali!`;
    
    const phone = customerPhone.replace(/\D/g, ''); // strip non-numeric
    const targetPhone = phone.startsWith('0') ? '62' + phone.slice(1) : phone;
    
    return `https://wa.me/${targetPhone || ''}?text=${encodeURIComponent(text)}`;
  };

  // SCREEN 2: Main Cash Register Panel
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* LEFT PANEL: Product Picker & Grid */}
      <div className="flex-1 flex flex-col min-h-screen border-r border-slate-900 pb-20 md:pb-0">
        {/* Cashier Header */}
        <header className="bg-slate-900/60 border-b border-slate-900 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </Link>
            <div>
              <h1 className="font-bold text-md flex items-center gap-1.5">
                {store.name}
                <span className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
              </h1>
              <p className="text-[10px] text-slate-400">Kasir: <strong className="text-slate-200">{cashier.name}</strong></p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => logoutCashier()}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
            >
              Ganti Kasir (PIN)
            </button>
          </div>
        </header>

        {/* Filters and Search */}
        <div className="p-6 space-y-4">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </span>
            <input
              type="text"
              placeholder="Cari nama produk..."
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-3.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Category Chips scrollable */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-xs font-semibold shrink-0 transition-all ${
                  selectedCategory === cat
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/10'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full py-16 text-center text-slate-500">
              <p>Tidak ada produk ditemukan.</p>
            </div>
          ) : (
            filteredProducts.map((prod) => (
              <button
                key={prod.id}
                onClick={() => addToCart(prod)}
                disabled={prod.stock <= 0}
                className="group bg-slate-900 hover:bg-slate-900/80 border border-slate-800/80 hover:border-emerald-500/20 disabled:opacity-40 disabled:hover:border-slate-800 p-4 rounded-3xl text-left flex flex-col justify-between h-40 transition-all hover-scale tap-effect relative"
              >
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{prod.category || 'Lainnya'}</span>
                  <h3 className="font-bold text-md text-slate-100 line-clamp-2 mt-1">{prod.name}</h3>
                </div>

                <div className="flex justify-between items-end mt-4">
                  <div>
                    <p className="text-slate-400 text-xs">Stok: <strong className={prod.stock < 10 ? 'text-amber-400' : 'text-emerald-400'}>{prod.stock} {prod.unit}</strong></p>
                    <p className="font-extrabold text-emerald-400 mt-1">Rp {prod.price.toLocaleString('id-ID')}</p>
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-lg group-hover:bg-emerald-500 group-hover:text-slate-950 transition-all">
                    +
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Cart Summary Sidebar (Hidden on mobile by default) */}
      <div className="hidden md:w-96 md:flex flex-col h-screen bg-slate-900 border-l border-slate-800 shrink-0">
        {/* Cart Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex justify-between items-center">
          <h2 className="font-bold text-lg flex items-center gap-2">
            Keranjang Belanja
            <span className="bg-emerald-500 text-slate-950 text-xs px-2 py-0.5 rounded-full font-extrabold">{totalItems}</span>
          </h2>
          {cart.length > 0 && (
            <button onClick={clearCart} className="text-xs text-rose-400 hover:underline">
              Kosongkan
            </button>
          )}
        </div>

        {/* Cart list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col justify-center items-center text-center text-slate-500 space-y-2">
              <svg className="w-12 h-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
              <p className="text-sm">Keranjang kosong. Tap produk untuk menambahkan.</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="bg-slate-950/60 border border-slate-800/60 p-4 rounded-2xl space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-sm text-slate-200 line-clamp-1">{item.product.name}</h4>
                    <span className="text-[10px] text-emerald-400/80 font-bold">Rp {item.product.price.toLocaleString('id-ID')}</span>
                  </div>
                  <button 
                    onClick={() => updateCartQty(item.product.id, 0)}
                    className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex justify-between items-center">
                  {/* Quantity adjustment */}
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => updateCartQty(item.product.id, item.qty - 1)}
                      className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center justify-center font-bold"
                    >
                      -
                    </button>
                    <span className="font-semibold text-sm w-6 text-center">{item.qty}</span>
                    <button
                      onClick={() => updateCartQty(item.product.id, item.qty + 1)}
                      className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center justify-center font-bold"
                    >
                      +
                    </button>
                  </div>

                  {/* Item total price */}
                  <div className="text-right">
                    <p className="font-extrabold text-slate-200">
                      Rp {((item.product.price - item.discount) * item.qty).toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bottom checkout summaries */}
        <div className="p-6 bg-slate-950/40 border-t border-slate-800 space-y-4">
          <div className="flex justify-between items-center text-slate-400 text-sm">
            <span>Subtotal</span>
            <span>Rp {cartTotal.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between items-center text-white font-extrabold text-lg pt-2">
            <span>Total Bayar</span>
            <span className="text-emerald-400">Rp {cartTotal.toLocaleString('id-ID')}</span>
          </div>

          <button
            onClick={() => setShowCheckoutModal(true)}
            disabled={cart.length === 0}
            className="w-full bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-4 rounded-2xl shadow-lg shadow-emerald-500/10 tap-effect transition-all flex justify-center items-center gap-2"
          >
            Lanjut Pembayaran (Rp {cartTotal.toLocaleString('id-ID')})
          </button>
        </div>
      </div>

      {/* MOBILE ONLY: Sticky bottom bar to open cart */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 px-6 py-4 flex items-center justify-between z-20">
        <button
          onClick={() => setShowCartDrawer(true)}
          className="flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold relative">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">{totalItems}</span>
          </div>
          <div className="text-left">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Total Keranjang</p>
            <p className="font-extrabold text-emerald-400">Rp {cartTotal.toLocaleString('id-ID')}</p>
          </div>
        </button>

        <button
          onClick={() => setShowCheckoutModal(true)}
          disabled={cart.length === 0}
          className="px-6 py-3 bg-emerald-500 disabled:opacity-50 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg text-sm"
        >
          Bayar
        </button>
      </div>

      {/* MOBILE ONLY: Cart bottom sheet/drawer */}
      {showCartDrawer && (
        <div className="md:hidden fixed inset-0 bg-black/60 z-30 flex items-end">
          <div className="w-full max-h-[85vh] bg-slate-900 rounded-t-[32px] border-t border-slate-800 flex flex-col p-6 animate-slide-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg">Keranjang ({totalItems})</h3>
              <button 
                onClick={() => setShowCartDrawer(false)}
                className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 mb-6">
              {cart.map((item) => (
                <div key={item.product.id} className="bg-slate-950/60 border border-slate-800/60 p-4 rounded-2xl flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold text-sm text-slate-200">{item.product.name}</h4>
                    <p className="text-xs text-emerald-400 font-bold">Rp {((item.product.price - item.discount) * item.qty).toLocaleString('id-ID')}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateCartQty(item.product.id, item.qty - 1)}
                      className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center font-bold"
                    >
                      -
                    </button>
                    <span className="font-bold text-sm w-4 text-center">{item.qty}</span>
                    <button
                      onClick={() => updateCartQty(item.product.id, item.qty + 1)}
                      className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4 border-t border-slate-800 pt-4">
              <div className="flex justify-between items-center font-extrabold text-lg">
                <span>Total</span>
                <span className="text-emerald-400">Rp {cartTotal.toLocaleString('id-ID')}</span>
              </div>
              <button
                onClick={() => {
                  setShowCartDrawer(false);
                  setShowCheckoutModal(true);
                }}
                className="w-full bg-emerald-500 py-4 rounded-xl text-slate-950 font-bold shadow-lg"
              >
                Lanjut Pembayaran
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT MODAL */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md p-8 rounded-3xl shadow-2xl space-y-6 animate-zoom-in">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-xl">Pilih Pembayaran</h3>
              <button 
                onClick={() => setShowCheckoutModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/60 p-4 rounded-2xl text-center">
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">Total Tagihan</p>
              <h4 className="text-3xl font-extrabold text-emerald-400">Rp {cartTotal.toLocaleString('id-ID')}</h4>
            </div>

            {/* Payment Method Switcher */}
            <div className="grid grid-cols-3 gap-2">
              {['Tunai', 'QRIS', 'Kredit'].map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`py-3.5 rounded-xl font-bold text-xs transition-all ${
                    paymentMethod === method
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/10'
                      : 'bg-slate-950 border border-slate-800 text-slate-400 hover:bg-slate-800/50'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>

            {/* Form details based on Payment Method */}
            {paymentMethod === 'Tunai' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Uang Tunai Diterima (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="cth: 50000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-slate-100 placeholder:text-slate-700 font-extrabold text-lg focus:outline-none focus:border-emerald-500"
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(e.target.value)}
                  />
                </div>

                {/* Quick Cash Amounts */}
                <div className="grid grid-cols-3 gap-2">
                  {[cartTotal, 10000, 20000, 50000, 100000].map((amt) => {
                    if (amt < cartTotal && amt !== cartTotal) return null;
                    return (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleQuickCash(amt)}
                        className="py-2.5 bg-slate-950 border border-slate-800/80 hover:bg-slate-800 rounded-lg text-xs text-slate-300 font-semibold"
                      >
                        {amt === cartTotal ? 'Uang Pas' : `Rp ${amt.toLocaleString('id-ID')}`}
                      </button>
                    );
                  })}
                </div>

                {amountReceived && parseFloat(amountReceived) >= cartTotal && (
                  <div className="flex justify-between items-center text-sm font-semibold text-emerald-400 pt-2">
                    <span>Kembalian</span>
                    <span>Rp {(parseFloat(amountReceived) - cartTotal).toLocaleString('id-ID')}</span>
                  </div>
                )}
              </div>
            )}

            {paymentMethod === 'QRIS' && (
              <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl space-y-3 border border-slate-200">
                {/* Dynamic/Custom/Mock QR Code Display */}
                {store.settings?.qris_code ? (
                  <div className="w-44 h-44 bg-white border border-slate-200 rounded-xl overflow-hidden flex items-center justify-center p-2 shadow-sm">
                    <img 
                      src={store.settings.qris_code} 
                      alt="QRIS Toko" 
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-40 h-40 bg-slate-100 flex items-center justify-center font-bold text-slate-400 border border-slate-200 relative">
                    {/* Styled Mock QR Grid */}
                    <div className="absolute inset-2 grid grid-cols-4 gap-1 opacity-20">
                      {Array.from({ length: 16 }).map((_, i) => (
                        <div key={i} className={`bg-black ${i % 3 === 0 ? 'opacity-100' : 'opacity-0'}`}></div>
                      ))}
                    </div>
                    <div className="w-8 h-8 bg-emerald-500 rounded-lg absolute z-10 flex items-center justify-center text-slate-950 font-black text-xs">QR</div>
                    <span className="text-[10px] text-slate-800 font-extrabold uppercase mt-12 z-10">MOCK QRIS PASAR</span>
                  </div>
                )}

                {/* Upload/Change QRIS directly in cashier if cashier is the owner */}
                {cashier?.role === 'owner' ? (
                  <div className="text-center w-full">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer transition-colors border border-slate-300">
                      {uploadingQris ? (
                        <div className="w-3 h-3 border-2 border-slate-700 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                      )}
                      <span>{store.settings?.qris_code ? 'Ganti QRIS' : 'Unggah QRIS Toko'}</span>
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
                        type="button"
                        onClick={handleQrisDelete}
                        disabled={uploadingQris}
                        className="block mx-auto mt-1.5 text-[10px] text-rose-600 hover:underline font-semibold"
                      >
                        Hapus QRIS
                      </button>
                    )}
                  </div>
                ) : (
                  !store.settings?.qris_code && (
                    <p className="text-[10px] text-slate-400 text-center font-medium">
                      QRIS kustom belum diunggah oleh pemilik toko.
                    </p>
                  )
                )}
                
                <p className="text-[10px] text-slate-500 font-bold text-center">Scan QR code di atas menggunakan GoPay, OVO, Dana, atau LinkAja.</p>
              </div>
            )}

            {paymentMethod === 'Kredit' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Pilih Pelanggan Tetap
                  </label>
                  <select
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-emerald-500"
                    value={selectedCustomer}
                    onChange={(e) => setSelectedCustomer(e.target.value)}
                  >
                    <option value="">-- Pilih Pelanggan --</option>
                    {customers.map((cust) => (
                      <option key={cust.id} value={cust.id}>
                        {cust.name} (Hutang: Rp {cust.total_debt.toLocaleString('id-ID')})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">Hutang baru sebesar Rp {cartTotal.toLocaleString('id-ID')} akan dicatat ke saldo hutang pelanggan.</p>
                </div>
              </div>
            )}

            <button
              onClick={handleCheckoutSubmit}
              disabled={checkoutLoading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3.5 rounded-xl shadow-lg flex justify-center items-center gap-2"
            >
              {checkoutLoading ? (
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                'Konfirmasi Transaksi Selesai'
              )}
            </button>
          </div>
        </div>
      )}

      {/* SUCCESS TRANSACTION MODAL */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md p-8 rounded-3xl shadow-2xl text-center space-y-6 animate-zoom-in">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center font-bold text-3xl mx-auto shadow-lg shadow-emerald-500/10">
              ✓
            </div>
            
            <div className="space-y-1">
              <h3 className="font-extrabold text-2xl text-white">Transaksi Berhasil!</h3>
              <p className="text-xs text-slate-400">Nota: #{lastTxId.slice(0, 8).toUpperCase()}</p>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/60 p-5 rounded-2xl space-y-2">
              <div className="flex justify-between items-center text-sm text-slate-400">
                <span>Total Belanja</span>
                <span className="font-bold text-white">Rp {lastTxTotal.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-slate-400">
                <span>Metode Pembayaran</span>
                <span className="font-semibold text-white">{paymentMethod}</span>
              </div>
              {paymentMethod === 'Tunai' && (
                <div className="flex justify-between items-center text-md text-emerald-400 font-extrabold border-t border-slate-900 pt-2 mt-2">
                  <span>Kembalian</span>
                  <span>Rp {lastTxChange.toLocaleString('id-ID')}</span>
                </div>
              )}
            </div>

            {/* WA receipt form */}
            <div className="space-y-3 pt-2">
              <label className="block text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Kirim Struk via WhatsApp (Opsional)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="cth: 08123456789"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
                <a
                  href={getWhatsAppLink()}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-3 font-bold rounded-xl text-sm flex items-center justify-center gap-1.5 shrink-0"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.012 2c-5.506 0-9.988 4.482-9.988 9.988 0 1.76.46 3.414 1.258 4.861L2.03 22l5.31-.1.01.01a9.96 9.96 0 004.662 1.15c5.506 0 9.988-4.482 9.988-9.988C22 6.482 17.518 2 12.012 2zm6.262 14.188c-.27.76-1.36 1.39-1.89 1.44-.48.05-1.1.22-3.23-.62a12.87 12.87 0 01-5.63-4.94c-.95-1.27-1.52-2.74-1.52-4.26 0-1.61.84-2.4 1.14-2.7.25-.26.54-.33.72-.33h.52c.16 0 .38-.02.58.46.22.52.74 1.8.8 1.93.07.13.11.28.02.46-.08.18-.13.3-.27.46-.14.16-.3.35-.42.47-.13.14-.27.29-.12.55a8.77 8.77 0 001.6 2c.74.66 1.37 1.08 1.91 1.34.25.12.5.1.69-.11.23-.26.97-1.12 1.22-1.5.1-.15.2-.12.35-.06l2.25 1.06c.15.07.25.1.29.17.04.07.04.42-.08.76z"/></svg>
                  Kirim
                </a>
              </div>
            </div>

            {/* Invoice Button */}
            <button
              onClick={() => {
                setInvoiceTxId(lastTxId);
                setShowInvoiceModal(true);
              }}
              className="w-full bg-violet-600/10 hover:bg-violet-600/20 border border-violet-600/20 text-violet-400 py-3 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors tap-effect"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Lihat & Cetak Invoice
            </button>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  triggerSync(); // refresh background sync
                }}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 py-3.5 font-bold rounded-xl text-sm"
              >
                Tutup & Lewati
              </button>
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  triggerSync();
                }}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 py-3.5 font-bold rounded-xl text-sm"
              >
                Transaksi Baru
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INVOICE MODAL */}
      {showInvoiceModal && (
        <InvoiceModal
          transactionId={invoiceTxId}
          onClose={() => setShowInvoiceModal(false)}
        />
      )}
    </div>
  );
}
