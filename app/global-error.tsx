"use client";

import { useEffect } from "react";
import { recordClientError } from "@/lib/observability";
import "./globals.css";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    recordClientError({
      name: error.name,
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      route: "global"
    });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main data-global-error-boundary className="min-h-screen bg-[#0b0f14] px-6 py-24 text-white">
          <section className="mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center">
            <p className="type-meta text-white/60">Application recovery</p>
            <h1 className="type-page mt-4">Mithron could not start this shell.</h1>
            <p className="type-body mt-5 max-w-xl text-white/68">
              The failure was captured for diagnostics. Retry once; if the shell still fails, use a fresh browser session before deployment continues.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              className="type-button mt-8 inline-flex h-11 w-fit items-center rounded-full bg-white px-5 text-[#0b0f14] transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
