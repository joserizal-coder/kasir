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
    // Since we don't have a synced_at in local stock_movements yet,
    // we can either add synced_at or just insert them. Let's add synced_at check for stock_movements.
    // For simplicity, we can fetch all stock movements and push them, or add `synced` flag.
    // Let's check locally which stock movements are not synced. 
    // We can add a 'synced' boolean field to stock_movements in db.js (defaults to false).
    // Let's query unsynced ones.
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
      // Clear out local products not on server to keep in sync, or just put all
      await db.products.where('store_id').equals(storeId).delete();
      await db.products.bulkPut(productsData);
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
      await db.expenses.where('store_id').equals(storeId).delete();
      await db.expenses.bulkPut(expensesData);
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
  
  // First sync up changes
  const txUp = await syncTransactionsUp(storeId);
  const movUp = await syncStockMovementsUp(storeId);
  
  // Then sync down latest records
  const down = await syncDown(storeId);

  return {
    success: txUp.success && movUp.success && down.success,
    txUp,
    movUp,
    down
  };
}

// Background sync manager
let syncIntervalId = null;

export function startPeriodicSync(storeId, intervalMs = 30000) {
  if (typeof window === 'undefined') return;

  // Stop any existing sync
  stopPeriodicSync();

  // Run sync immediately
  syncAll(storeId);

  // Set up periodic timer
  syncIntervalId = setInterval(() => {
    syncAll(storeId);
  }, intervalMs);

  // Set up online event listener to trigger immediate sync when connection is restored
  const handleOnline = () => {
    console.log('App came online. Triggering immediate sync...');
    syncAll(storeId);
  };
  window.addEventListener('online', handleOnline);

  // Store cleanup handler
  window._syncOnlineHandler = handleOnline;
}

export function stopPeriodicSync() {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
  if (typeof window !== 'undefined' && window._syncOnlineHandler) {
    window.removeEventListener('online', window._syncOnlineHandler);
    delete window._syncOnlineHandler;
  }
}
