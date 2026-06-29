"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { buildGuestRequestHeaders } from "@/lib/api/client-audit-token-client";
import {
  clearPendingPaymentVerification,
  readPendingPaymentVerification
} from "@/lib/checkout/pending-payment";
import { isStorefrontGuestOnly } from "@/lib/storefront/guest-demo";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/utils";
import { useCartStore } from "@/store/cart";
import styles from "../checkout.module.css";

type SuccessState = {
  orderId: string;
  orderNumber: string;
  total: number;
  email: string;
  isSignedIn: boolean;
};

export function CheckoutSuccessClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clearCart = useCartStore((state) => state.clearCart);

  const orderId = searchParams.get("orderId")?.trim() ?? "";
  const email = searchParams.get("email")?.trim() ?? "";

  const [state, setState] = useState<"loading" | "success" | "pending" | "error">("loading");
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orderId) {
      setState("error");
      setError("Order reference is missing.");
      return;
    }

    let active = true;

    async function confirmFromServer() {
      const pending = readPendingPaymentVerification();
      const guestHeaders = email ? await buildGuestRequestHeaders() : { token: "signed-in", headers: {} as Record<string, string> };

      if (pending && pending.orderId === orderId && pending.razorpayPaymentId && pending.razorpaySignature) {
        const verifyResponse = await fetch("/api/payments/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(email ? guestHeaders.headers : {})
          },
          body: JSON.stringify({
            orderId,
            provider: "razorpay",
            email: pending.email || email,
            razorpayOrderId: pending.razorpayOrderId,
            razorpayPaymentId: pending.razorpayPaymentId,
            razorpaySignature: pending.razorpaySignature
          })
        });
        const verifyPayload = await verifyResponse.json().catch(() => ({}));
        if (!active) return;
        if (verifyResponse.ok && verifyPayload.paid) {
          clearPendingPaymentVerification();
          clearCart();
          setSuccess({
            orderId,
            orderNumber: String(verifyPayload.orderNumber ?? pending.orderNumber ?? orderId),
            total: Number(verifyPayload.amount ?? 0),
            email: pending.email || email,
            isSignedIn: pending.signedIn
          });
          setState("success");
          return;
        }
      }

      const query = new URLSearchParams({ orderId });
      if (email) query.set("email", email);

      for (let attempt = 0; attempt < 12; attempt += 1) {
        const statusResponse = await fetch(`/api/checkout/status?${query.toString()}`, {
          headers: email ? guestHeaders.headers : undefined,
          cache: "no-store"
        });
        const statusPayload = await statusResponse.json().catch(() => ({}));
        if (!active) return;

        if (statusResponse.ok && statusPayload.paid) {
          clearPendingPaymentVerification();
          clearCart();
          setSuccess({
            orderId,
            orderNumber: String(statusPayload.orderNumber ?? orderId),
            total: Number(statusPayload.total ?? 0),
            email,
            isSignedIn: !email
          });
          setState("success");
          return;
        }

        if (statusPayload.paymentStatus === "failed" || statusPayload.orderPaymentStatus === "failed") {
          setState("error");
          setError("Payment failed. Return to checkout to try again.");
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      setState("pending");
      setError("Your payment is being confirmed. You will receive an email once it is verified.");
    }

    void confirmFromServer();
    return () => {
      active = false;
    };
  }, [orderId, email, clearCart]);

  if (state === "loading") {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <p className={styles.pageLead}>Confirming your payment with our server…</p>
        </div>
      </div>
    );
  }

  if (state === "success" && success) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className="py-2">
            <CheckCircle2 className={styles.successIcon} aria-hidden="true" />
            <h1 className={styles.successTitle}>Payment successful</h1>
            <p className={styles.successBody}>
              Order reference {success.orderNumber}. Your payment was verified on our server and your order is confirmed.
            </p>
            {success.total > 0 ? (
              <p className={styles.pageNote}>Amount paid: {formatINR(success.total)}</p>
            ) : null}
            <div className={styles.actions}>
              {success.isSignedIn && !isStorefrontGuestOnly() ? (
                <Button asChild variant="accent">
                  <Link href="/account/orders">View orders</Link>
                </Button>
              ) : !isStorefrontGuestOnly() ? (
                <Button asChild variant="accent">
                  <Link href={`/login?next=${encodeURIComponent("/account/orders")}`}>Create account to track orders</Link>
                </Button>
              ) : null}
              <Button asChild variant="outline">
                <Link href="/">Continue shopping</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.pageTitle}>{state === "pending" ? "Payment confirmation pending" : "Payment not confirmed"}</h1>
        <p className={styles.pageLead}>{error || "We could not confirm your payment yet."}</p>
        <div className={styles.actions}>
          <Button variant="accent" onClick={() => router.push("/checkout")}>
            Return to checkout
          </Button>
        </div>
      </div>
    </div>
  );
}
