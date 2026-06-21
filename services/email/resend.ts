type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail(payload: EmailPayload) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Mithron <noreply@mithron.com>";
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not configured; skipping outbound email.", payload.subject);
    return { ok: false, skipped: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to send email: ${response.status}`);
  }

  return { ok: true, skipped: false };
}

export async function dispatchEmailNotification(input: {
  recipientEmail: string;
  title: string;
  body: string;
}) {
  return sendEmail({
    to: input.recipientEmail,
    subject: input.title,
    html: `<p>${input.body}</p>`
  });
}
