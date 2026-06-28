"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { isValidCheckoutEmail, isValidCheckoutPhone, isCompleteGuestAddress } from "@/lib/api/checkout-schema";
import { buildGuestRequestHeaders } from "@/lib/api/client-audit-token-client";
import { CUSTOMER_CONTACT_REQUIRED_MESSAGE } from "@/lib/api/customer-contact";
import { isStorefrontGuestOnly } from "@/lib/storefront/guest-demo";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/utils";
import { useCartStore } from "@/store/cart";

type AddressRow = {
  id: string;
  label?: string;
  line1?: string;
  city?: string;
  region?: string;
  postal_code?: string;
  is_default?: boolean;
  is_billing?: boolean;
  is_shipping?: boolean;
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
  fullName: string;
  total: number;
  isSignedIn: boolean;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
    Cashfree?: (config: { mode: "sandbox" | "production" }) => {
      checkout: (options: { paymentSessionId: string; redirectTarget?: string }) => Promise<{ error?: unknown }>;
    };
  }
}

const emptyGuestAddress = (): GuestAddressForm => ({
  label: "Shipping",
  line1: "",
  city: "",
  region: "India",
  postalCode: ""
});

function loadCashfreeScript() {
  return new Promise<boolean>((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }
    if (window.Cashfree) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.async = true;
    script.onload = () => resolve(Boolean(window.Cashfree));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

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
        <p><span className="font-medium text-slate-900">Name:</span> {completed.fullName || "—"}</p>
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
            <p className="font-medium text-slate-900">{formatINR(item.unitPrice * item.quantity)}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4 text-base font-semibold text-slate-900">
        <span>Total</span>
        <span>{formatINR(completed.total)}</span>
      </div>

      <p className="mt-4 text-sm text-slate-600">
        {completed.mode === "payment"
          ? "Payment received. Our team will review your order and confirm it manually before fulfillment begins."
          : "Your enquiry is in our review queue. Our team will contact you using the phone number above."}
      </p>
    </div>
  );
}

export function CheckoutPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const items = useCartStore((state) => state.items);
  const checkout = useCartStore((state) => state.checkout);
  const setCheckoutEmail = useCartStore((state) => state.setCheckoutEmail);
  const setCheckoutRegion = useCartStore((state) => state.setCheckoutRegion);
  const setShippingAddressId = useCartStore((state) => state.setShippingAddressId);
  const setBillingAddressId = useCartStore((state) => state.setBillingAddressId);
  const setCheckoutOrderMeta = useCartStore((state) => state.setCheckoutOrderMeta);
  const subtotal = useCartStore((state) => state.subtotal());
  const taxTotal = useCartStore((state) => state.taxTotal());
  const grandTotal = useCartStore((state) => state.grandTotal());
  const clearCart = useCartStore((state) => state.clearCart);

  const [addresses, setAddresses] = useState<AddressRow[]>([]);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [guestAddress, setGuestAddress] = useState<GuestAddressForm>(emptyGuestAddress);
  const [guestBillingAddress, setGuestBillingAddress] = useState<GuestAddressForm>(() => ({
    ...emptyGuestAddress(),
    label: "Billing"
  }));
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [showManualBillingForm, setShowManualBillingForm] = useState(false);
  const billingAddressId = checkout.billingAddressId ?? "";
  const [loading, setLoading] = useState<"payment" | "enquiry" | "stub" | null>(null);
  const [error, setError] = useState("");
  const [enquiryMessage, setEnquiryMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [completed, setCompleted] = useState<CompletionState | null>(null);
  const [paymentProviders, setPaymentProviders] = useState<string[]>([]);
  const [paymentProvider, setPaymentProvider] = useState("");
  const checkoutIdempotencyKeyRef = useRef<string | null>(null);

  const getCheckoutIdempotencyKey = useCallback(() => {
    if (!checkoutIdempotencyKeyRef.current) {
      checkoutIdempotencyKeyRef.current = crypto.randomUUID();
    }
    return checkoutIdempotencyKeyRef.current;
  }, []);

  const stubOrderId = searchParams.get("order");
  const stubFlag = searchParams.get("stub");

  const shippingAddresses = useMemo(
    () => addresses.filter((address) => address.is_shipping !== false),
    [addresses]
  );
  const billingAddresses = useMemo(
    () => addresses.filter((address) => address.is_billing !== false),
    [addresses]
  );

  const usingSavedAddress = Boolean(isSignedIn && checkout.shippingAddressId && shippingAddresses.length);
  const usingSavedBillingAddress = Boolean(
    isSignedIn
      && !billingSameAsShipping
      && billingAddressId
      && billingAddresses.length
      && !showManualBillingForm
  );

  const cartPayload = useMemo(() => {
    const payload: Record<string, unknown> = {
      email: checkout.email,
      phone: phone.trim(),
      fullName: fullName.trim(),
      region: checkout.region,
      items: items.map((item) => ({ productSlug: item.productSlug, quantity: item.quantity }))
    };

    const companyName = company.trim();
    if (companyName) payload.company = companyName;

    const promoCode = checkout.promoCode.trim();
    if (promoCode) payload.promoCode = promoCode;
    if (paymentProvider) payload.paymentProvider = paymentProvider;

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

    payload.billingSameAsShipping = billingSameAsShipping;
    if (!billingSameAsShipping) {
      if (usingSavedBillingAddress) {
        payload.billingAddressId = billingAddressId;
      } else {
        const trimmedBilling = {
          label: guestBillingAddress.label.trim() || "Billing",
          line1: guestBillingAddress.line1.trim(),
          city: guestBillingAddress.city.trim(),
          region: guestBillingAddress.region.trim(),
          postalCode: guestBillingAddress.postalCode.trim()
        };
        if (
          trimmedBilling.line1
          && trimmedBilling.city
          && trimmedBilling.region
          && trimmedBilling.postalCode
        ) {
          payload.guestBillingAddress = trimmedBilling;
        }
      }
    }

    return payload;
  }, [
    checkout.email,
    checkout.region,
    checkout.shippingAddressId,
    checkout.promoCode,
    phone,
    fullName,
    company,
    items,
    usingSavedAddress,
    usingSavedBillingAddress,
    guestAddress,
    guestBillingAddress,
    billingSameAsShipping,
    billingAddressId,
    paymentProvider
  ]);

  const markComplete = useCallback((
    mode: CompletionMode,
    orderId: string,
    orderNumber: string
  ) => {
    clearCart();
    setCheckoutOrderMeta({ orderId });
    setCompleted({
      mode,
      orderId,
      orderNumber,
      email: checkout.email.trim(),
      phone: phone.trim(),
      fullName: fullName.trim(),
      total: grandTotal,
      isSignedIn
    });
    setError("");
  }, [setCheckoutOrderMeta, checkout.email, phone, fullName, grandTotal, isSignedIn, clearCart]);

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
        const defaultShipping = rows.find((row: AddressRow) => row.is_shipping !== false && row.is_default)
          ?? rows.find((row: AddressRow) => row.is_shipping !== false);
        if (defaultShipping && !checkout.shippingAddressId) {
          setShippingAddressId(defaultShipping.id);
        }
        const defaultBilling = rows.find((row: AddressRow) => row.is_billing !== false && row.is_default)
          ?? rows.find((row: AddressRow) => row.is_billing !== false);
        if (defaultBilling && !checkout.billingAddressId) {
          setBillingAddressId(defaultBilling.id);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
      controller.abort();
    };
  }, [checkout.shippingAddressId, checkout.billingAddressId, setShippingAddressId, setBillingAddressId]);

  useEffect(() => {
    if (billingSameAsShipping && checkout.shippingAddressId) {
      setBillingAddressId(checkout.shippingAddressId);
    }
  }, [billingSameAsShipping, checkout.shippingAddressId, setBillingAddressId]);

  useEffect(() => {
    if (billingSameAsShipping) {
      setShowManualBillingForm(false);
    }
  }, [billingSameAsShipping]);

  useEffect(() => {
    if (
      !billingSameAsShipping
      && isSignedIn
      && billingAddresses.length
      && !billingAddressId
      && !showManualBillingForm
    ) {
      const defaultBilling = billingAddresses.find((address) => address.is_default) ?? billingAddresses[0];
      if (defaultBilling) {
        setBillingAddressId(defaultBilling.id);
      }
    }
  }, [
    billingSameAsShipping,
    isSignedIn,
    billingAddresses,
    billingAddressId,
    showManualBillingForm,
    setBillingAddressId
  ]);

  useEffect(() => {
    let active = true;
    fetch("/api/payments/providers", { cache: "no-store" })
      .then(async (response) => (response.ok ? response.json() : { providers: [] }))
      .then((payload) => {
        if (!active) return;
        const providers = Array.isArray(payload.providers) ? payload.providers.filter((value: unknown) => typeof value === "string") : [];
        setPaymentProviders(providers);
        setPaymentProvider((current) => current || providers[0] || "");
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

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

  const cashfreeReturnOrderId = searchParams.get("order");
  const cashfreeReturnFlag = searchParams.get("cashfree_return");

  useEffect(() => {
    if (!cashfreeReturnOrderId || cashfreeReturnFlag !== "1" || completed) return;

    let active = true;
    (async () => {
      setLoading("payment");
      const paid = await verifyPaymentOnServer({
        orderId: cashfreeReturnOrderId,
        provider: "cashfree",
        email: checkout.email,
        signedIn: isSignedIn,
        cashfreeOrderId: checkout.paymentIntentId ?? undefined
      });
      if (!active) return;
      if (paid) {
        markComplete("payment", cashfreeReturnOrderId, cashfreeReturnOrderId);
        router.replace("/checkout", { scroll: false });
      } else {
        setError("Payment could not be confirmed yet. Please wait a moment and refresh.");
      }
      setLoading(null);
    })();

    return () => {
      active = false;
    };
  }, [cashfreeReturnOrderId, cashfreeReturnFlag, completed, checkout.email, checkout.paymentIntentId, isSignedIn, markComplete, router]);

  function validateBase(requireAddress: boolean) {
    if (!items.length) {
      setError("Your cart is empty.");
      return false;
    }
    if (!fullName.trim()) {
      setError("Full name is required.");
      return false;
    }
    if (fullName.trim().length < 2) {
      setError("Enter your full name.");
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
      if (usingSavedAddress) {
        if (!billingSameAsShipping && !usingSavedBillingAddress && !isCompleteGuestAddress(guestBillingAddress)) {
          setError("Enter a complete billing address.");
          return false;
        }
        return true;
      }
      if (!guestAddress.line1.trim() || !guestAddress.city.trim() || !guestAddress.region.trim() || !guestAddress.postalCode.trim()) {
        setError("Enter a complete shipping address to pay online.");
        return false;
      }
      if (!billingSameAsShipping && !isCompleteGuestAddress(guestBillingAddress)) {
        setError("Enter a complete billing address.");
        return false;
      }
    }
    return true;
  }

  async function waitForCheckoutPaymentConfirmation(input: {
    orderId: string;
    email: string;
    signedIn: boolean;
  }) {
    const guestHeaders = input.signedIn ? null : await buildGuestRequestHeaders();
    if (!input.signedIn && !guestHeaders?.token) return false;

    const query = new URLSearchParams({
      orderId: input.orderId,
      ...(input.signedIn ? {} : { email: input.email })
    });

    for (let attempt = 0; attempt < 15; attempt += 1) {
      const response = await fetch(`/api/checkout/status?${query.toString()}`, {
        headers: input.signedIn ? undefined : (guestHeaders!.headers as Record<string, string>),
        cache: "no-store"
      });
      if (response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (payload.paid) return true;
        if (payload.paymentStatus === "failed" || payload.orderPaymentStatus === "failed") return false;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    return false;
  }

  async function verifyPaymentOnServer(input: {
    orderId: string;
    provider: string;
    email: string;
    signedIn: boolean;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    cashfreeOrderId?: string;
  }) {
    const guestHeaders = input.signedIn ? null : await buildGuestRequestHeaders();
    if (!input.signedIn && !guestHeaders?.token) return false;

    const response = await fetch("/api/payments/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(input.signedIn ? {} : (guestHeaders!.headers as Record<string, string>))
      },
      body: JSON.stringify({
        orderId: input.orderId,
        provider: input.provider,
        email: input.email,
        razorpayOrderId: input.razorpayOrderId,
        razorpayPaymentId: input.razorpayPaymentId,
        razorpaySignature: input.razorpaySignature,
        cashfreeOrderId: input.cashfreeOrderId
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return false;
    if (payload.paid) return true;
    return waitForCheckoutPaymentConfirmation({
      orderId: input.orderId,
      email: input.email,
      signedIn: input.signedIn
    });
  }

  async function openRazorpayCheckout(input: {
    key: string;
    orderId: string;
    orderNumber: string;
    razorpayOrderId: string;
    amount: number;
    email: string;
    signedIn: boolean;
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
        handler: async (response: {
          razorpay_order_id?: string;
          razorpay_payment_id?: string;
          razorpay_signature?: string;
        }) => {
          setLoading("payment");
          const paid = await verifyPaymentOnServer({
            orderId: input.orderId,
            provider: "razorpay",
            email: input.email,
            signedIn: input.signedIn,
            razorpayOrderId: response.razorpay_order_id ?? input.razorpayOrderId,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature
          });
          setLoading(null);
          if (paid) {
            markComplete("payment", input.orderId, input.orderNumber);
            resolve(true);
            return;
          }
          setError("Payment is still processing. Refresh this page shortly or check your email for confirmation.");
          resolve(false);
        },
        modal: {
          ondismiss: () => resolve(false)
        }
      });
      rzp.open();
    });
  }

  async function openCashfreeCheckout(input: {
    orderId: string;
    orderNumber: string;
    paymentSessionId: string;
    cashfreeOrderId: string;
    cashfreeMode: "sandbox" | "production";
    email: string;
    signedIn: boolean;
  }) {
    const loaded = await loadCashfreeScript();
    if (!loaded || !window.Cashfree) {
      setError("Payment gateway failed to load. Please refresh and try again.");
      return false;
    }

    const cashfree = window.Cashfree({ mode: input.cashfreeMode });
    const result = await cashfree.checkout({
      paymentSessionId: input.paymentSessionId,
      redirectTarget: "_modal"
    });

    if (result?.error) {
      return false;
    }

    setLoading("payment");
    const paid = await verifyPaymentOnServer({
      orderId: input.orderId,
      provider: "cashfree",
      email: input.email,
      signedIn: input.signedIn,
      cashfreeOrderId: input.cashfreeOrderId
    });
    setLoading(null);
    if (paid) {
      markComplete("payment", input.orderId, input.orderNumber);
      return true;
    }
    setError("Payment is still processing. Refresh this page shortly or check your email for confirmation.");
    return false;
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

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Idempotency-Key": getCheckoutIdempotencyKey(),
      ...(isSignedIn ? {} : (guestHeaders!.headers as Record<string, string>))
    };

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

    if (payload.provider === "cashfree" && payload.paymentSessionId) {
      const paid = await openCashfreeCheckout({
        orderId: payload.orderId,
        orderNumber,
        paymentSessionId: String(payload.paymentSessionId),
        cashfreeOrderId: String(payload.paymentIntentId),
        cashfreeMode: payload.cashfreeMode === "sandbox" ? "sandbox" : "production",
        email: checkout.email,
        signedIn: isSignedIn
      });
      setLoading(null);
      if (!paid) setError("Payment was not completed.");
      return;
    }

    if (payload.clientSecret && payload.razorpayKeyId) {
      const paid = await openRazorpayCheckout({
        key: payload.razorpayKeyId,
        orderId: payload.orderId,
        orderNumber,
        razorpayOrderId: payload.clientSecret,
        amount: Number(payload.amount ?? grandTotal),
        email: checkout.email,
        signedIn: isSignedIn
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

    const headers: Record<string, string> = isSignedIn
      ? { "Content-Type": "application/json" }
      : { "Content-Type": "application/json", ...(guestHeaders!.headers as Record<string, string>) };

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

    markComplete("enquiry", String(payload.enquiryId ?? ""), String(payload.enquiryReference ?? payload.enquiryId ?? "Enquiry"));
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
                    : `${completed.orderNumber} received. Our team will review your cart and contact ${completed.fullName || "you"} at ${completed.phone}.`}
                </p>

                <CheckoutInvoice completed={completed} items={items} />

                <div className="mt-7 flex flex-wrap gap-3">
                  {completed.mode === "payment" ? (
                    <>
                      {completed.isSignedIn && !isStorefrontGuestOnly() ? (
                        <Button asChild variant="accent">
                          <Link href="/account/orders">View orders</Link>
                        </Button>
                      ) : !isStorefrontGuestOnly() ? (
                        <Button asChild variant="accent">
                          <Link href={`/login?next=${encodeURIComponent("/account/orders")}`}>Create account to track orders</Link>
                        </Button>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {completed.isSignedIn && !isStorefrontGuestOnly() ? (
                        <Button asChild variant="accent">
                          <Link href="/account/enquiries">View my enquiries</Link>
                        </Button>
                      ) : !isStorefrontGuestOnly() ? (
                        <Button asChild variant="accent">
                          <Link href={`/login?next=${encodeURIComponent("/account/enquiries")}`}>Create account to track your enquiry</Link>
                        </Button>
                      ) : null}
                    </>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => {
                      clearCart();
                      setCompleted(null);
                      setEnquiryMessage("");
                      setFullName("");
                      setCompany("");
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
                      <span className="text-sm font-medium text-slate-700">Full name <span className="text-red-600">*</span></span>
                      <input
                        required
                        type="text"
                        autoComplete="name"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        className="type-body h-12 rounded-full border border-slate-200 bg-white px-5 text-[#0f172a] outline-none focus:border-[#1f6b46]"
                        placeholder="Your full name"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-medium text-slate-700">Company</span>
                      <input
                        type="text"
                        autoComplete="organization"
                        value={company}
                        onChange={(event) => setCompany(event.target.value)}
                        className="type-body h-12 rounded-full border border-slate-200 bg-white px-5 text-[#0f172a] outline-none focus:border-[#1f6b46]"
                        placeholder="Optional"
                      />
                    </label>
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

                  {isSignedIn && shippingAddresses.length ? (
                    <div className="grid gap-3">
                      {shippingAddresses.map((address) => (
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

                  <label className="flex items-start gap-3 border-t border-slate-200 pt-4 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={billingSameAsShipping}
                      onChange={(event) => setBillingSameAsShipping(event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-[#1f6b46] focus:ring-[#1f6b46]"
                    />
                    <span>Billing address is the same as shipping address</span>
                  </label>
                </fieldset>

                {!billingSameAsShipping ? (
                <fieldset className="grid gap-4 border-0 p-0">
                  <legend className="type-section mb-1 text-2xl">Billing address</legend>
                  {isSignedIn && billingAddresses.length > 0 ? (
                    <div className="grid gap-3">
                      <p className="text-sm text-slate-500">Select a saved billing address or enter one below.</p>
                      {billingAddresses.map((address) => (
                        <button
                          key={`billing-${address.id}`}
                          type="button"
                          onClick={() => {
                            setBillingAddressId(address.id);
                            setShowManualBillingForm(false);
                          }}
                          className={`rounded-2xl border p-4 text-left transition ${billingAddressId === address.id && !showManualBillingForm ? "border-[#1f6b46] bg-[#f7faf8]" : "border-slate-200 bg-white hover:border-slate-300"}`}
                        >
                          <p className="font-semibold">{address.label ?? "Address"}</p>
                          <p className="mt-1 text-sm text-slate-600">
                            {address.line1}, {address.city}, {address.region} {address.postal_code}
                          </p>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          if (showManualBillingForm) {
                            setShowManualBillingForm(false);
                            const defaultBilling = billingAddresses.find((address) => address.is_default) ?? billingAddresses[0];
                            if (defaultBilling) {
                              setBillingAddressId(defaultBilling.id);
                            }
                          } else {
                            setBillingAddressId("");
                            setShowManualBillingForm(true);
                          }
                        }}
                        className="text-left text-sm font-medium text-[#1f6b46] underline-offset-2 hover:underline"
                      >
                        {showManualBillingForm ? "Use a saved address" : "Enter a different address"}
                      </button>
                      {showManualBillingForm ? (
                        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-sm font-medium text-slate-700">Enter billing address</p>
                          <label className="grid gap-2">
                            <span className="text-sm text-slate-600">Address line</span>
                            <input
                              value={guestBillingAddress.line1}
                              onChange={(event) => setGuestBillingAddress((current) => ({ ...current, line1: event.target.value }))}
                              className="type-body h-11 rounded-xl border border-slate-200 bg-white px-4 text-[#0f172a] outline-none focus:border-[#1f6b46]"
                              placeholder="Street, building, area"
                            />
                          </label>
                          <div className="grid gap-4 md:grid-cols-2">
                            <label className="grid gap-2">
                              <span className="text-sm text-slate-600">City</span>
                              <input
                                value={guestBillingAddress.city}
                                onChange={(event) => setGuestBillingAddress((current) => ({ ...current, city: event.target.value }))}
                                className="type-body h-11 rounded-xl border border-slate-200 bg-white px-4 text-[#0f172a] outline-none focus:border-[#1f6b46]"
                              />
                            </label>
                            <label className="grid gap-2">
                              <span className="text-sm text-slate-600">Postal code</span>
                              <input
                                value={guestBillingAddress.postalCode}
                                onChange={(event) => setGuestBillingAddress((current) => ({ ...current, postalCode: event.target.value }))}
                                className="type-body h-11 rounded-xl border border-slate-200 bg-white px-4 text-[#0f172a] outline-none focus:border-[#1f6b46]"
                              />
                            </label>
                          </div>
                          <label className="grid gap-2">
                            <span className="text-sm text-slate-600">State / region</span>
                            <input
                              value={guestBillingAddress.region}
                              onChange={(event) => setGuestBillingAddress((current) => ({ ...current, region: event.target.value }))}
                              className="type-body h-11 rounded-xl border border-slate-200 bg-white px-4 text-[#0f172a] outline-none focus:border-[#1f6b46]"
                            />
                          </label>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-medium text-slate-700">Enter billing address</p>
                      <label className="grid gap-2">
                        <span className="text-sm text-slate-600">Address line</span>
                        <input
                          value={guestBillingAddress.line1}
                          onChange={(event) => setGuestBillingAddress((current) => ({ ...current, line1: event.target.value }))}
                          className="type-body h-11 rounded-xl border border-slate-200 bg-white px-4 text-[#0f172a] outline-none focus:border-[#1f6b46]"
                          placeholder="Street, building, area"
                        />
                      </label>
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="grid gap-2">
                          <span className="text-sm text-slate-600">City</span>
                          <input
                            value={guestBillingAddress.city}
                            onChange={(event) => setGuestBillingAddress((current) => ({ ...current, city: event.target.value }))}
                            className="type-body h-11 rounded-xl border border-slate-200 bg-white px-4 text-[#0f172a] outline-none focus:border-[#1f6b46]"
                          />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm text-slate-600">Postal code</span>
                          <input
                            value={guestBillingAddress.postalCode}
                            onChange={(event) => setGuestBillingAddress((current) => ({ ...current, postalCode: event.target.value }))}
                            className="type-body h-11 rounded-xl border border-slate-200 bg-white px-4 text-[#0f172a] outline-none focus:border-[#1f6b46]"
                          />
                        </label>
                      </div>
                      <label className="grid gap-2">
                        <span className="text-sm text-slate-600">State / region</span>
                        <input
                          value={guestBillingAddress.region}
                          onChange={(event) => setGuestBillingAddress((current) => ({ ...current, region: event.target.value }))}
                          className="type-body h-11 rounded-xl border border-slate-200 bg-white px-4 text-[#0f172a] outline-none focus:border-[#1f6b46]"
                        />
                      </label>
                    </div>
                  )}
                </fieldset>
                ) : null}

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

                {paymentProviders.length > 1 ? (
                  <fieldset className="grid gap-3 border-0 p-0">
                    <legend className="type-section mb-1 text-2xl">Payment method</legend>
                    <div className="flex flex-wrap gap-3">
                      {paymentProviders.map((provider) => (
                        <label key={provider} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm">
                          <input
                            type="radio"
                            name="paymentProvider"
                            value={provider}
                            checked={paymentProvider === provider}
                            onChange={() => setPaymentProvider(provider)}
                          />
                          <span className="capitalize">{provider}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ) : null}

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
                    <p className="type-price mt-3 font-bold">{formatINR(item.unitPrice * item.quantity)}</p>
                  </div>
                ))}
                <div className="type-price mt-3 grid gap-2 border-t border-white/10 pt-5 text-sm font-medium">
                  <div className="flex items-center justify-between text-white/75">
                    <span>Subtotal</span>
                    <span>{formatINR(subtotal)}</span>
                  </div>
                  {taxTotal > 0 ? (
                    <div className="flex items-center justify-between text-white/75">
                      <span>GST</span>
                      <span>{formatINR(taxTotal)}</span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between text-xl font-bold">
                    <span>Total</span>
                    <span>{formatINR(grandTotal)}</span>
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
