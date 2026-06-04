'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { db, clearLocalData } from '../lib/db';
import { syncAll, startPeriodicSync, stopPeriodicSync, isOnline as checkOnline } from '../lib/sync';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  // Global State
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState(null);
  const [cashier, setCashier] = useState(null); // Active cashier session (can be owner or employee)
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [cart, setCart] = useState([]);
  
  // Cache for local data representation
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  
  // Trigger online/offline detection
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    setOnline(checkOnline());
    
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen to Supabase Auth state changes
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        await loadStoreData(session.user.id);
      } else {
        setUser(null);
        setStore(null);
        setCashier(null);
        setLoading(false);
      }
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setUser(session.user);
        await loadStoreData(session.user.id);
      } else {
        setUser(null);
        setStore(null);
        setCashier(null);
        await clearLocalData();
        setProducts([]);
        setCustomers([]);
        setExpenses([]);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Sync trigger when store changes
  useEffect(() => {
    if (store?.id) {
      // Load local Dexie data first for instant loading
      loadDexieCache(store.id);
      
      // Start background sync
      startPeriodicSync(store.id);
      
      // Run sync immediately
      triggerSync();
    } else {
      stopPeriodicSync();
    }
    return () => {
      stopPeriodicSync();
    };
  }, [store?.id]);

  // Load store details for owner
  const loadStoreData = async (ownerId) => {
    try {
      setLoading(true);
      
      // 1. Try to fetch from local Dexie first
      let localStore = await db.stores.where('owner_id').equals(ownerId).first();
      
      if (localStore) {
        setStore(localStore);
      }

      // 2. Fetch from server if online
      if (checkOnline()) {
        const { data, error } = await supabase
          .from('stores')
          .select('*')
          .eq('owner_id', ownerId)
          .maybeSingle();
          
        if (!error && data) {
          await db.stores.put(data);
          setStore(data);
          localStore = data;
        }
      }
      
      // 3. Auto-login cashier if store exists (owner can bypass PIN or auto-login as owner cashier)
      if (localStore) {
        const ownerCashier = await db.cashiers
          .where('store_id').equals(localStore.id)
          .and(c => c.role === 'owner')
          .first();
          
        if (ownerCashier) {
          setCashier(ownerCashier);
        }
      }
    } catch (err) {
      console.error('Error loading store data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load from Dexie cache to State variables
  const loadDexieCache = async (storeId) => {
    if (!storeId) return;
    const localProds = await db.products.where('store_id').equals(storeId).toArray();
    const localCusts = await db.customers.where('store_id').equals(storeId).toArray();
    const localExps = await db.expenses.where('store_id').equals(storeId).toArray();
    
    setProducts(localProds.filter(p => p.is_active));
    setCustomers(localCusts);
    setExpenses(localExps);
  };

  // Trigger global sync manually
  const triggerSync = async () => {
    if (!store?.id || !checkOnline()) return;
    setSyncing(true);
    try {
      await syncAll(store.id);
      await loadDexieCache(store.id);
      // Reload store info (e.g. plan status)
      const refreshedStore = await db.stores.get(store.id);
      if (refreshedStore) setStore(refreshedStore);
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  // Log in as Cashier using PIN
  const loginCashier = async (pin) => {
    if (!store?.id) return { success: false, error: 'No active store' };
    
    // Check locally first
    const match = await db.cashiers
      .where('store_id').equals(store.id)
      .and(c => c.pin === pin && c.is_active)
      .first();

    if (match) {
      setCashier(match);
      return { success: true, cashier: match };
    }
    
    return { success: false, error: 'PIN kasir salah atau tidak aktif' };
  };

  const logoutCashier = () => {
    // If cashier is employee, log them out back to PIN screen.
    // If owner, let them remain logged in as owner.
    setCashier(null);
  };

  // Create new store and initial setups
  const createStore = async (storeName, businessType) => {
    if (!user) return { success: false, error: 'User not logged in' };
    
    try {
      setLoading(true);
      const newStore = {
        owner_id: user.id,
        name: storeName,
        business_type: businessType,
        plan: 'Gratis',
        settings: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      let savedStore;
      if (checkOnline()) {
        const { data, error } = await supabase
          .from('stores')
          .insert(newStore)
          .select()
          .single();
          
        if (error) throw error;
        savedStore = data;
      } else {
        // Generate client UUID if offline
        newStore.id = crypto.randomUUID();
        savedStore = newStore;
      }

      // Save to Dexie
      await db.stores.put(savedStore);
      setStore(savedStore);

      // Create owner cashier account
      const newCashier = {
        id: crypto.randomUUID(),
        store_id: savedStore.id,
        user_id: user.id,
        name: 'Pemilik Toko',
        role: 'owner',
        pin: '1234', // Default PIN for owner onboarding
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (checkOnline()) {
        await supabase.from('cashiers').insert(newCashier);
      }
      await db.cashiers.put(newCashier);
      setCashier(newCashier);

      // Add 3 starter products (Onboarding Step 2 helper)
      const starterProducts = [
        {
          id: crypto.randomUUID(),
          store_id: savedStore.id,
          name: 'Teh Manis Hangat',
          category: 'Minuman',
          price: 5000,
          cost_price: 2000,
          stock: 100,
          unit: 'gelas',
          is_active: true
        },
        {
          id: crypto.randomUUID(),
          store_id: savedStore.id,
          name: 'Nasi Goreng Biasa',
          category: 'Makanan',
          price: 15000,
          cost_price: 8000,
          stock: 50,
          unit: 'porsi',
          is_active: true
        },
        {
          id: crypto.randomUUID(),
          store_id: savedStore.id,
          name: 'Kerupuk Kaleng',
          category: 'Camilan',
          price: 2000,
          cost_price: 1000,
          stock: 200,
          unit: 'pcs',
          is_active: true
        }
      ];

      if (checkOnline()) {
        await supabase.from('products').insert(starterProducts);
      }
      await db.products.bulkPut(starterProducts);
      await loadDexieCache(savedStore.id);

      return { success: true, store: savedStore };
    } catch (err) {
      console.error('Error creating store:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Products CRUD
  const saveProduct = async (productData) => {
    if (!store?.id) return { success: false, error: 'No active store' };
    
    try {
      const isNew = !productData.id;
      const product = {
        id: productData.id || crypto.randomUUID(),
        store_id: store.id,
        name: productData.name,
        category: productData.category || 'Lain-lain',
        price: parseFloat(productData.price) || 0,
        cost_price: parseFloat(productData.cost_price) || 0,
        stock: parseFloat(productData.stock) || 0,
        unit: productData.unit || 'pcs',
        is_active: productData.is_active !== undefined ? productData.is_active : true,
        created_at: productData.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // 1. Save to local Dexie
      await db.products.put(product);
      
      // 2. Add a stock movement log if this is a new product or if stock adjusted
      const oldProd = isNew ? null : await db.products.get(product.id);
      const stockDiff = oldProd ? product.stock - oldProd.stock : product.stock;
      
      if (stockDiff !== 0) {
        const movement = {
          id: crypto.randomUUID(),
          store_id: store.id,
          product_id: product.id,
          type: stockDiff > 0 ? 'in' : 'out',
          qty: Math.abs(stockDiff),
          note: isNew ? 'Stok awal produk' : 'Penyesuaian stok manual',
          created_at: new Date().toISOString(),
          synced: false
        };
        await db.stock_movements.put(movement);
      }

      // 3. Save to Supabase if online
      if (checkOnline()) {
        await supabase.from('products').upsert(product);
      }

      await loadDexieCache(store.id);
      triggerSync(); // Queue background sync
      return { success: true, product };
    } catch (err) {
      console.error('Error saving product:', err);
      return { success: false, error: err.message };
    }
  };

  // Cart operations
  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, qty: item.qty + 1 } 
            : item
        );
      }
      return [...prev, { product, qty: 1, discount: 0 }];
    });
  };

  const updateCartQty = (productId, qty) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(item => item.product.id !== productId));
    } else {
      setCart(prev => prev.map(item => 
        item.product.id === productId ? { ...item, qty } : item
      ));
    }
  };

  const updateCartDiscount = (productId, discount) => {
    setCart(prev => prev.map(item => 
      item.product.id === productId ? { ...item, discount } : item
    ));
  };

  const clearCart = () => setCart([]);

  // Complete Cashier Transaction
  const checkout = async (paymentMethod, amountReceived = 0, customerId = null) => {
    if (!store?.id) return { success: false, error: 'No active store' };
    if (cart.length === 0) return { success: false, error: 'Keranjang belanja kosong' };

    try {
      const total = cart.reduce((sum, item) => sum + ((item.product.price - item.discount) * item.qty), 0);
      const transactionId = crypto.randomUUID();

      const transaction = {
        id: transactionId,
        store_id: store.id,
        cashier_id: cashier?.id || null,
        total: total,
        payment_method: paymentMethod, // Tunai, QRIS, Kredit
        status: 'completed',
        created_at: new Date().toISOString(),
        synced_at: null // Null triggers syncUp
      };

      const transactionItems = cart.map(item => ({
        id: crypto.randomUUID(),
        transaction_id: transactionId,
        product_id: item.product.id,
        qty: item.qty,
        price_at_sale: item.product.price,
        discount: item.discount
      }));

      // 1. Save Transaction & Items to Dexie
      await db.transactions.put(transaction);
      await db.transaction_items.bulkPut(transactionItems);

      // 2. Update stock level and log movement for each item in Dexie
      for (const item of cart) {
        const prod = await db.products.get(item.product.id);
        if (prod) {
          const newStock = Math.max(0, prod.stock - item.qty);
          await db.products.update(item.product.id, { stock: newStock });
          
          // Log stock out movement
          await db.stock_movements.put({
            id: crypto.randomUUID(),
            store_id: store.id,
            product_id: item.product.id,
            type: 'out',
            qty: item.qty,
            note: `Transaksi kasir ${transactionId.slice(0, 8)}`,
            created_at: new Date().toISOString(),
            synced: false
          });
        }
      }

      // 3. If method is "Kredit" (Hutang) and customerId is selected, add to customer debt
      if (paymentMethod === 'Kredit' && customerId) {
        const cust = await db.customers.get(customerId);
        if (cust) {
          const newDebt = (parseFloat(cust.total_debt) || 0) + total;
          await db.customers.update(customerId, { total_debt: newDebt });
          if (checkOnline()) {
            await supabase.from('customers').update({ total_debt: newDebt }).eq('id', customerId);
          }
        }
      }

      // Clear cart
      clearCart();
      
      // Refresh local cache
      await loadDexieCache(store.id);

      // Trigger background upload
      triggerSync();

      return { success: true, transactionId, total };
    } catch (err) {
      console.error('Checkout failed:', err);
      return { success: false, error: err.message };
    }
  };

  // Add Expense
  const addExpense = async (category, amount, description) => {
    if (!store?.id) return { success: false, error: 'No active store' };

    try {
      const expense = {
        id: crypto.randomUUID(),
        store_id: store.id,
        category,
        amount: parseFloat(amount) || 0,
        description,
        date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await db.expenses.put(expense);
      if (checkOnline()) {
        await supabase.from('expenses').insert(expense);
      }
      
      await loadDexieCache(store.id);
      triggerSync();
      return { success: true };
    } catch (err) {
      console.error('Failed to add expense:', err);
      return { success: false, error: err.message };
    }
  };

  return (
    <AppContext.Provider value={{
      user,
      loading,
      store,
      cashier,
      online,
      syncing,
      products,
      customers,
      expenses,
      cart,
      addToCart,
      updateCartQty,
      updateCartDiscount,
      clearCart,
      loginCashier,
      logoutCashier,
      createStore,
      saveProduct,
      checkout,
      addExpense,
      triggerSync
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
