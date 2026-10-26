"use client";

// Small shared UI helpers used across pages.

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    verified: { cls: "badge-green", label: "Verified" },
    verified_current: { cls: "badge-green", label: "Verified current" },
    unofficial: { cls: "badge-amber", label: "Unofficial source" },
    official_unconfirmed: { cls: "badge-amber", label: "Official · status unconfirmed" },
    estimated: { cls: "badge-amber", label: "Estimated" },
    estimated_window: { cls: "badge-amber", label: "Estimated window" },
    historical: { cls: "badge-slate", label: "Historical" },
    generic_guidance: { cls: "badge-slate", label: "Generic guidance" },
    missing: { cls: "badge-red", label: "Missing" },
    no_information: { cls: "badge-red", label: "No reliable information" },
    sample: { cls: "badge-indigo", label: "Sample data" },
  };
  const b = map[status] ?? { cls: "badge-slate", label: status };
  return <span className={b.cls}>{b.label}</span>;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-slate-500">
      <svg className="h-4 w-4 animate-spin text-indigo-600" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {label ?? "Loading…"}
    </span>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 p-8 text-center">
      <p className="section-title">{title}</p>
      <p className="max-w-md text-sm text-slate-500">{body}</p>
      {action}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>{message}</span>
        {onRetry && <button onClick={onRetry} className="btn-secondary px-3 py-1">Retry</button>}
      </div>
    </div>
  );
}

export function Toast({ toast }: { toast: string | null }) {
  if (!toast) return null;
  return (
    <div role="status" aria-live="polite"
      className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
      {toast}
    </div>
  );
}
