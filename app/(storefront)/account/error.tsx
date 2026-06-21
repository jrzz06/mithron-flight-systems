"use client";

import Link from "next/link";
import { useEffect } from "react";

type AccountErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AccountError({ error, reset }: AccountErrorProps) {
  useEffect(() => {
    console.error("[mithron-account] Account route render failed.", {
      message: error.message,
      digest: error.digest ?? null
    });
  }, [error]);

  return (
    <main data-account-error-boundary className="min-h-screen bg-[#070B14] px-6 py-10 text-[#F5F7FA]">
      <section className="mx-auto flex min-h-[70vh] max-w-3xl flex-col justify-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2EE6A6]">Account recovery</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">Your account page could not load.</h1>
        <p className="mt-5 max-w-2xl text-sm leading-6 text-[#A7B1C2]">
          Orders and enquiries stayed protected. Retry this view or return to your account overview while we investigate.
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
            href="/account"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-[#F5F7FA] transition-transform duration-150 hover:-translate-y-0.5"
          >
            Back to account
          </Link>
        </div>
      </section>
    </main>
  );
}
