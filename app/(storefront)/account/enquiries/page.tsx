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
import { CUSTOMER_EMPTY_MESSAGES, customerEnquiryStatus } from "@/lib/customer/copy";
import { formatOrderDate } from "@/lib/customer/display";
import { enquiryProductLabel, type AdminEnquiryRow } from "@/lib/enquiries/shared";
import { formatEnquiryReference, listOwnEnquiries } from "@/services/enquiries";

export default async function AccountEnquiriesPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!userId) redirect("/login?next=/account/enquiries");

  const enquiries = await listOwnEnquiries(userId);

  return (
    <AccountPageShell>
      <AccountCard>
        <AccountSection
          title="Your enquiries"
          description="View product questions and sales requests you have submitted."
          action={<AccountLink href="/contact">New enquiry</AccountLink>}
        >
          {enquiries.length ? (
            <ul className="grid gap-3">
              {enquiries.map((enquiry) => {
                const enquiryNumber = typeof enquiry.enquiry_number === "number"
                  ? enquiry.enquiry_number
                  : Number(enquiry.enquiry_number);
                const reference = Number.isFinite(enquiryNumber) && enquiryNumber > 0
                  ? formatEnquiryReference(enquiryNumber)
                  : String(enquiry.subject ?? "Enquiry");

                return (
                  <li key={String(enquiry.id)}>
                    <AccountListItem
                      href={`/account/enquiries/${encodeURIComponent(String(enquiry.id))}`}
                      title={reference}
                      subtitle={String(enquiry.subject ?? "")}
                      meta={
                        <div className="space-y-1">
                          <p>Product: {enquiryProductLabel(enquiry as AdminEnquiryRow)}</p>
                          <p>Submitted {formatOrderDate(enquiry.created_at)}</p>
                          <p>Last updated {formatOrderDate(enquiry.updated_at ?? enquiry.created_at)}</p>
                        </div>
                      }
                      badges={
                        <AccountStatusChip
                          label={customerEnquiryStatus(String(enquiry.status ?? "new"))}
                          status={String(enquiry.status ?? "new")}
                        />
                      }
                      actionLabel="View enquiry"
                    />
                  </li>
                );
              })}
            </ul>
          ) : (
            <AccountEmptyState>
              {CUSTOMER_EMPTY_MESSAGES.enquiries}{" "}
              <AccountLink href="/contact">Contact us</AccountLink>
            </AccountEmptyState>
          )}
        </AccountSection>
      </AccountCard>
    </AccountPageShell>
  );
}
