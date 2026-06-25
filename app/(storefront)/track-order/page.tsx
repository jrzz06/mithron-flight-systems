import Link from "next/link";
import { TrackOrderClient } from "@/components/customer/track-order-client";

export const dynamic = "force-dynamic";

export default function TrackOrderPage() {
  return (
    <main className="surface-page min-h-screen px-6 py-28 md:px-16">
      <div className="mx-auto max-w-[820px]">
        <p className="type-meta text-white/50">Order tracking</p>
        <h1 className="type-section mt-2">Track your order</h1>
        <p className="mt-3 max-w-xl text-sm text-white/60">
          Look up status, fulfillment progress, and shipment tracking without signing in.
          {" "}
          <Link href="/account/orders" className="text-emerald-400 hover:underline">Signed in?</Link>
          {" "}
          View orders in your account.
        </p>
        <div className="mt-10">
          <TrackOrderClient />
        </div>
      </div>
    </main>
  );
}
