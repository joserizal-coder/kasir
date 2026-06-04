'use client';

import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import Link from 'next/link';

export default function ProductsPage() {
  const {
    store,
    products,
    saveProduct,
    online,
    triggerSync
  } = useApp();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');

  // Modal states
  const [showProductModal, setShowProductModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('Tambah Produk Baru');
  const [productId, setProductId] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Makanan');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [stock, setStock] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [isActive, setIsActive] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);

  // Extract unique categories for filter
  const categories = ['Semua', ...new Set(products.map(p => p.category).filter(Boolean))];

  // Open modal for adding
  const openAddModal = () => {
    setModalTitle('Tambah Produk Baru');
    setProductId('');
    setName('');
    setCategory('Makanan');
    setPrice('');
    setCostPrice('');
    setStock('');
    setUnit('pcs');
    setIsActive(true);
    setShowProductModal(true);
  };

  // Open modal for editing
  const openEditModal = (prod) => {
    setModalTitle('Ubah Detil Produk');
    setProductId(prod.id);
    setName(prod.name);
    setCategory(prod.category || 'Makanan');
    setPrice(prod.price.toString());
    setCostPrice(prod.cost_price.toString());
    setStock(prod.stock.toString());
    setUnit(prod.unit || 'pcs');
    setIsActive(prod.is_active);
    setShowProductModal(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaveLoading(true);
    try {
      const res = await saveProduct({
        id: productId || null,
        name,
        category,
        price,
        cost_price: costPrice,
        stock,
        unit,
        is_active: isActive
      });

      if (res.success) {
        setShowProductModal(false);
      } else {
        alert(res.error || 'Gagal menyimpan produk');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaveLoading(false);
    }
  };

  // Filtered list
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'Semua' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </Link>
          <div>
            <h1 className="font-bold text-md">Kelola Produk</h1>
            <p className="text-[10px] text-slate-400">Total: <strong className="text-slate-200">{products.length} item</strong></p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openAddModal}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/10 tap-effect transition-all"
          >
            + Tambah Produk
          </button>
        </div>
      </header>

      {/* Search and Filters */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </span>
            <input
              type="text"
              placeholder="Cari nama produk..."
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-3 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-xs font-semibold shrink-0 transition-all ${
                  selectedCategory === cat
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Products Table/List */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider bg-slate-900/60">
                  <th className="px-6 py-4">Nama Produk</th>
                  <th className="px-6 py-4">Kategori</th>
                  <th className="px-6 py-4">Harga Jual</th>
                  <th className="px-6 py-4">Harga Modal</th>
                  <th className="px-6 py-4 text-center">Stok</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                      Tidak ada produk ditemukan. Tambah produk pertama Anda dengan tombol di kanan atas.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((prod) => {
                    // Stock badge styling
                    let stockBadge = 'bg-emerald-500/10 text-emerald-400';
                    let stockText = 'Stok Cukup';
                    if (prod.stock <= 0) {
                      stockBadge = 'bg-rose-500/10 text-rose-400';
                      stockText = 'Habis';
                    } else if (prod.stock < 10) {
                      stockBadge = 'bg-amber-500/10 text-amber-400';
                      stockText = 'Menipis';
                    }

                    return (
                      <tr key={prod.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-100">{prod.name}</td>
                        <td className="px-6 py-4 text-slate-400 text-xs">{prod.category}</td>
                        <td className="px-6 py-4 font-bold text-emerald-400">Rp {prod.price.toLocaleString('id-ID')}</td>
                        <td className="px-6 py-4 text-slate-400">Rp {prod.cost_price.toLocaleString('id-ID')}</td>
                        <td className="px-6 py-4 text-center">
                          <div className="font-semibold text-slate-200">
                            {prod.stock} {prod.unit}
                          </div>
                          <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold ${stockBadge}`}>
                            {stockText}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${prod.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                            {prod.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => openEditModal(prod)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold hover-scale"
                          >
                            Ubah
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
      </main>

      {/* ADD/EDIT PRODUCT MODAL */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md p-8 rounded-3xl shadow-2xl space-y-6 animate-zoom-in">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-xl">{modalTitle}</h3>
              <button 
                onClick={() => setShowProductModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Nama Produk / Menu
                </label>
                <input
                  type="text"
                  required
                  placeholder="cth: Kopi Susu Aren, Mie Goreng Telur"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 placeholder:text-slate-700 focus:outline-none focus:border-emerald-500"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Kategori
                  </label>
                  <select
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="Makanan">Makanan</option>
                    <option value="Minuman">Minuman</option>
                    <option value="Camilan">Camilan</option>
                    <option value="Bahan Pokok">Bahan Pokok</option>
                    <option value="Lain-lain">Lain-lain</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Satuan Jual
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="pcs, porsi, gelas, kg"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 placeholder:text-slate-700 focus:outline-none focus:border-emerald-500"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Harga Jual (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="cth: 15000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 placeholder:text-slate-700 focus:outline-none focus:border-emerald-500"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Harga Modal / HPP (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="cth: 8000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 placeholder:text-slate-700 focus:outline-none focus:border-emerald-500"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Jumlah Stok Saat Ini
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="cth: 50"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 placeholder:text-slate-700 focus:outline-none focus:border-emerald-500"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                  />
                </div>

                <div className="pt-5 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActiveToggle"
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 bg-slate-950 border-slate-800"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  <label htmlFor="isActiveToggle" className="text-slate-300 font-semibold text-xs uppercase cursor-pointer">
                    Produk Aktif dijual
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={saveLoading}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3.5 rounded-xl shadow-lg mt-4 flex justify-center items-center gap-2"
              >
                {saveLoading ? (
                  <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  'Simpan Produk'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
