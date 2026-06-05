import { supabase } from './supabase';
import { db } from './db';

// Checks if the client has internet connectivity
export function isOnline() {
  if (typeof window !== 'undefined') {
    return navigator.onLine;
  }
  return false;
}

// Push unsynced transactions and their items to Supabase
export async function syncTransactionsUp(storeId) {
  if (!isOnline()) return { success: false, error: 'Offline' };

  try {
    // 1. Get all unsynced transactions for this store
    const unsyncedTx = await db.transactions
      .where('store_id').equals(storeId)
      .and(tx => !tx.synced_at)
      .toArray();

    if (unsyncedTx.length === 0) return { success: true };

    console.log(`Syncing ${unsyncedTx.length} transactions up...`);

    for (const tx of unsyncedTx) {
      // Get items for this transaction
      const items = await db.transaction_items
        .where('transaction_id').equals(tx.id)
        .toArray();

      // Clean metadata before uploading
      const txToUpload = { ...tx };
      delete txToUpload.synced_at; // Will be set by database default or on success

      // Insert transaction header to Supabase
      const { error: txError } = await supabase
        .from('transactions')
        .upsert(txToUpload);

      if (txError) throw txError;

      // Insert transaction items to Supabase
      if (items.length > 0) {
        const { error: itemsError } = await supabase
          .from('transaction_items')
          .upsert(items);

        if (itemsError) throw itemsError;
      }

      // Mark transaction as synced in local DB
      await db.transactions.update(tx.id, {
        synced_at: new Date().toISOString()
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error syncing transactions up:', error);
    return { success: false, error };
  }
}

// Push unsynced stock movements to Supabase
export async function syncStockMovementsUp(storeId) {
  if (!isOnline()) return { success: false, error: 'Offline' };

  try {
    const unsyncedMovements = await db.stock_movements
      .where('store_id').equals(storeId)
      .and(mov => !mov.synced)
      .toArray();

    if (unsyncedMovements.length === 0) return { success: true };

    const movementsToUpload = unsyncedMovements.map(mov => {
      const copy = { ...mov };
      delete copy.synced;
      return copy;
    });

    const { error } = await supabase
      .from('stock_movements')
      .upsert(movementsToUpload);

    if (error) throw error;

    // Mark as synced locally
    for (const mov of unsyncedMovements) {
      await db.stock_movements.update(mov.id, { synced: true });
    }

    return { success: true };
  } catch (error) {
    console.error('Error syncing stock movements up:', error);
    return { success: false, error };
  }
}

// Push unsynced products to Supabase (produk yang dibuat/diubah saat offline)
export async function syncProductsUp(storeId) {
  if (!isOnline()) return { success: false, error: 'Offline' };

  try {
    const unsyncedProducts = await db.products
      .where('store_id').equals(storeId)
      .and(p => p.synced === false)
      .toArray();

    if (unsyncedProducts.length === 0) return { success: true };

    console.log(`Syncing ${unsyncedProducts.length} products up...`);

    const toUpload = unsyncedProducts.map(p => {
      const copy = { ...p };
      delete copy.synced;
      return copy;
    });

    const { error } = await supabase
      .from('products')
      .upsert(toUpload);

    if (error) throw error;

    for (const p of unsyncedProducts) {
      await db.products.update(p.id, { synced: true });
    }

    return { success: true };
  } catch (error) {
    console.error('Error syncing products up:', error);
    return { success: false, error };
  }
}

// Push unsynced expenses to Supabase (pengeluaran yang dicatat saat offline)
export async function syncExpensesUp(storeId) {
  if (!isOnline()) return { success: false, error: 'Offline' };

  try {
    const unsyncedExpenses = await db.expenses
      .where('store_id').equals(storeId)
      .and(e => e.synced === false)
      .toArray();

    if (unsyncedExpenses.length === 0) return { success: true };

    console.log(`Syncing ${unsyncedExpenses.length} expenses up...`);

    const toUpload = unsyncedExpenses.map(e => {
      const copy = { ...e };
      delete copy.synced;
      return copy;
    });

    const { error } = await supabase
      .from('expenses')
      .upsert(toUpload);

    if (error) throw error;

    for (const e of unsyncedExpenses) {
      await db.expenses.update(e.id, { synced: true });
    }

    return { success: true };
  } catch (error) {
    console.error('Error syncing expenses up:', error);
    return { success: false, error };
  }
}

// Pull latest products, customers, and active cashiers from Supabase to IndexedDB
export async function syncDown(storeId) {
  if (!isOnline()) return { success: false, error: 'Offline' };

  try {
    // 1. Sync Store Info
    const { data: storeData, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single();

    if (storeError) throw storeError;
    if (storeData) {
      await db.stores.put(storeData);
    }

    // 2. Sync Products
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', storeId);

    if (productsError) throw productsError;
    if (productsData) {
      // Tandai semua produk dari server sebagai sudah synced
      const withSynced = productsData.map(p => ({ ...p, synced: true }));
      await db.products.where('store_id').equals(storeId).delete();
      await db.products.bulkPut(withSynced);
    }

    // 3. Sync Customers
    const { data: customersData, error: customersError } = await supabase
      .from('customers')
      .select('*')
      .eq('store_id', storeId);

    if (customersError) throw customersError;
    if (customersData) {
      await db.customers.where('store_id').equals(storeId).delete();
      await db.customers.bulkPut(customersData);
    }

    // 4. Sync Cashiers
    const { data: cashiersData, error: cashiersError } = await supabase
      .from('cashiers')
      .select('*')
      .eq('store_id', storeId);

    if (cashiersError) throw cashiersError;
    if (cashiersData) {
      await db.cashiers.where('store_id').equals(storeId).delete();
      await db.cashiers.bulkPut(cashiersData);
    }

    // 5. Sync Expenses
    const { data: expensesData, error: expensesError } = await supabase
      .from('expenses')
      .select('*')
      .eq('store_id', storeId);

    if (expensesError) throw expensesError;
    if (expensesData) {
      const withSynced = expensesData.map(e => ({ ...e, synced: true }));
      await db.expenses.where('store_id').equals(storeId).delete();
      await db.expenses.bulkPut(withSynced);
    }

    // 6. Sync Subscription Logs (Store owner can view)
    const { data: logsData, error: logsError } = await supabase
      .from('subscription_logs')
      .select('*')
      .eq('store_id', storeId);

    if (!logsError && logsData) {
      await db.subscription_logs.where('store_id').equals(storeId).delete();
      await db.subscription_logs.bulkPut(logsData);
    }

    console.log('Sync down completed successfully.');
    return { success: true };
  } catch (error) {
    console.error('Error syncing down:', error);
    return { success: false, error };
  }
}

// Global helper to trigger both upload and download sync
export async function syncAll(storeId) {
  if (!storeId) return { success: false, error: 'No store ID provided' };
  if (!isOnline()) return { success: false, error: 'Offline' };

  // Upload semua data lokal yang belum tersinkronisasi
  const txUp   = await syncTransactionsUp(storeId);
  const movUp  = await syncStockMovementsUp(storeId);
  const prodUp = await syncProductsUp(storeId);
  const expUp  = await syncExpensesUp(storeId);

  // Download data terbaru dari server
  const down = await syncDown(storeId);

  return {
    success: txUp.success && movUp.success && prodUp.success && expUp.success && down.success,
    txUp,
    movUp,
    prodUp,
    expUp,
    down
  };
}

// Background sync manager
let syncIntervalId = null;

export function startPeriodicSync(storeId, intervalMs = 30000) {
  if (typeof window === 'undefined') return;

  // Stop any existing sync
  stopPeriodicSync();

  // Jalankan sync pertama segera (hanya jika online)
  if (isOnline()) {
    syncAll(storeId);
  }

  // Timer periodik — syncAll sudah punya guard isOnline() di dalamnya
  syncIntervalId = setInterval(() => {
    syncAll(storeId);
  }, intervalMs);
}

export function stopPeriodicSync() {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
}
