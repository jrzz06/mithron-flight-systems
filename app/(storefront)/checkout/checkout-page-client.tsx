"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { isValidCheckoutEmail, isValidCheckoutPhone } from "@/lib/api/checkout-schema";
import { buildGuestRequestHeaders } from "@/lib/api/client-audit-token-client";
import { CUSTOMER_CONTACT_REQUIRED_MESSAGE } from "@/lib/api/customer-contact";
import { isStorefrontGuestOnly } from "@/lib/storefront/guest-demo";
import { Button } from "@/components/ui/button";
import { formatUsd } from "@/lib/utils";
import { useCartStore } from "@/store/cart";

type AddressRow = {
  id: string;
  label?: string;
  line1?: string;
  city?: string;
  region?: string;
  postal_code?: string;
};

type GuestAddressForm = {
  label: string;
  line1: string;
  city: string;
  region: string;
  postalCode: string;
};

type CompletionMode = "payment" | "enquiry";

type CompletionState = {
  mode: CompletionMode;
  orderId: string;
  orderNumber: string;
  email: string;
  phone: string;
  total: number;
  isSignedIn: boolean;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const emptyGuestAddress = (): GuestAddressForm => ({
  label: "Shipping",
  line1: "",
  city: "",
  region: "India",
  postalCode: ""
});

function loadRazorpayScript() {
  return new Promise<boolean>((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

async function completeStubPayment(intentId: string, amount: number) {
  const response = await fetch("/api/payments/webhooks/stub", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      intentId,
      amount,
      currency: "INR",
      paymentId: `stub_pay_${Date.now()}`
    })
  });
  return response.ok;
}

function CheckoutInvoice({
  completed,
  items
}: {
  completed: CompletionState;
  items: Array<{ productName: string; bundleName: string; quantity: number; unitPrice: number }>;
}) {
  const issuedAt = new Date().toLocaleString();

  return (
    <div className="mt-8 rounded-[24px] border border-slate-200 bg-slate-50 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Invoice</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{completed.orderNumber}</p>
        </div>
        <div className="text-right text-sm text-slate-600">
          <p>{issuedAt}</p>
          <p className="mt-1">{completed.mode === "payment" ? "Paid" : "Enquiry"}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-slate-700">
        <p><span className="font-medium text-slate-900">Email:</span> {completed.email}</p>
        <p><span className="font-medium text-slate-900">Phone:</span> {completed.phone}</p>
      </div>

      <div className="mt-5 grid gap-3">
        {items.map((item) => (
          <div key={`${item.productName}-${item.bundleName}`} className="flex items-start justify-between gap-4 text-sm">
            <div>
              <p className="font-medium text-slate-900">{item.productName}</p>
              <p className="text-slate-600">{item.bundleName} x {item.quantity}</p>
            </div>
            <p className="font-medium text-slate-900">{formatUsd(item.unitPrice * item.quantity)}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4 text-base font-semibold text-slate-900">
        <span>Total</span>
        <span>{formatUsd(completed.total)}</span>
      </div>

      <p className="mt-4 text-sm text-slate-600">
        {completed.mode === "payment"
          ? "Payment received. Our team will review your order and confirm it manually before fulfillment begins."
          : "Your enquiry is in our review queue. Our team will contact you using the phone number above."}
      </p>
    </div>
  );
}

export function CheckoutPageClient({ auditToken }: { auditToken?: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const items = useCartStore((state) => state.items);
  const checkout = useCartStore((state) => state.checkout);
  const setCheckoutEmail = useCartStore((state) => state.setCheckoutEmail);
  const setCheckoutRegion = useCartStore((state) => state.setCheckoutRegion);
  const setShippingAddressId = useCartStore((state) => state.setShippingAddressId);
  const setCheckoutOrderMeta = useCartStore((state) => state.setCheckoutOrderMeta);
  const subtotal = useCartStore((state) => state.subtotal());
  const taxTotal = useCartStore((state) => state.taxTotal());
  const grandTotal = useCartStore((state) => state.grandTotal());
  const clearCart = useCartStore((state) => state.clearCart);

  const [addresses, setAddresses] = useState<AddressRow[]>([]);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [guestAddress, setGuestAddress] = useState<GuestAddressForm>(emptyGuestAddress);
  const [loading, setLoading] = useState<"payment" | "enquiry" | "stub" | null>(null);
  const [error, setError] = useState("");
  const [enquiryMessage, setEnquiryMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [completed, setCompleted] = useState<CompletionState | null>(null);

  const stubOrderId = searchParams.get("order");
  const stubFlag = searchParams.get("stub");

  const usingSavedAddress = Boolean(isSignedIn && checkout.shippingAddressId && addresses.length);

  const cartPayload = useMemo(() => {
    const payload: Record<string, unknown> = {
      email: checkout.email,
      phone: phone.trim(),
      region: checkout.region,
      items: items.map((item) => ({ productSlug: item.productSlug, quantity: item.quantity }))
    };

    if (usingSavedAddress) {
      payload.addressId = checkout.shippingAddressId;
    } else {
      const trimmed = {
        label: guestAddress.label.trim() || "Shipping",
        line1: guestAddress.line1.trim(),
        city: guestAddress.city.trim(),
        region: guestAddress.region.trim(),
        postalCode: guestAddress.postalCode.trim()
      };
      if (trimmed.line1 && trimmed.city && trimmed.region && trimmed.postalCode) {
        payload.guestAddress = trimmed;
      }
    }

    return payload;
  }, [checkout.email, checkout.region, checkout.shippingAddressId, phone, items, usingSavedAddress, guestAddress]);

  const markComplete = useCallback((
    mode: CompletionMode,
    orderId: string,
    orderNumber: string
  ) => {
    setCheckoutOrderMeta({ orderId });
    setCompleted({
      mode,
      orderId,
      orderNumber,
      email: checkout.email.trim(),
      phone: phone.trim(),
      total: grandTotal,
      isSignedIn
    });
    setError("");
  }, [setCheckoutOrderMeta, checkout.email, phone, grandTotal, isSignedIn]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    fetch("/api/account/addresses", { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          if (active) {
            setIsSignedIn(false);
            setAddresses([]);
          }
          return { addresses: [] };
        }
        if (active) setIsSignedIn(true);
        return response.ok ? response.json() : { addresses: [] };
      })
      .then((payload) => {
        if (!active) return;
        const rows = Array.isArray(payload.addresses) ? payload.addresses : [];
        setAddresses(rows);
        if (rows.length === 1 && !checkout.shippingAddressId) {
          setShippingAddressId(rows[0].id);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
      controller.abort();
    };
  }, [checkout.shippingAddressId, setShippingAddressId]);

  useEffect(() => {
    if (!stubOrderId || stubFlag !== "1" || completed) return;

    let active = true;

    (async () => {
      setLoading("stub");
      const intentId = checkout.paymentIntentId ?? `stub_intent_${stubOrderId}`;
      const ok = await completeStubPayment(intentId, grandTotal);
      if (!active) return;
      if (ok) {
        markComplete("payment", stubOrderId, stubOrderId);
        router.replace("/checkout", { scroll: false });
      } else {
        setError("Test payment could not be confirmed. Please try again.");
      }
      setLoading(null);
    })();

    return () => {
      active = false;
    };
  }, [stubOrderId, stubFlag, completed, checkout.paymentIntentId, grandTotal, markComplete, router]);

  function validateBase(requireAddress: boolean) {
    if (!items.length) {
      setError("Your cart is empty.");
      return false;
    }
    if (!checkout.email.trim()) {
      setError("Email is required.");
      return false;
    }
    if (!isValidCheckoutEmail(checkout.email.trim())) {
      setError("Enter a valid email address.");
      return false;
    }
    if (!phone.trim()) {
      setError("Phone number is required.");
      return false;
    }
    if (!isValidCheckoutPhone(phone.trim())) {
      setError("Enter a valid phone number (8–15 digits).");
      return false;
    }
    if (requireAddress) {
      if (usingSavedAddress) return true;
      if (!guestAddress.line1.trim() || !guestAddress.city.trim() || !guestAddress.region.trim() || !guestAddress.postalCode.trim()) {
        setError("Enter a complete shipping address to pay online.");
        return false;
      }
    }
    return true;
  }

  async function openRazorpayCheckout(input: {
    key: string;
    orderId: string;
    orderNumber: string;
    razorpayOrderId: string;
    amount: number;
    email: string;
  }) {
    const loaded = await loadRazorpayScript();
    if (!loaded || !window.Razorpay) {
      setError("Payment gateway failed to load. Please refresh and try again.");
      return false;
    }

    return new Promise<boolean>((resolve) => {
      const rzp = new window.Razorpay!({
        key: input.key,
        amount: Math.round(input.amount * 100),
        currency: "INR",
        name: "Mithron",
        description: `Order ${input.orderNumber}`,
        order_id: input.razorpayOrderId,
        prefill: { email: input.email, contact: phone.trim() },
        theme: { color: "#174d33" },
        handler: () => {
          markComplete("payment", input.orderId, input.orderNumber);
          resolve(true);
        },
        modal: {
          ondismiss: () => resolve(false)
        }
      });
      rzp.open();
    });
  }

  async function placeOrder() {
    if (!validateBase(true)) return;

    setLoading("payment");
    setError("");

    const guestHeaders = isSignedIn ? null : await buildGuestRequestHeaders();
    if (!isSignedIn && !guestHeaders?.token) {
      setError("Unable to verify this browser session. Refresh the page and try again.");
      setLoading(null);
      return;
    }

    const headers = isSignedIn
      ? { "Content-Type": "application/json" }
      : guestHeaders!.headers;

    const response = await fetch("/api/checkout", {
      method: "POST",
      headers,
      body: JSON.stringify(cartPayload)
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(typeof payload.error === "string" ? payload.error : "Checkout failed.");
      setLoading(null);
      return;
    }

    const orderNumber = String(payload.orderNumber ?? payload.orderId);
    setCheckoutOrderMeta({ orderId: payload.orderId, paymentIntentId: payload.paymentIntentId });

    if (payload.checkoutUrl) {
      window.location.href = payload.checkoutUrl;
      return;
    }

    if (payload.clientSecret && payload.razorpayKeyId) {
      const paid = await openRazorpayCheckout({
        key: payload.razorpayKeyId,
        orderId: payload.orderId,
        orderNumber,
        razorpayOrderId: payload.clientSecret,
        amount: Number(payload.amount ?? grandTotal),
        email: checkout.email
      });
      setLoading(null);
      if (!paid) setError("Payment was not completed.");
      return;
    }

    markComplete("payment", payload.orderId, orderNumber);
    setLoading(null);
  }

  async function sendEnquiry() {
    if (!validateBase(false)) return;
    if (!enquiryMessage.trim()) {
      setError("Add a short message about what you need help with.");
      return;
    }

    setLoading("enquiry");
    setError("");

    const guestHeaders = isSignedIn ? null : await buildGuestRequestHeaders();
    if (!isSignedIn && !guestHeaders?.token) {
      setError("Unable to verify this browser session. Refresh the page and try again.");
      setLoading(null);
      return;
    }

    const headers = isSignedIn
      ? { "Content-Type": "application/json" }
      : guestHeaders!.headers;

    const response = await fetch("/api/checkout/enquiry", {
      method: "POST",
      headers,
      body: JSON.stringify({ ...cartPayload, message: enquiryMessage.trim() })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(typeof payload.error === "string" ? payload.error : "Could not send enquiry.");
      setLoading(null);
      return;
    }

    markComplete("enquiry", payload.orderId, String(payload.orderNumber ?? payload.orderId));
    setLoading(null);
  }

  return (
    <div className="checkout-page surface-section-cool min-h-screen px-6 py-20 md:px-16">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-10">
          <p className="type-meta text-slate-500">Checkout</p>
          <h1 className="type-page mt-2 text-5xl">Complete your order</h1>
          <p className="type-body mt-3 max-w-2xl text-slate-600">
            Checkout with or without an account. Email and phone are required for every order and enquiry.
            Paid orders receive an invoice and are manually confirmed by our team.
          </p>
          {!isSignedIn && !isStorefrontGuestOnly() ? (
            <p className="type-body mt-2 text-sm text-slate-500">
              Already have an account?{" "}
              <Link href={`/login?next=${encodeURIComponent("/checkout")}`} className="font-medium text-[#1f6b46] underline-offset-2 hover:underline">
                Sign in
              </Link>{" "}
              to use saved addresses.
            </p>
          ) : null}
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_390px]">
          <section className="checkout-panel rounded-[28px] border border-[var(--surface-border)] bg-white p-7 shadow-sm md:p-9">
            {completed ? (
              <div className="py-4">
                <CheckCircle2 className="mb-5 size-12 text-[#1f6b46]" />
                <h2 className="type-section text-3xl">
                  {completed.mode === "payment" ? "Payment received" : "Enquiry sent"}
                </h2>
                <p className="type-body mt-3 text-slate-600">
                  {completed.mode === "payment"
                    ? `Reference ${completed.orderNumber}. Save this invoice for your records.`
                    : `Reference ${completed.orderNumber}. Our team will review your cart and contact you on ${completed.phone}.`}
                </p>

                <CheckoutInvoice completed={completed} items={items} />

                <div className="mt-7 flex flex-wrap gap-3">
                  {completed.isSignedIn && !isStorefrontGuestOnly() ? (
                    <Button asChild variant="accent">
                      <Link href="/account/orders">View orders</Link>
                    </Button>
                  ) : !isStorefrontGuestOnly() ? (
                    <Button asChild variant="accent">
                      <Link href={`/login?next=${encodeURIComponent("/account/orders")}`}>Create account to track orders</Link>
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    onClick={() => {
                      clearCart();
                      setCompleted(null);
                      setEnquiryMessage("");
                      setGuestAddress(emptyGuestAddress());
                    }}
                  >
                    Start new order
                  </Button>
                </div>
              </div>
            ) : (
              <form
                className="grid gap-8"
                onSubmit={(event) => {
                  event.preventDefault();
                  void placeOrder();
                }}
              >
                <fieldset className="grid gap-4 border-0 p-0">
                  <legend className="type-section mb-1 text-2xl">Contact</legend>
                  <p className="text-sm text-slate-500">{CUSTOMER_CONTACT_REQUIRED_MESSAGE}</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-sm font-medium text-slate-700">Email <span className="text-red-600">*</span></span>
                      <input
                        required
                        type="email"
                        autoComplete="email"
                        value={checkout.email}
                        onChange={(event) => setCheckoutEmail(event.target.value)}
                        className="type-body h-12 rounded-full border border-slate-200 bg-white px-5 text-[#0f172a] outline-none focus:border-[#1f6b46]"
                        placeholder="you@company.com"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-medium text-slate-700">Phone <span className="text-red-600">*</span></span>
                      <input
                        required
                        type="tel"
                        autoComplete="tel"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        className="type-body h-12 rounded-full border border-slate-200 bg-white px-5 text-[#0f172a] outline-none focus:border-[#1f6b46]"
                        placeholder="+91 98765 43210"
                      />
                    </label>
                  </div>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700">Region</span>
                    <input
                      value={checkout.region}
                      onChange={(event) => setCheckoutRegion(event.target.value)}
                      className="type-body h-12 rounded-full border border-slate-200 bg-white px-5 text-[#0f172a] outline-none focus:border-[#1f6b46]"
                      placeholder="India"
                    />
                  </label>
                </fieldset>

                <fieldset className="grid gap-4 border-0 p-0">
                  <legend className="type-section mb-1 text-2xl">Shipping address</legend>
                  <p className="text-sm text-slate-500">Required for online payment. Optional for product enquiries.</p>

                  {isSignedIn && addresses.length ? (
                    <div className="grid gap-3">
                      {addresses.map((address) => (
                        <button
                          key={address.id}
                          type="button"
                          onClick={() => setShippingAddressId(address.id)}
                          className={`rounded-2xl border p-4 text-left transition ${checkout.shippingAddressId === address.id ? "border-[#1f6b46] bg-[#f7faf8]" : "border-slate-200 bg-white hover:border-slate-300"}`}
                        >
                          <p className="font-semibold">{address.label ?? "Address"}</p>
                          <p className="mt-1 text-sm text-slate-600">
                            {address.line1}, {address.city}, {address.region} {address.postal_code}
                          </p>
                        </button>
                      ))}
                      <Button asChild variant="outline" type="button">
                        <Link href="/account/addresses">Manage saved addresses</Link>
                      </Button>
                    </div>
                  ) : null}

                  {!usingSavedAddress ? (
                    <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-medium text-slate-700">
                        {isSignedIn ? "Or enter a shipping address" : "Enter shipping address"}
                      </p>
                      <label className="grid gap-2">
                        <span className="text-sm text-slate-600">Address line</span>
                        <input
                          value={guestAddress.line1}
                          onChange={(event) => setGuestAddress((current) => ({ ...current, line1: event.target.value }))}
                          className="type-body h-11 rounded-xl border border-slate-200 bg-white px-4 text-[#0f172a] outline-none focus:border-[#1f6b46]"
                          placeholder="Street, building, area"
                        />
                      </label>
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="grid gap-2">
                          <span className="text-sm text-slate-600">City</span>
                          <input
                            value={guestAddress.city}
                            onChange={(event) => setGuestAddress((current) => ({ ...current, city: event.target.value }))}
                            className="type-body h-11 rounded-xl border border-slate-200 bg-white px-4 text-[#0f172a] outline-none focus:border-[#1f6b46]"
                          />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm text-slate-600">Postal code</span>
                          <input
                            value={guestAddress.postalCode}
                            onChange={(event) => setGuestAddress((current) => ({ ...current, postalCode: event.target.value }))}
                            className="type-body h-11 rounded-xl border border-slate-200 bg-white px-4 text-[#0f172a] outline-none focus:border-[#1f6b46]"
                          />
                        </label>
                      </div>
                      <label className="grid gap-2">
                        <span className="text-sm text-slate-600">State / region</span>
                        <input
                          value={guestAddress.region}
                          onChange={(event) => setGuestAddress((current) => ({ ...current, region: event.target.value }))}
                          className="type-body h-11 rounded-xl border border-slate-200 bg-white px-4 text-[#0f172a] outline-none focus:border-[#1f6b46]"
                        />
                      </label>
                    </div>
                  ) : null}
                </fieldset>

                <fieldset className="grid gap-4 border-0 p-0">
                  <legend className="type-section mb-1 text-2xl">Product enquiry</legend>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700">Message (for enquiry only)</span>
                    <textarea
                      value={enquiryMessage}
                      onChange={(event) => setEnquiryMessage(event.target.value)}
                      rows={4}
                      className="type-body rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[#0f172a] outline-none focus:border-[#1f6b46]"
                      placeholder="Tell us about your mission, quantity, certification needs, or delivery timeline..."
                    />
                  </label>
                </fieldset>

                {error ? <p className="text-sm text-red-600">{error}</p> : null}

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Button type="submit" variant="accent" disabled={Boolean(loading) || !items.length}>
                    {loading === "payment" || loading === "stub" ? "Processing..." : "Pay & place order"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={Boolean(loading) || !items.length}
                    onClick={() => void sendEnquiry()}
                  >
                    {loading === "enquiry" ? "Sending..." : "Send product enquiry"}
                  </Button>
                </div>
              </form>
            )}
          </section>

          <aside className="checkout-summary h-fit rounded-[28px] bg-[#0f172a] p-7 text-white shadow-[0_24px_56px_rgba(15,23,42,0.18)]">
            <h2 className="type-card-title text-2xl">Order summary</h2>
            {items.length ? (
              <div className="mt-5 flex flex-col gap-4">
                {items.map((item) => (
                  <div key={`${item.productSlug}-${item.bundleId}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="type-card-title text-base">{item.productName}</p>
                    <p className="type-body mt-1 text-sm text-white/55">
                      {item.bundleName} x {item.quantity}
                    </p>
                    <p className="type-price mt-3 font-bold">{formatUsd(item.unitPrice * item.quantity)}</p>
                  </div>
                ))}
                <div className="type-price mt-3 grid gap-2 border-t border-white/10 pt-5 text-sm font-medium">
                  <div className="flex items-center justify-between text-white/75">
                    <span>Subtotal</span>
                    <span>{formatUsd(subtotal)}</span>
                  </div>
                  {taxTotal > 0 ? (
                    <div className="flex items-center justify-between text-white/75">
                      <span>GST</span>
                      <span>{formatUsd(taxTotal)}</span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between text-xl font-bold">
                    <span>Total</span>
                    <span>{formatUsd(grandTotal)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-5 text-white/65">
                No items in cart.{" "}
                <Link href="/products" className="text-emerald-300 underline-offset-2 hover:underline">
                  Browse products
                </Link>
              </p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
