import nodemailer from "nodemailer";

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

function brevoFromHeader() {
  const fromEmail = process.env.BREVO_FROM_EMAIL?.trim();
  const fromName = process.env.BREVO_FROM_NAME?.trim();
  if (!fromEmail) return null;
  return fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;
}

function brevoSmtpCredentials() {
  const login = process.env.BREVO_SMTP_LOGIN?.trim();
  const smtpKey = process.env.BREVO_SMTP_KEY?.trim();
  const apiKey = process.env.BREVO_API_KEY?.trim();

  if (login && smtpKey) {
    return { login, pass: smtpKey };
  }

  if (login && apiKey?.startsWith("xsmtpsib-")) {
    return { login, pass: apiKey };
  }

  return null;
}

function brevoApiKey() {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey || apiKey.startsWith("xsmtpsib-")) return null;
  return apiKey;
}

async function sendViaBrevoApi(payload: EmailPayload) {
  const apiKey = brevoApiKey();
  if (!apiKey) return null;

  const fromEmail = process.env.BREVO_FROM_EMAIL?.trim();
  if (!fromEmail) {
    console.warn("[email] Brevo API key is set but BREVO_FROM_EMAIL is missing; skipping Brevo API send.");
    return { ok: false, skipped: true as const };
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      sender: {
        email: fromEmail,
        ...(process.env.BREVO_FROM_NAME?.trim() ? { name: process.env.BREVO_FROM_NAME.trim() } : {})
      },
      to: [{ email: payload.to }],
      subject: payload.subject,
      htmlContent: payload.html
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Failed to send email via Brevo API: ${response.status}${body ? ` — ${body.slice(0, 200)}` : ""}`);
  }

  return { ok: true, skipped: false as const };
}

async function sendViaBrevoSmtp(payload: EmailPayload) {
  const credentials = brevoSmtpCredentials();
  if (!credentials) return null;

  const from = brevoFromHeader();
  if (!from) {
    console.warn("[email] Brevo SMTP credentials are set but BREVO_FROM_EMAIL is missing; skipping Brevo SMTP send.");
    return { ok: false, skipped: true as const };
  }

  const host = process.env.BREVO_SMTP_HOST?.trim() || "smtp-relay.brevo.com";
  const port = Number(process.env.BREVO_SMTP_PORT ?? 587);
  const connectionUrl = `smtp://${encodeURIComponent(credentials.login)}:${encodeURIComponent(credentials.pass)}@${host}:${port}`;
  const transporter = nodemailer.createTransport(connectionUrl);

  await transporter.sendMail({
    from,
    to: payload.to,
    subject: payload.subject,
    html: payload.html
  });

  return { ok: true, skipped: false as const };
}

async function sendViaResend(payload: EmailPayload) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;

  const from =
    brevoFromHeader()
    ?? process.env.EMAIL_FROM?.trim()
    ?? "Mithron <noreply@mithron.com>";

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
    throw new Error(`Failed to send email via Resend: ${response.status}`);
  }

  return { ok: true, skipped: false as const };
}

export async function sendEmail(payload: EmailPayload) {
  const brevoApiResult = await sendViaBrevoApi(payload);
  if (brevoApiResult) return brevoApiResult;

  const brevoSmtpResult = await sendViaBrevoSmtp(payload);
  if (brevoSmtpResult) return brevoSmtpResult;

  const resendResult = await sendViaResend(payload);
  if (resendResult) return resendResult;

  console.warn("[email] No email provider configured; skipping outbound email.", payload.subject);
  return { ok: false, skipped: true };
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
