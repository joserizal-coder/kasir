'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

// ─── Icons ────────────────────────────────────────────────────────────────────
const icons = {
  success: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

const styles = {
  success: {
    bar: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30',
    icon: 'bg-emerald-500/20 text-emerald-400',
    title: 'text-emerald-400',
    progress: 'bg-emerald-500',
  },
  error: {
    bar: 'from-rose-500/20 to-rose-500/5 border-rose-500/30',
    icon: 'bg-rose-500/20 text-rose-400',
    title: 'text-rose-400',
    progress: 'bg-rose-500',
  },
  warning: {
    bar: 'from-amber-500/20 to-amber-500/5 border-amber-500/30',
    icon: 'bg-amber-500/20 text-amber-400',
    title: 'text-amber-400',
    progress: 'bg-amber-500',
  },
  info: {
    bar: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30',
    icon: 'bg-emerald-500/20 text-emerald-400',
    title: 'text-emerald-400',
    progress: 'bg-emerald-500',
  },
};

// ─── Toast Item ────────────────────────────────────────────────────────────────
function ToastItem({ toast, onRemove }) {
  const s = styles[toast.type] || styles.info;
  return (
    <div
      className={`
        relative flex items-start gap-3 w-80 max-w-[90vw]
        bg-gradient-to-br ${s.bar}
        border backdrop-blur-xl rounded-2xl px-4 py-4 shadow-2xl
        animate-toast-in
        overflow-hidden
      `}
      role="alert"
    >
      {/* Progress bar */}
      <div
        className={`absolute bottom-0 left-0 h-0.5 ${s.progress} rounded-full`}
        style={{
          animation: `toast-progress ${toast.duration}ms linear forwards`,
        }}
      />

      {/* Icon */}
      <div className={`p-1.5 rounded-xl ${s.icon} shrink-0 mt-0.5`}>
        {icons[toast.type]}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className={`font-bold text-sm ${s.title} leading-snug`}>{toast.title}</p>
        )}
        {toast.message && (
          <p className="text-slate-300 text-xs mt-0.5 leading-relaxed">{toast.message}</p>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={() => onRemove(toast.id)}
        className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors p-0.5 rounded-lg hover:bg-white/5"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ─── Confirm Dialog ────────────────────────────────────────────────────────────
function ConfirmDialog({ dialog, onConfirm, onCancel }) {
  if (!dialog) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1c1716] border border-[#2c2524] w-full max-w-sm rounded-3xl shadow-2xl p-7 space-y-5 animate-toast-in">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
        </div>

        {/* Text */}
        <div className="text-center space-y-1.5">
          {dialog.title && (
            <h3 className="font-extrabold text-lg text-slate-100">{dialog.title}</h3>
          )}
          <p className="text-slate-400 text-sm leading-relaxed">{dialog.message}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-all"
          >
            {dialog.cancelLabel || 'Batal'}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-2xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-sm shadow-lg shadow-rose-500/20 transition-all"
          >
            {dialog.confirmLabel || 'Ya, Lanjutkan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Context ───────────────────────────────────────────────────────────────────
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirm, setConfirm] = useState(null);
  const confirmResolveRef = useRef(null);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((type, titleOrMessage, message, duration = 4000) => {
    const id = Date.now() + Math.random();
    let title = null;
    let msg = null;
    if (message !== undefined) {
      title = titleOrMessage;
      msg = message;
    } else {
      msg = titleOrMessage;
    }
    const entry = { id, type, title, message: msg, duration };
    setToasts((prev) => [...prev.slice(-4), entry]); // max 5 toasts
    setTimeout(() => removeToast(id), duration);
  }, [removeToast]);

  const showConfirm = useCallback(({ title, message, confirmLabel, cancelLabel } = {}) => {
    return new Promise((resolve) => {
      confirmResolveRef.current = resolve;
      setConfirm({ title, message, confirmLabel, cancelLabel });
    });
  }, []);

  const handleConfirm = () => {
    setConfirm(null);
    confirmResolveRef.current?.(true);
  };
  const handleCancel = () => {
    setConfirm(null);
    confirmResolveRef.current?.(false);
  };

  return (
    <ToastContext.Provider value={{ toast, showConfirm }}>
      {children}

      {/* Toast Container */}
      <div className="fixed top-5 right-5 z-[9998] flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onRemove={removeToast} />
          </div>
        ))}
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog dialog={confirm} onConfirm={handleConfirm} onCancel={handleCancel} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  const { toast, showConfirm } = ctx;
  return {
    success: (title, message, duration) => toast('success', title, message, duration),
    error: (title, message, duration) => toast('error', title, message, duration),
    warning: (title, message, duration) => toast('warning', title, message, duration),
    info: (title, message, duration) => toast('info', title, message, duration),
    confirm: showConfirm,
  };
}
