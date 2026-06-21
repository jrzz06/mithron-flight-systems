import { Cloud, Download, ShieldCheck, Sparkles } from "lucide-react";
import { heroAssets } from "@/config/assets";
import { CatalogPage } from "@/sections/catalog/catalog-page";
import { getFeaturedProducts } from "@/services/catalog";

export default async function MithronCarePlusPage() {
  const products = await getFeaturedProducts();

  return (
    <div className="surface-page">
      <CatalogPage
        title="Mithron Care+"
        subtitle="Training, maintenance, flight support, and mission-service value positioned as a premium ecosystem layer."
        products={products.slice(0, 4)}
        heroImage={heroAssets.ag10Command}
      />
      <section className="mx-auto grid max-w-[1440px] gap-4 px-6 pb-16 md:grid-cols-4 md:px-16">
        {[
          [Cloud, "Mission data archive"],
          [Download, "Fast field reporting"],
          [Sparkles, "Operator-first training"],
          [ShieldCheck, "Protected fleet support"]
        ].map(([Icon, title]) => (
          <div key={String(title)} className="ambient-surface ambient-dark rounded-2xl border border-[var(--surface-border)] p-8">
            <Icon className="mb-8 size-8" />
            <h2 className="type-card-title text-xl">{String(title)}</h2>
          </div>
        ))}
      </section>
    </div>
  );
}
