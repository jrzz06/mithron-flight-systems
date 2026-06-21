"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/server";
import { PermissionDeniedError } from "@/lib/auth/permissions";
import { upsertProfileRecord } from "@/services/admin-actions";

async function currentUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!userId) throw new Error("Authentication required.");
  return userId;
}

function selfProfileGuard(expectedUserId: string) {
  return {
    guard: async () => {
      const userId = await currentUserId();
      if (userId !== expectedUserId) {
        throw new PermissionDeniedError("You can only update your own profile.");
      }
    }
  };
}

export async function updateProfileFormAction(formData: FormData) {
  const userId = await currentUserId();
  await upsertProfileRecord(
    {
      id: userId,
      display_name: String(formData.get("display_name") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      updated_at: new Date().toISOString()
    },
    userId,
    process.env,
    selfProfileGuard(userId)
  );
  revalidatePath("/account/profile");
}
