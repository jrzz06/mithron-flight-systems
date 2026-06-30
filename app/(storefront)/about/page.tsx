import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditorRenderedContent } from "@/components/editor/editor-rendered-content";
import { getPublicCmsSnapshot } from "@/services/cms";

export default async function AboutPage() {
  const cms = await getPublicCmsSnapshot();
  const title = cms.footer.leadTitle?.trim() || "Drone systems for operational teams.";
  const body = cms.footer.leadBody?.trim()
    || "Mithron builds and supplies agriculture, mapping, surveillance, industrial, and media drone systems with a catalog managed from the Supabase-backed admin platform.";
  const trustCards = cms.trustCards?.slice(0, 3) ?? [];

  return (
    <main className="surface-page inner-page min-h-screen">
      <section className="mx-auto grid max-w-[1180px] gap-10 rounded-[var(--ds-r-xl)] border border-[var(--surface-border)] bg-[var(--surface-card)] p-8 md:grid-cols-[0.9fr_1.1fr] md:p-12">
        <div>
          <p className="type-meta text-slate-500">About Mithron</p>
          <h1 className="type-page mt-4 max-w-2xl">{title}</h1>
        </div>
        <div className="grid content-between gap-8">
          <EditorRenderedContent html={body} className="type-subtitle text-slate-600" />
          {trustCards.length ? (
            <div className="grid gap-3">
              {trustCards.map((card) => (
                <article key={card.id} className="rounded-2xl border border-[var(--surface-border)] bg-white/60 p-4">
                  <p className="text-sm font-semibold text-slate-900">{card.title}</p>
                  {card.body ? (
                    <EditorRenderedContent html={card.body} className="mt-2 text-sm leading-6 text-slate-600" />
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}
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
