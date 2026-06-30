"use client";

import { FileCheck, Headset, ShieldCheck } from "lucide-react";
import { EditorRenderedContent } from "@/components/editor/editor-rendered-content";
import type { TrustCardContent } from "@/services/cms";
import { ProductRevealSection } from "@/sections/product/showcase/product-reveal-section";
import styles from "./product-showcase.module.css";

const DEFAULT_TRUST = [
  { title: "Genuine product", body: "Verified Mithron platform listing with deployment support." },
  { title: "Secure payments", body: "Protected checkout with GST invoice support." },
  { title: "Technical support", body: "Operator guidance and service pathways after purchase." }
] as const;

export function ProductTrustBand({
  trustCards,
  warranty,
  disclaimers
}: {
  trustCards: TrustCardContent[];
  warranty: string;
  disclaimers: string[];
}) {
  const cards = trustCards.length
    ? trustCards.map((card) => ({ title: card.title, body: card.body }))
    : DEFAULT_TRUST.map((item) => ({ title: item.title, body: item.body }));

  return (
    <ProductRevealSection id="trust" className={styles.sectionInk}>
      <div className={styles.inner}>
        <p className={styles.kicker}>Trust</p>
        <h2 className={styles.displayTitle}>Buy with confidence</h2>
        {warranty ? <p className={styles.lead}>{warranty}</p> : null}
        <div className={styles.trustGrid}>
          {cards.map((card) => (
            <article key={card.title} className={styles.trustCard}>
              <ShieldCheck className="mb-3 size-5" aria-hidden="true" />
              <h3 className="text-lg font-semibold">{card.title}</h3>
              <EditorRenderedContent html={card.body} className="mt-2 text-sm leading-relaxed text-slate-300" />
            </article>
          ))}
          <article className={styles.trustCard}>
            <FileCheck className="mb-3 size-5" aria-hidden="true" />
            <h3 className="text-lg font-semibold">GST invoice</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">Business-ready invoicing for procurement teams.</p>
          </article>
          <article className={styles.trustCard}>
            <Headset className="mb-3 size-5" aria-hidden="true" />
            <h3 className="text-lg font-semibold">Service centers</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">Installation assistance and field support pathways.</p>
          </article>
        </div>
        {disclaimers.length ? (
          <details className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4">
            <summary className="cursor-pointer font-medium">Important notes</summary>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-300">
              {disclaimers.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </ProductRevealSection>
  );
}
