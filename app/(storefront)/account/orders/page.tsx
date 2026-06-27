import { redirect } from "next/navigation";
import {
  AccountCard,
  AccountEmptyState,
  AccountLink,
  AccountListItem,
  AccountPage as AccountPageShell,
  AccountSection,
  AccountStatusChip
} from "@/components/account";
import { createClient } from "@/lib/server";
import { CUSTOMER_EMPTY_MESSAGES, customerFulfillmentStatus, customerOrderStatus } from "@/lib/customer/copy";
import { formatItemCount, formatOrderDate, formatOrderReference, orderItemCount } from "@/lib/customer/display";
import { formatINR } from "@/lib/utils";
import { listCustomerOrders } from "@/services/customer-orders";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export default async function AccountOrdersPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!userId) redirect("/login?next=/account/orders");

  const orders = await listCustomerOrders(userId);

  return (
    <AccountPageShell>
      <AccountCard>
        <AccountSection
          title="Your orders"
          description="Track deliveries, view order details, and request returns."
          action={<AccountLink href="/track-order">Track without signing in</AccountLink>}
        >
          {orders.length ? (
            <ul className="grid gap-3">
              {orders.map((order) => (
                <li key={String(order.id)}>
                  <AccountListItem
                    href={`/account/orders/${order.id}`}
                    title={formatOrderReference(order)}
                    subtitle={formatOrderDate(order.created_at)}
                    meta={
                      <div className="space-y-1">
                        <p>{formatINR(Number(order.total ?? 0))}</p>
                        {formatItemCount(orderItemCount(order)) ? (
                          <p>{formatItemCount(orderItemCount(order))}</p>
                        ) : null}
                      </div>
                    }
                    badges={
                      <>
                        <AccountStatusChip
                          label={customerOrderStatus(String(order.status ?? "pending"))}
                          status={String(order.status ?? "pending")}
                        />
                        <AccountStatusChip
                          label={customerFulfillmentStatus(String(order.fulfillment_status ?? "pending"))}
                          status={String(order.fulfillment_status ?? "pending")}
                        />
                      </>
                    }
                  />
                </li>
              ))}
            </ul>
          ) : (
            <AccountEmptyState>
              {CUSTOMER_EMPTY_MESSAGES.orders}{" "}
              <AccountLink href="/checkout">Place your first order</AccountLink>
            </AccountEmptyState>
          )}
        </AccountSection>
      </AccountCard>
    </AccountPageShell>
  );
}
