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
import { CheckoutOrderSummary } from "@/components/checkout/checkout-order-summary";
import { cn, formatINR } from "@/lib/utils";
import { useCartStore } from "@/store/cart";
import styles from "./checkout.module.css";

function formatPaymentProviderLabel(provider: string) {
  if (provider === "razorpay") return "Razorpay";
  if (provider === "cashfree") return "Cashfree";
  if (provider === "stub") return "Payment gateway";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function formatPaymentProviderHint(provider: string) {
  if (provider === "razorpay") return "Cards, UPI, net banking, and wallets";
  if (provider === "cashfree") return "Cards, UPI, and bank transfers";
  return "Secure online payment";
}

function readCheckoutErrorMessage(response: Response, payload: Record<string, unknown>) {
  if (typeof payload.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }
  if (response.status === 401) return "Session verification failed. Refresh the page and try again.";
  if (response.status === 409) return "One or more items are unavailable.";
  if (response.status === 503) return "Payment service is temporarily unavailable.";
  if (response.status === 429) return "Too many attempts. Wait a moment and try again.";
  return `Checkout failed (${response.status}). Please try again.`;
}

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
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: Record<string, unknown>) => void) => void;
    };
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
    <div className={styles.invoiceCard}>
      <div className={styles.invoiceHeader}>
        <div>
          <p className={styles.invoiceLabel}>Tax invoice</p>
          <p className={styles.invoiceNumber}>{completed.orderNumber}</p>
        </div>
        <div className={styles.invoiceMeta}>
          <p>{issuedAt}</p>
          <p>{completed.mode === "payment" ? "Payment received" : "Enquiry submitted"}</p>
        </div>
      </div>

      <div className={styles.invoiceContact}>
        <p><strong>Name:</strong> {completed.fullName || "—"}</p>
        <p><strong>Email:</strong> {completed.email}</p>
        <p><strong>Phone:</strong> {completed.phone}</p>
      </div>

      <div className={styles.invoiceItems}>
        {items.map((item) => (
          <div key={`${item.productName}-${item.bundleName}`} className={styles.invoiceItem}>
            <div>
              <p className={styles.invoiceItemName}>{item.productName}</p>
              <p className={styles.invoiceItemMeta}>{item.bundleName} × {item.quantity}</p>
            </div>
            <p className={styles.invoiceItemName}>{formatINR(item.unitPrice * item.quantity)}</p>
          </div>
        ))}
      </div>

      <div className={styles.invoiceTotal}>
        <span>Total payable</span>
        <span>{formatINR(completed.total)}</span>
      </div>

      <p className={styles.invoiceFootnote}>
        {completed.mode === "payment"
          ? "Your payment has been received. Our team will verify the order and share dispatch updates by email and phone."
          : "Your enquiry has been received. Our team will contact you using the details above."}
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

  const shippingDestination = useMemo(() => {
    if (usingSavedAddress) {
      const address = shippingAddresses.find((entry) => entry.id === checkout.shippingAddressId);
      if (!address) return null;
      return {
        line1: address.line1,
        city: address.city,
        region: address.region,
        postalCode: address.postal_code,
        ...(address.label && address.label.toLowerCase() !== "shipping" ? { label: address.label } : {})
      };
    }

    const trimmedLine1 = guestAddress.line1.trim();
    const trimmedCity = guestAddress.city.trim();
    const trimmedRegion = guestAddress.region.trim();
    const trimmedPostal = guestAddress.postalCode.trim();
    if (!trimmedLine1 || !trimmedCity || !trimmedPostal) {
      return null;
    }

    return {
      line1: trimmedLine1,
      city: trimmedCity,
      region: trimmedRegion,
      postalCode: trimmedPostal
    };
  }, [
    usingSavedAddress,
    shippingAddresses,
    checkout.shippingAddressId,
    guestAddress
  ]);
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
        setError("Payment could not be confirmed. Please try again.");
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
      const verification = await verifyPaymentOnServer({
        orderId: cashfreeReturnOrderId,
        provider: "cashfree",
        email: checkout.email,
        signedIn: isSignedIn,
        cashfreeOrderId: checkout.paymentIntentId ?? undefined
      });
      if (!active) return;
      if (verification.paid) {
        markComplete("payment", cashfreeReturnOrderId, cashfreeReturnOrderId);
        router.replace("/checkout", { scroll: false });
      } else {
        setError(verification.error ?? "Payment could not be confirmed yet. Please wait a moment and refresh.");
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
  }): Promise<{ paid: boolean; error?: string }> {
    const guestHeaders = input.signedIn ? null : await buildGuestRequestHeaders();
    if (!input.signedIn && !guestHeaders?.token) {
      return { paid: false, error: "Unable to verify this browser session. Refresh the page and try again." };
    }

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
    if (!response.ok) {
      return {
        paid: false,
        error: typeof payload.error === "string" ? payload.error : "Payment verification failed."
      };
    }
    if (payload.paid) return { paid: true };
    const confirmed = await waitForCheckoutPaymentConfirmation({
      orderId: input.orderId,
      email: input.email,
      signedIn: input.signedIn
    });
    if (confirmed) return { paid: true };
    return {
      paid: false,
      error: typeof payload.error === "string"
        ? payload.error
        : "Payment is still processing. Refresh this page shortly or check your email for confirmation."
    };
  }

  async function openRazorpayCheckout(input: {
    key: string;
    orderId: string;
    orderNumber: string;
    razorpayOrderId: string;
    amountPaise: number;
    email: string;
    signedIn: boolean;
  }) {
    const loaded = await loadRazorpayScript();
    if (!loaded || !window.Razorpay) {
      setError("Payment gateway failed to load. Please refresh and try again.");
      return false;
    }

    if (!input.amountPaise || input.amountPaise < 100) {
      setError("Order total must be at least ₹1 to pay online.");
      return false;
    }

    return new Promise<boolean>((resolve) => {
      const rzp = new window.Razorpay!({
        key: input.key,
        amount: input.amountPaise,
        currency: "INR",
        name: "Mithron",
        description: `Order ${input.orderNumber}`,
        order_id: input.razorpayOrderId,
        prefill: { email: input.email, contact: phone.trim() },
        theme: { color: "#174d33", backdrop_color: "#f7faf8" },
        retry: { enabled: true, max_count: 3 },
        handler: async (response: {
          razorpay_order_id?: string;
          razorpay_payment_id?: string;
          razorpay_signature?: string;
        }) => {
          setLoading("payment");
          const verification = await verifyPaymentOnServer({
            orderId: input.orderId,
            provider: "razorpay",
            email: input.email,
            signedIn: input.signedIn,
            razorpayOrderId: response.razorpay_order_id ?? input.razorpayOrderId,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature
          });
          setLoading(null);
          if (verification.paid) {
            markComplete("payment", input.orderId, input.orderNumber);
            resolve(true);
            return;
          }
          setError(verification.error ?? "Payment is still processing. Refresh this page shortly or check your email for confirmation.");
          resolve(false);
        },
        modal: {
          confirm_close: true,
          ondismiss: () => resolve(false)
        }
      });

      rzp.on("payment.failed", (response) => {
        const reason = typeof response.error === "object" && response.error && "description" in response.error
          ? String((response.error as { description?: string }).description ?? "")
          : "";
        setError(reason.trim() || "Payment failed. Try another method or refresh and try again.");
        resolve(false);
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
      setError("Cashfree checkout was interrupted. Please try again.");
      return false;
    }

    setLoading("payment");
    const verification = await verifyPaymentOnServer({
      orderId: input.orderId,
      provider: "cashfree",
      email: input.email,
      signedIn: input.signedIn,
      cashfreeOrderId: input.cashfreeOrderId
    });
    setLoading(null);
    if (verification.paid) {
      markComplete("payment", input.orderId, input.orderNumber);
      return true;
    }
    setError(verification.error ?? "Payment is still processing. Refresh this page shortly or check your email for confirmation.");
    return false;
  }

  async function placeOrder() {
    if (!validateBase(true)) return;
    if (!paymentProvider && paymentProviders.length) {
      setError("Choose a payment method to continue.");
      return;
    }

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
      setError(readCheckoutErrorMessage(response, payload));
      setLoading(null);
      return;
    }

    const orderNumber = String(payload.orderNumber ?? payload.orderId);
    setCheckoutOrderMeta({ orderId: payload.orderId, paymentIntentId: payload.paymentIntentId });

    if (payload.checkoutUrl) {
      window.location.href = payload.checkoutUrl;
      return;
    }

    if (payload.provider === "razorpay") {
      if (!payload.clientSecret || !payload.razorpayKeyId) {
        setError("Razorpay checkout could not be started. Please try again or choose another payment method.");
        setLoading(null);
        return;
      }
      const paid = await openRazorpayCheckout({
        key: payload.razorpayKeyId,
        orderId: payload.orderId,
        orderNumber,
        razorpayOrderId: payload.clientSecret,
        amountPaise: Number(payload.amountPaise ?? Math.round(Number(payload.amount ?? 0) * 100)),
        email: checkout.email,
        signedIn: isSignedIn
      });
      setLoading(null);
      if (!paid) setError("Payment was not completed.");
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

    if (payload.provider === "cashfree") {
      setError("Cashfree checkout could not be started. Please try again or choose another payment method.");
      setLoading(null);
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

  const checkoutBusy = Boolean(loading);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.pageHeader}>
          <p className={styles.eyebrow}>Checkout</p>
          <h1 className={styles.pageTitle}>Complete your purchase</h1>
          <p className={styles.pageLead}>
            Provide your contact and delivery details to place your order securely. A GST invoice is issued for every paid order.
          </p>
          {!isSignedIn && !isStorefrontGuestOnly() ? (
            <p className={styles.pageNote}>
              Already have an account?{" "}
              <Link href={`/login?next=${encodeURIComponent("/checkout")}`}>
                Sign in
              </Link>{" "}
              to use saved addresses and order history.
            </p>
          ) : null}
        </header>

        <div className={styles.layout}>
          <section className={styles.formPanel}>
            {completed ? (
              <div className="py-2">
                <CheckCircle2 className={styles.successIcon} aria-hidden="true" />
                <h2 className={styles.successTitle}>
                  {completed.mode === "payment" ? "Payment received" : "Enquiry submitted"}
                </h2>
                <p className={styles.successBody}>
                  {completed.mode === "payment"
                    ? `Order reference ${completed.orderNumber}. Keep this invoice for your records and tax filing.`
                    : `Reference ${completed.orderNumber}. Our team will review your request and contact ${completed.fullName || "you"} at ${completed.phone}.`}
                </p>

                <CheckoutInvoice completed={completed} items={items} />

                <div className={styles.actions}>
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
                className={styles.form}
                onSubmit={(event) => {
                  event.preventDefault();
                  void placeOrder();
                }}
              >
                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>Contact information</legend>
                  <p className={styles.fieldHint}>{CUSTOMER_CONTACT_REQUIRED_MESSAGE}</p>
                  <div className={cn(styles.fieldGrid, styles.fieldGridTwo)}>
                    <label className={styles.field}>
                      <span className={styles.label}>Full name <span className={styles.required}>*</span></span>
                      <input
                        required
                        type="text"
                        autoComplete="name"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        className={styles.input}
                      />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>Company</span>
                      <input
                        type="text"
                        autoComplete="organization"
                        value={company}
                        onChange={(event) => setCompany(event.target.value)}
                        className={styles.input}
                      />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>Email <span className={styles.required}>*</span></span>
                      <input
                        required
                        type="email"
                        autoComplete="email"
                        value={checkout.email}
                        onChange={(event) => setCheckoutEmail(event.target.value)}
                        className={styles.input}
                      />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>Phone <span className={styles.required}>*</span></span>
                      <input
                        required
                        type="tel"
                        autoComplete="tel"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        className={styles.input}
                      />
                    </label>
                  </div>
                  <label className={styles.field}>
                    <span className={styles.label}>Country / region</span>
                    <input
                      value={checkout.region}
                      onChange={(event) => setCheckoutRegion(event.target.value)}
                      className={styles.input}
                    />
                  </label>
                </fieldset>

                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>Shipping address</legend>
                  <p className={styles.fieldHint}>Required for online payment. Optional when submitting a product enquiry.</p>

                  {isSignedIn && shippingAddresses.length ? (
                    <div className={styles.fieldGrid}>
                      {shippingAddresses.map((address) => (
                        <button
                          key={address.id}
                          type="button"
                          onClick={() => setShippingAddressId(address.id)}
                          className={cn(
                            styles.addressCard,
                            checkout.shippingAddressId === address.id && styles.addressCardSelected
                          )}
                        >
                          <p className={styles.addressCardTitle}>{address.label ?? "Address"}</p>
                          <p className={styles.addressCardBody}>
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
                    <div className={styles.addressForm}>
                      <p className={styles.label}>
                        {isSignedIn ? "Enter a shipping address" : "Shipping address"}
                      </p>
                      <label className={styles.field}>
                        <span className={styles.label}>Address line</span>
                        <input
                          value={guestAddress.line1}
                          onChange={(event) => setGuestAddress((current) => ({ ...current, line1: event.target.value }))}
                          className={styles.input}
                          autoComplete="street-address"
                        />
                      </label>
                      <div className={cn(styles.fieldGrid, styles.fieldGridTwo)}>
                        <label className={styles.field}>
                          <span className={styles.label}>City</span>
                          <input
                            value={guestAddress.city}
                            onChange={(event) => setGuestAddress((current) => ({ ...current, city: event.target.value }))}
                            className={styles.input}
                            autoComplete="address-level2"
                          />
                        </label>
                        <label className={styles.field}>
                          <span className={styles.label}>Postal code</span>
                          <input
                            value={guestAddress.postalCode}
                            onChange={(event) => setGuestAddress((current) => ({ ...current, postalCode: event.target.value }))}
                            className={styles.input}
                            autoComplete="postal-code"
                          />
                        </label>
                      </div>
                      <label className={styles.field}>
                        <span className={styles.label}>State / region</span>
                        <input
                          value={guestAddress.region}
                          onChange={(event) => setGuestAddress((current) => ({ ...current, region: event.target.value }))}
                          className={styles.input}
                          autoComplete="address-level1"
                        />
                      </label>
                    </div>
                  ) : null}

                  <label className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={billingSameAsShipping}
                      onChange={(event) => setBillingSameAsShipping(event.target.checked)}
                      className={styles.checkbox}
                    />
                    <span>Billing address is the same as shipping address</span>
                  </label>
                </fieldset>

                {!billingSameAsShipping ? (
                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>Billing address</legend>
                  {isSignedIn && billingAddresses.length > 0 ? (
                    <div className={styles.fieldGrid}>
                      <p className={styles.fieldHint}>Select a saved billing address or enter a new one.</p>
                      {billingAddresses.map((address) => (
                        <button
                          key={`billing-${address.id}`}
                          type="button"
                          onClick={() => {
                            setBillingAddressId(address.id);
                            setShowManualBillingForm(false);
                          }}
                          className={cn(
                            styles.addressCard,
                            billingAddressId === address.id && !showManualBillingForm && styles.addressCardSelected
                          )}
                        >
                          <p className={styles.addressCardTitle}>{address.label ?? "Address"}</p>
                          <p className={styles.addressCardBody}>
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
                        className={styles.textLink}
                      >
                        {showManualBillingForm ? "Use a saved address" : "Enter a different address"}
                      </button>
                      {showManualBillingForm ? (
                        <div className={styles.addressForm}>
                          <p className={styles.label}>Billing address</p>
                          <label className={styles.field}>
                            <span className={styles.label}>Address line</span>
                            <input
                              value={guestBillingAddress.line1}
                              onChange={(event) => setGuestBillingAddress((current) => ({ ...current, line1: event.target.value }))}
                              className={styles.input}
                              autoComplete="billing street-address"
                            />
                          </label>
                          <div className={cn(styles.fieldGrid, styles.fieldGridTwo)}>
                            <label className={styles.field}>
                              <span className={styles.label}>City</span>
                              <input
                                value={guestBillingAddress.city}
                                onChange={(event) => setGuestBillingAddress((current) => ({ ...current, city: event.target.value }))}
                                className={styles.input}
                                autoComplete="billing address-level2"
                              />
                            </label>
                            <label className={styles.field}>
                              <span className={styles.label}>Postal code</span>
                              <input
                                value={guestBillingAddress.postalCode}
                                onChange={(event) => setGuestBillingAddress((current) => ({ ...current, postalCode: event.target.value }))}
                                className={styles.input}
                                autoComplete="billing postal-code"
                              />
                            </label>
                          </div>
                          <label className={styles.field}>
                            <span className={styles.label}>State / region</span>
                            <input
                              value={guestBillingAddress.region}
                              onChange={(event) => setGuestBillingAddress((current) => ({ ...current, region: event.target.value }))}
                              className={styles.input}
                              autoComplete="billing address-level1"
                            />
                          </label>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className={styles.addressForm}>
                      <p className={styles.label}>Billing address</p>
                      <label className={styles.field}>
                        <span className={styles.label}>Address line</span>
                        <input
                          value={guestBillingAddress.line1}
                          onChange={(event) => setGuestBillingAddress((current) => ({ ...current, line1: event.target.value }))}
                          className={styles.input}
                          autoComplete="billing street-address"
                        />
                      </label>
                      <div className={cn(styles.fieldGrid, styles.fieldGridTwo)}>
                        <label className={styles.field}>
                          <span className={styles.label}>City</span>
                          <input
                            value={guestBillingAddress.city}
                            onChange={(event) => setGuestBillingAddress((current) => ({ ...current, city: event.target.value }))}
                            className={styles.input}
                            autoComplete="billing address-level2"
                          />
                        </label>
                        <label className={styles.field}>
                          <span className={styles.label}>Postal code</span>
                          <input
                            value={guestBillingAddress.postalCode}
                            onChange={(event) => setGuestBillingAddress((current) => ({ ...current, postalCode: event.target.value }))}
                            className={styles.input}
                            autoComplete="billing postal-code"
                          />
                        </label>
                      </div>
                      <label className={styles.field}>
                        <span className={styles.label}>State / region</span>
                        <input
                          value={guestBillingAddress.region}
                          onChange={(event) => setGuestBillingAddress((current) => ({ ...current, region: event.target.value }))}
                          className={styles.input}
                          autoComplete="billing address-level1"
                        />
                      </label>
                    </div>
                  )}
                </fieldset>
                ) : null}

                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>Product enquiry</legend>
                  <label className={styles.field}>
                    <span className={styles.label}>Message</span>
                    <textarea
                      value={enquiryMessage}
                      onChange={(event) => setEnquiryMessage(event.target.value)}
                      rows={4}
                      className={styles.textarea}
                      placeholder="Share quantity requirements, certification needs, delivery timeline, or technical questions."
                    />
                  </label>
                </fieldset>

                {error ? <p className={styles.error} role="alert">{error}</p> : null}

                {paymentProviders.length > 0 ? (
                  <fieldset className={styles.fieldset}>
                    <legend className={styles.legend}>Payment method</legend>
                    <p className={styles.paymentLead}>Choose how you would like to pay. You will complete payment in a secure gateway window.</p>
                    <div className={styles.paymentOptions}>
                      {paymentProviders.map((provider) => (
                        <label
                          key={provider}
                          className={cn(styles.paymentOption, paymentProvider === provider && styles.paymentOptionSelected)}
                        >
                          <input
                            type="radio"
                            name="paymentProvider"
                            value={provider}
                            checked={paymentProvider === provider}
                            onChange={() => setPaymentProvider(provider)}
                            className={styles.paymentOptionInput}
                          />
                          <span className={styles.paymentOptionBody}>
                            <span className={styles.paymentOptionTitle}>{formatPaymentProviderLabel(provider)}</span>
                            <span className={styles.paymentOptionHint}>{formatPaymentProviderHint(provider)}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ) : null}

                <div className={styles.actions}>
                  <Button type="submit" variant="accent" disabled={checkoutBusy || !items.length}>
                    {loading === "payment" || loading === "stub"
                      ? "Processing payment..."
                      : "Pay and place order"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={checkoutBusy || !items.length}
                    onClick={() => void sendEnquiry()}
                  >
                    {loading === "enquiry" ? "Submitting enquiry..." : "Submit product enquiry"}
                  </Button>
                </div>
              </form>
            )}
          </section>

          {!completed ? (
            <div className={styles.summarySlot}>
              <CheckoutOrderSummary
                paymentProvider={paymentProvider}
                promoCode={checkout.promoCode}
                shippingDestination={shippingDestination}
                checkoutBusy={checkoutBusy}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
