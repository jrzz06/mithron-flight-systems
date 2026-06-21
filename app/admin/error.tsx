"use client";

import Link from "next/link";
import { useEffect } from "react";

type AdminErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AdminError({ error, reset }: AdminErrorProps) {
  useEffect(() => {
    console.error("[mithron-admin] Admin route render failed.", {
      message: error.message || "(empty)",
      name: error.name,
      digest: error.digest ?? null,
      stack: error.stack ?? null,
      raw: String(error)
    });
  }, [error]);

  return (
    <main data-admin-error-boundary className="min-h-screen bg-[#070B14] px-6 py-10 text-[#F5F7FA]">
      <section className="mx-auto flex min-h-[70vh] max-w-3xl flex-col justify-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2EE6A6]">Admin recovery</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">Admin panel could not render this view.</h1>
        <p className="mt-5 max-w-2xl text-sm leading-6 text-[#A7B1C2]">
          The admin shell stayed isolated. Retry this view or return to the dashboard while the failed widget is investigated.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-xl bg-[#2EE6A6] px-4 py-2 text-sm font-semibold text-[#071019] transition-transform duration-150 hover:-translate-y-0.5"
          >
            Try again
          </button>
          <Link
            href="/admin"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-[#F5F7FA] transition-transform duration-150 hover:-translate-y-0.5"
          >
            Back to dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
