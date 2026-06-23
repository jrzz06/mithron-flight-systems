import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EnquiryForm } from "@/components/contact/enquiry-form";
import { createClient } from "@/lib/server";

const contactCards = [
  { label: "Sales", value: "sales@mithron.com", icon: Mail },
  { label: "Operations", value: "Request a callback", icon: Phone },
  { label: "Coverage", value: "India field deployments", icon: MapPin }
];

export default async function ContactPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims?.email === "string" ? data.claims.email : "";
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  return (
    <main className="surface-page inner-page min-h-screen">
      <section className="mx-auto max-w-[1180px]">
        <p className="type-meta text-slate-500">Contact</p>
        <div className="mt-4 grid gap-8 md:grid-cols-[0.95fr_1.05fr]">
          <div>
            <h1 className="type-page max-w-2xl">Talk to Mithron.</h1>
            <p className="type-subtitle mt-6 max-w-2xl text-slate-600">
              Submit a deployment enquiry and our team will follow up with product fit, pricing, and rollout guidance.
            </p>
            <Button asChild className="mt-8">
              <Link href="/products">Browse systems</Link>
            </Button>
            <div className="mt-8 grid gap-3">
              {contactCards.map(({ label, value, icon: Icon }) => (
                <article key={label} className="flex items-center gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-card)] p-5">
                  <span className="grid size-11 place-items-center rounded-full bg-black text-white">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <div>
                    <p className="type-meta text-slate-500">{label}</p>
                    <p className="mt-1 text-base font-semibold text-[#0f172a]">{value}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
          <EnquiryForm defaultEmail={email} isGuest={!userId} />
        </div>
      </section>
    </main>
  );
}
