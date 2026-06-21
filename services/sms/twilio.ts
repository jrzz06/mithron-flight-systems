export async function sendSms(input: { to: string; body: string }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!accountSid || !authToken || !from) {
    console.warn("[sms] Twilio not configured; skipping SMS.", input.body.slice(0, 40));
    return { ok: false, skipped: true };
  }

  const params = new URLSearchParams({
    To: input.to,
    From: from,
    Body: input.body
  });

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });

  if (!response.ok) {
    throw new Error(`Failed to send SMS: ${response.status}`);
  }

  return { ok: true, skipped: false };
}

export async function sendOrderStatusSms(input: { phone: string; orderNumber: string; status: string }) {
  return sendSms({
    to: input.phone,
    body: `Mithron order ${input.orderNumber} is now ${input.status}.`
  });
}
