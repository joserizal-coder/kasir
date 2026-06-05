import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase URL or Service Role Key in Server API");
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

// GET: Fetch all stores and subscription logs bypassing RLS
export async function GET(request) {
  try {
    // 1. Verify token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token or user' }, { status: 401 });
    }

    const { data: stores, error: storesError } = await supabaseAdmin
      .from('stores')
      .select('*')
      .order('created_at', { ascending: false });

    if (storesError) throw storesError;

    const { data: logs, error: logsError } = await supabaseAdmin
      .from('subscription_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (logsError) throw logsError;

    return NextResponse.json({ stores, logs });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Manage subscriptions (activate, renew, change plan)
export async function POST(request) {
  try {
    // 1. Verify token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token or user' }, { status: 401 });
    }

    const body = await request.json();
    const { storeId, action, plan, months, notes, adminId } = body;

    // Get current store info
    const { data: store, error: fetchError } = await supabaseAdmin
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single();

    if (fetchError) throw fetchError;

    let updateData = {};
    if (action === 'update_limit') {
      const currentSettings = store.settings || {};
      const newSettings = {
        ...currentSettings,
        max_monthly_transactions: parseInt(body.maxTransactions) || 50
      };
      updateData = {
        settings: newSettings,
        updated_at: new Date().toISOString()
      };
    } else {
      let newStart = store.subscription_start ? new Date(store.subscription_start) : new Date();
      let newEnd;

      if (action === 'activate') {
        newStart = new Date();
        newEnd = new Date();
        newEnd.setMonth(newEnd.getMonth() + parseInt(months));
      } else if (action === 'renew') {
        // Extend based on current end date if it is in the future, otherwise from today
        const currentEnd = store.subscription_end ? new Date(store.subscription_end) : new Date();
        const baseDate = currentEnd > new Date() ? currentEnd : new Date();
        newEnd = new Date(baseDate);
        newEnd.setMonth(newEnd.getMonth() + parseInt(months));
      } else if (action === 'change_plan') {
        // Just change plan, keep end date
        newEnd = store.subscription_end ? new Date(store.subscription_end) : null;
      }

      updateData = {
        plan: plan || store.plan,
        subscription_start: newStart.toISOString(),
        subscription_end: newEnd ? newEnd.toISOString() : null,
        updated_at: new Date().toISOString()
      };
    }

    // Update store info
    const { error: updateError } = await supabaseAdmin
      .from('stores')
      .update(updateData)
      .eq('id', storeId);

    if (updateError) throw updateError;

    // Log the event to subscription_logs
    const { error: logError } = await supabaseAdmin
      .from('subscription_logs')
      .insert({
        store_id: storeId,
        admin_id: adminId || null,
        action,
        plan_before: store.plan,
        plan_after: plan || store.plan,
        period_months: months ? parseInt(months) : null,
        notes: notes || `Tindakan admin: ${action}`
      });

    if (logError) throw logError;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
