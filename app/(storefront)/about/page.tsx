import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AboutPage() {
  return (
    <main className="surface-page min-h-screen px-6 py-28 md:px-16">
      <section className="mx-auto grid max-w-[1180px] gap-10 rounded-[28px] border border-[var(--surface-border)] bg-[var(--surface-card)] p-8 md:grid-cols-[0.9fr_1.1fr] md:p-12">
        <div>
          <p className="type-meta text-slate-500">About Mithron</p>
          <h1 className="type-page mt-4 max-w-2xl">Drone systems for operational teams.</h1>
        </div>
        <div className="grid content-between gap-8">
          <p className="type-subtitle text-slate-600">
            Mithron builds and supplies agriculture, mapping, surveillance, industrial, and media drone systems with a catalog managed from the Supabase-backed admin platform.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/products">
                View catalog
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/contact">Contact team</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
