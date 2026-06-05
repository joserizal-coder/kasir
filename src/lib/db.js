import Dexie from 'dexie';

// Initialize the IndexedDB local database for offline-first capabilities
export const db = new Dexie('KasirKitaDB');

if (typeof window !== 'undefined') {
  window.db = db;
}

// v1 — schema awal
db.version(1).stores({
  stores: 'id, owner_id, plan',
  products: 'id, store_id, category, is_active',
  transactions: 'id, store_id, cashier_id, payment_method, status, synced_at, created_at',
  transaction_items: 'id, transaction_id, product_id',
  stock_movements: 'id, store_id, product_id, type',
  customers: 'id, store_id, name',
  expenses: 'id, store_id, category, date',
  cashiers: 'id, store_id, user_id, pin, is_active',
  subscription_logs: 'id, store_id, admin_id, action'
});

// v2 — tambah indeks `synced` pada products, expenses, dan stock_movements
//       agar data yang dibuat saat offline bisa di-detect dan di-upload saat online
db.version(2).stores({
  stores: 'id, owner_id, plan',
  products: 'id, store_id, category, is_active, synced',
  transactions: 'id, store_id, cashier_id, payment_method, status, synced_at, created_at',
  transaction_items: 'id, transaction_id, product_id',
  stock_movements: 'id, store_id, product_id, type, synced',
  customers: 'id, store_id, name',
  expenses: 'id, store_id, category, date, synced',
  cashiers: 'id, store_id, user_id, pin, is_active',
  subscription_logs: 'id, store_id, admin_id, action'
});

// Helper function to clear all local tables (useful for logout/reset)
export async function clearLocalData() {
  await Promise.all([
    db.stores.clear(),
    db.products.clear(),
    db.transactions.clear(),
    db.transaction_items.clear(),
    db.stock_movements.clear(),
    db.customers.clear(),
    db.expenses.clear(),
    db.cashiers.clear(),
    db.subscription_logs.clear()
  ]);
}
