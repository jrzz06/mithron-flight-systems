import Link from "next/link";
import { Button } from "@/components/ui/button";
import { isCmsStrictMode } from "@/lib/cms/strict-mode";
import { footerContent, type FooterContent } from "@/config/storefront-content";

const emptyFooterContent: FooterContent = {
  leadTitle: "",
  leadBody: "",
  emailPlaceholder: "",
  ctaLabel: "",
  columns: [],
  legalText: ""
};

function withFooterLeadDefaults(content: FooterContent): FooterContent {
  if (isCmsStrictMode()) return content;
  return {
    leadTitle: content.leadTitle || footerContent.leadTitle,
    leadBody: content.leadBody || footerContent.leadBody,
    emailPlaceholder: content.emailPlaceholder || footerContent.emailPlaceholder,
    ctaLabel: content.ctaLabel || footerContent.ctaLabel,
    legalText: content.legalText || footerContent.legalText,
    columns: content.columns
  };
}

export function SiteFooter({ content = emptyFooterContent }: { content?: FooterContent }) {
  const resolved = withFooterLeadDefaults(content);

  return (
    <footer className="site-footer ambient-section ambient-dark bg-[#0c0d10] text-white">
      <div className="site-footer__inner mx-auto grid max-w-[1440px] gap-10 px-6 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:px-16">
        <div className="site-footer__lead">
          <h2 className="type-section text-4xl">{resolved.leadTitle}</h2>
          <p className="type-body mt-3 max-w-md text-white/60">{resolved.leadBody}</p>
          <form action="/contact" method="get" className="site-footer__form ambient-surface mt-7 flex max-w-md gap-3 rounded-full border border-white/10 bg-white/8 p-1.5">
            <label className="sr-only" htmlFor="footer-email">Email address</label>
            <input
              id="footer-email"
              name="email"
              type="email"
              autoComplete="email"
              aria-label="Email address"
              className="type-body h-12 min-w-0 flex-1 rounded-full border border-white/15 bg-white/8 px-5 text-sm outline-none placeholder:text-white/35 focus:border-white/40"
              placeholder={resolved.emailPlaceholder}
            />
            <Button variant="accent" type="submit">{resolved.ctaLabel}</Button>
          </form>
        </div>
        {resolved.columns.map((column) => (
          <div key={column.title} className="site-footer__column">
            <h3 className="type-meta mb-4 text-white/45">{column.title}</h3>
            <div className="type-body flex flex-col gap-3 text-sm text-white/72">
              {column.links.map(([label, href]) => (
                <Link key={label} href={href} className="hover:text-white">
                  {label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="type-technical border-t border-white/10 px-6 py-5 text-center text-xs text-white/45">
        {resolved.legalText}
      </div>
    </footer>
  );
}
