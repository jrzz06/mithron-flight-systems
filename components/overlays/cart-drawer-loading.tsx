import { Loader2 } from "lucide-react";

export function CartDrawerLoading() {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-stretch justify-end bg-black/40 backdrop-blur-[2px]"
      role="status"
      aria-busy="true"
      aria-label="Opening cart"
      data-testid="cart-drawer-loading"
    >
      <div className="flex h-full w-full max-w-md flex-col items-center justify-center gap-3 border-l border-[var(--surface-border)] bg-[var(--surface-card)] px-6">
        <Loader2 className="h-6 w-6 animate-spin text-white/70" aria-hidden="true" />
        <p className="text-sm text-white/60">Loading cart…</p>
      </div>
      <span className="sr-only">Loading cart drawer.</span>
    </div>
  );
}
