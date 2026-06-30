export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { isPaymentGatewayConfigured } = await import("@/services/payments/gateway");
  if (isPaymentGatewayConfigured()) {
    const { assertPaymentEnvironment, logPaymentEnvironmentWarnings } = await import(
      "@/services/payments/env-validation"
    );
    logPaymentEnvironmentWarnings();
    assertPaymentEnvironment();
  }

  if (process.env.NODE_ENV === "production") {
    const { assertProductionRuntimeConfig } = await import("@/lib/env");
    assertProductionRuntimeConfig();
  }
}
