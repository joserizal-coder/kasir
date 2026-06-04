-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. STORES TABLE
CREATE TABLE IF NOT EXISTS public.stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    business_type TEXT,
    tax_id TEXT,
    plan TEXT NOT NULL DEFAULT 'Gratis',
    subscription_start TIMESTAMPTZ,
    subscription_end TIMESTAMPTZ,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for stores
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- Policies for stores
CREATE POLICY "Users can view their own stores" 
    ON public.stores FOR SELECT 
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own stores" 
    ON public.stores FOR INSERT 
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own stores" 
    ON public.stores FOR UPDATE 
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own stores" 
    ON public.stores FOR DELETE 
    USING (auth.uid() = owner_id);


-- 2. CASHIERS TABLE
CREATE TABLE IF NOT EXISTS public.cashiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'cashier', -- 'owner' or 'cashier'
    pin VARCHAR(4) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for cashiers
ALTER TABLE public.cashiers ENABLE ROW LEVEL SECURITY;

-- Helper function to check store ownership
CREATE OR REPLACE FUNCTION public.is_store_owner(store_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.stores 
        WHERE id = store_id AND owner_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is store owner or cashier
CREATE OR REPLACE FUNCTION public.has_store_access(store_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.is_store_owner(store_id) OR EXISTS (
        SELECT 1 FROM public.cashiers
        WHERE store_id = $1 AND user_id = auth.uid() AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies for cashiers
CREATE POLICY "Access stores cashiers" 
    ON public.cashiers FOR ALL 
    USING (public.has_store_access(store_id))
    WITH CHECK (public.has_store_access(store_id));


-- 3. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT,
    price NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    cost_price NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    stock NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    unit TEXT NOT NULL DEFAULT 'pcs',
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access products of accessed stores" 
    ON public.products FOR ALL 
    USING (public.has_store_access(store_id))
    WITH CHECK (public.has_store_access(store_id));


-- 4. TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY, -- Client side generated UUID v4
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    cashier_id UUID REFERENCES public.cashiers(id) ON DELETE SET NULL,
    total NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL, -- 'Tunai', 'QRIS', 'Kredit'
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    synced_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access transactions of accessed stores" 
    ON public.transactions FOR ALL 
    USING (public.has_store_access(store_id))
    WITH CHECK (public.has_store_access(store_id));


-- 5. TRANSACTION ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    qty NUMERIC(12,2) NOT NULL DEFAULT 1.00,
    price_at_sale NUMERIC(15,2) NOT NULL,
    discount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for transaction items
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access transaction items" 
    ON public.transaction_items FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.transactions t
            WHERE t.id = transaction_id AND public.has_store_access(t.store_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.transactions t
            WHERE t.id = transaction_id AND public.has_store_access(t.store_id)
        )
    );


-- 6. STOCK MOVEMENTS TABLE
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'in', 'out', 'adjustment'
    qty NUMERIC(12,2) NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for stock movements
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access stock movements of accessed stores" 
    ON public.stock_movements FOR ALL 
    USING (public.has_store_access(store_id))
    WITH CHECK (public.has_store_access(store_id));


-- 7. CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    total_debt NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for customers
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access customers of accessed stores" 
    ON public.customers FOR ALL 
    USING (public.has_store_access(store_id))
    WITH CHECK (public.has_store_access(store_id));


-- 8. EXPENSES TABLE
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    category TEXT,
    amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    description TEXT,
    date DATE NOT NULL DEFAULT current_date,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for expenses
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access expenses of accessed stores" 
    ON public.expenses FOR ALL 
    USING (public.has_store_access(store_id))
    WITH CHECK (public.has_store_access(store_id));


-- 9. SUBSCRIPTION LOGS TABLE
CREATE TABLE IF NOT EXISTS public.subscription_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- 'activate', 'renew', 'change_plan'
    plan_before TEXT,
    plan_after TEXT NOT NULL,
    period_months INT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for subscription_logs
ALTER TABLE public.subscription_logs ENABLE ROW LEVEL SECURITY;

-- Note: Admin-related table. We assume that if user is owner of the store, they can see their store's subscription logs.
-- If we have a custom claim for system admin, we could restrict writing to only admins, but for now we'll allow store owners to view them.
CREATE POLICY "Store owner can view subscription logs"
    ON public.subscription_logs FOR SELECT
    USING (public.is_store_owner(store_id));

-- Trigger to update updated_at timestamp helper
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_stores_modtime BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE TRIGGER update_cashiers_modtime BEFORE UPDATE ON public.cashiers FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE TRIGGER update_products_modtime BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE TRIGGER update_customers_modtime BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE TRIGGER update_expenses_modtime BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
