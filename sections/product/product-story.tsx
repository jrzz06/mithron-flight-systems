import { MithronResponsiveImage } from "@/components/media/mithron-responsive-image";
import { isSpecLikeBlob } from "@/lib/product-spec-text";
import type { Product } from "@/config/types";

export function ProductStory({ product }: { product: Product }) {
  const chapter = product.story[0] ?? {
    id: "overview",
    kicker: product.category,
    title: product.name,
    body: product.tagline,
    media: product.hero,
    align: "center" as const
  };
  const title = isSpecLikeBlob(chapter.title) ? product.name : chapter.title;
  const body = isSpecLikeBlob(chapter.body) ? product.tagline : chapter.body;
  const showBody = Boolean(body?.trim()) && body !== title;

  return (
    <section id="overview" className="product-story-section border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-6 py-14 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:items-center md:gap-14 md:px-12 md:py-20">
        <div>
          <p className="type-meta text-xs uppercase tracking-[0.14em] text-slate-400">{chapter.kicker}</p>
          <h2 className="mt-3 text-2xl font-semibold leading-snug text-[#0f172a] md:text-3xl">{title}</h2>
          {showBody ? (
            <p className="type-body mt-5 max-w-xl text-base leading-relaxed text-slate-600">{body}</p>
          ) : null}
        </div>

        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-slate-200 bg-[var(--surface-muted)] shadow-[var(--surface-shadow-soft)]">
          <MithronResponsiveImage
            src={chapter.media.src}
            alt={chapter.media.alt}
            fill
            className="object-cover"
            sizes="(min-width:768px) 45vw, 100vw"
          />
        </div>
      </div>
    </section>
  );
}
