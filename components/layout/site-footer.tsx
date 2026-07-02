import Link from "next/link";
import { EditorRenderedHtml } from "@/components/editor/editor-rendered-html";
import { isCmsStrictMode } from "@/lib/cms/strict-mode";
import { footerContent, type FooterContent } from "@/config/storefront-content";
import { footerOfficialLinks } from "@/config/footer-links";

const emptyFooterContent: FooterContent = {
  leadTitle: "",
  leadBody: "",
  columns: [],
  legalText: ""
};

function withFooterLeadDefaults(content: FooterContent): FooterContent {
  if (isCmsStrictMode()) return content;
  return {
    leadTitle: content.leadTitle || footerContent.leadTitle,
    leadBody: content.leadBody || footerContent.leadBody,
    contactEmail: content.contactEmail || footerContent.contactEmail,
    contactPhone: content.contactPhone || footerContent.contactPhone,
    legalText: content.legalText || footerContent.legalText,
    columns: content.columns.length ? content.columns : footerContent.columns
  };
}

function isExternalHref(href: string) {
  return href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:") || href.startsWith("tel:");
}

function FooterLink({ label, href }: { label: string; href: string }) {
  const className = "site-footer__link inline-flex min-h-11 items-center py-2 transition-colors hover:text-white focus-visible:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70";

  if (isExternalHref(href)) {
    return (
      <a href={href} className={className} target="_blank" rel="noopener noreferrer">
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}

export function SiteFooter({ content = emptyFooterContent }: { content?: FooterContent }) {
  const resolved = withFooterLeadDefaults(content);
  const contactEmail = resolved.contactEmail ?? footerOfficialLinks.contactEmail;
  const contactPhone = resolved.contactPhone ?? footerOfficialLinks.contactPhone;
  const phoneHref = contactPhone.replace(/[^\d+]/g, "");

  return (
    <footer className="site-footer ambient-section ambient-dark bg-[var(--ds-footer-bg)] pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white" data-testid="site-footer">
      <div className="site-footer__inner mx-auto grid max-w-[1440px] gap-6 px-6 py-12 max-[767px]:grid-cols-1 max-[767px]:gap-4 max-[767px]:px-4 max-[767px]:py-10 md:grid-cols-2 md:gap-10 md:px-16 lg:grid-cols-3 xl:grid-cols-[minmax(0,1.15fr)_repeat(4,minmax(0,1fr))]">
        <div className="site-footer__lead xl:col-span-1">
          <p className="type-meta text-white/45">Mithron India Smart Services</p>
          <h2 className="type-section mt-3 text-3xl text-balance max-[767px]:text-2xl md:text-4xl">{resolved.leadTitle}</h2>
          <EditorRenderedHtml html={resolved.leadBody} className="type-body mt-4 max-w-xl text-base leading-relaxed text-white/68 max-[767px]:text-base" />
          <div className="site-footer__contact mt-6 flex flex-col gap-2 text-sm text-white/72">
            <a href={`mailto:${contactEmail}`} className="site-footer__link inline-flex min-h-11 w-fit items-center py-2 transition-colors hover:text-white">
              {contactEmail}
            </a>
            <a href={`tel:${phoneHref}`} className="site-footer__link inline-flex min-h-11 w-fit items-center py-2 transition-colors hover:text-white">
              {contactPhone}
            </a>
            <Link href="/contact" className="site-footer__link inline-flex min-h-11 w-fit items-center py-2 text-white/88 transition-colors hover:text-white">
              Contact Mithron
            </Link>
          </div>
        </div>
        {resolved.columns.map((column) => (
          <div key={column.title} className="site-footer__column min-w-0">
            <h3 className="type-meta mb-4 text-white/45">{column.title}</h3>
            <div className="type-body flex flex-col gap-2 text-sm text-white/72">
              {column.links.map(([label, href]) => (
                <FooterLink key={`${column.title}-${label}`} label={label} href={href} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="type-technical mx-auto max-w-prose border-t border-white/10 px-6 py-5 text-center text-xs leading-relaxed text-white/45 max-[767px]:flex max-[767px]:flex-col max-[767px]:gap-2 max-[767px]:px-4">
        {resolved.legalText}
      </div>
    </footer>
  );
}
