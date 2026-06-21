import { SignupForm } from "@/app/signup/signup-form";

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;

  return (
    <main className="min-h-screen bg-[#050608] px-6 py-10 text-white md:px-10">
      <section className="mx-auto max-w-xl rounded-[28px] border border-white/10 bg-[#080b0f]/[0.045] p-7 shadow-[0_40px_120px_rgba(0,0,0,.45)] md:p-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7ce7c9]">Invite acceptance</p>
        <h1 className="mt-4 font-[var(--type-display)] text-4xl font-semibold tracking-[-0.04em]">Join Mithron control</h1>
        <p className="mt-4 text-sm leading-7 text-white/58">This invite token is passed to Supabase user metadata for server-side role assignment after approval.</p>
        <SignupForm inviteToken={token} />
      </section>
    </main>
  );
}
