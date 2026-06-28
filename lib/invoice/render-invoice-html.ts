import { formatINR } from "@/lib/utils";
import type { InvoiceData } from "./types";

function addressBlock(lines: string[]) {
  return lines.map((line) => `<div>${escapeHtml(line)}</div>`).join("");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function invoiceDocumentStyles() {
  return `
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; background: #eef0f3; }
    .invoice-shell { max-width: 920px; margin: 24px auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
    .invoice-toolbar { padding: 16px 24px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
    .print-btn { padding: 9px 24px; background: #0f172a; color: #fff; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; }
    .invoice-body { padding: 28px 32px 36px; }
    .invoice-header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; }
    .brand { display: flex; gap: 14px; align-items: center; }
    .brand img { width: 44px; height: 44px; }
    .brand h1 { margin: 0; font-size: 22px; }
    .brand p { margin: 4px 0 0; color: #64748b; font-size: 13px; }
    .invoice-meta { text-align: right; font-size: 13px; color: #334155; }
    .invoice-meta strong { display: block; font-size: 18px; color: #0f172a; margin-bottom: 8px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 24px; }
    .panel { border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; background: #f8fafc; }
    .panel h3 { margin: 0 0 8px; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b; }
    .panel p, .panel div { margin: 0; font-size: 13px; line-height: 1.55; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 13px; }
    th, td { border: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #475569; }
    td.num, th.num { text-align: right; white-space: nowrap; }
    .totals { margin-top: 18px; margin-left: auto; width: min(100%, 360px); }
    .totals table { margin-top: 0; }
    .totals td { border: none; padding: 6px 0; }
    .totals tr.grand td { border-top: 2px solid #0f172a; font-size: 16px; font-weight: 700; padding-top: 10px; }
    .footer { margin-top: 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 12px; color: #475569; }
    .signature { margin-top: 36px; border-top: 1px solid #cbd5e1; width: 220px; padding-top: 8px; font-size: 12px; color: #64748b; }
    @media print {
      body { background: #fff; }
      .invoice-toolbar { display: none; }
      .invoice-shell { margin: 0; border: none; border-radius: 0; }
    }
  `;
}

export function renderInvoiceHtmlDocument(data: InvoiceData, options?: { showToolbar?: boolean }) {
  const showToolbar = options?.showToolbar !== false;
  const lineRows = data.lineItems
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.description)}<br/><span style="color:#64748b;font-size:11px;">SKU: ${escapeHtml(item.sku)}</span></td>
        <td class="num">${item.quantity}</td>
        <td class="num">${formatINR(item.unitPrice)}</td>
        <td class="num">${item.taxRate > 0 ? `${item.taxRate}%` : "—"}</td>
        <td class="num">${formatINR(item.taxableBase)}</td>
        <td class="num">${formatINR(item.taxAmount)}</td>
        <td class="num">${formatINR(item.lineTotal)}</td>
      </tr>`
    )
    .join("");

  const gstRows = data.gstSummary
    .map(
      (row) => `
      <tr>
        <td>GST @ ${row.taxRate}%</td>
        <td class="num">${formatINR(row.taxableBase)}</td>
        <td class="num">${formatINR(row.taxAmount)}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invoice ${escapeHtml(data.invoiceNumber)}</title>
  <style>${invoiceDocumentStyles()}</style>
</head>
<body>
  <div class="invoice-shell">
    ${showToolbar ? `<div class="invoice-toolbar"><button class="print-btn" onclick="window.print()">Print / Save PDF</button></div>` : ""}
    <div class="invoice-body">
      <div class="invoice-header">
        <div class="brand">
          ${data.logoUrl ? `<img src="${escapeHtml(data.logoUrl)}" alt="Mithron" />` : ""}
          <div>
            <h1>${escapeHtml(data.companyName)}</h1>
            <p>GSTIN: ${escapeHtml(data.companyGstin)}</p>
            <p>${data.companyAddress.map(escapeHtml).join(" · ")}</p>
          </div>
        </div>
        <div class="invoice-meta">
          <strong>TAX INVOICE</strong>
          <div>Invoice No: ${escapeHtml(data.invoiceNumber)}</div>
          <div>Invoice Date: ${escapeHtml(data.invoiceDate)}</div>
          <div>Due Date: ${escapeHtml(data.dueDate)}</div>
          <div>Order ID: ${escapeHtml(data.orderNumber)}</div>
          <div>Payment ID: ${escapeHtml(data.paymentId)}</div>
          <div>Transaction ID: ${escapeHtml(data.transactionId)}</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="panel">
          <h3>Bill To</h3>
          <p><strong>${escapeHtml(data.customer.name)}</strong></p>
          ${data.customer.company ? `<p>${escapeHtml(data.customer.company)}</p>` : ""}
          ${addressBlock(data.billingAddress.lines)}
          <p style="margin-top:8px;">${escapeHtml(data.customer.email)}</p>
          <p>${escapeHtml(data.customer.phone)}</p>
          ${data.customer.gstin ? `<p>GSTIN: ${escapeHtml(data.customer.gstin)}</p>` : ""}
        </div>
        <div class="panel">
          <h3>Ship To</h3>
          ${addressBlock(data.shippingAddress.lines)}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="num">Qty</th>
            <th class="num">Unit Price</th>
            <th class="num">GST %</th>
            <th class="num">Taxable</th>
            <th class="num">GST</th>
            <th class="num">Total</th>
          </tr>
        </thead>
        <tbody>${lineRows}</tbody>
      </table>

      <div class="totals">
        <table>
          <tbody>
            <tr><td>Subtotal</td><td class="num">${formatINR(data.subtotal)}</td></tr>
            ${data.discountTotal > 0 ? `<tr><td>Discount</td><td class="num">-${formatINR(data.discountTotal)}</td></tr>` : ""}
            ${data.shippingCharge > 0 ? `<tr><td>Shipping</td><td class="num">${formatINR(data.shippingCharge)}</td></tr>` : ""}
            <tr><td>Total GST</td><td class="num">${formatINR(data.taxTotal)}</td></tr>
            <tr class="grand"><td>Grand Total</td><td class="num">${formatINR(data.grandTotal)}</td></tr>
          </tbody>
        </table>
      </div>

      ${data.gstSummary.length ? `
      <table>
        <thead>
          <tr><th>GST Breakdown</th><th class="num">Taxable Value</th><th class="num">GST Amount</th></tr>
        </thead>
        <tbody>${gstRows}</tbody>
      </table>` : ""}

      <div class="footer">
        <div>
          <strong>Payment</strong>
          <p>Method: ${escapeHtml(data.paymentMethod)}</p>
          <p>Status: ${escapeHtml(data.paymentStatus)}</p>
          <p>Provider: ${escapeHtml(data.paymentProvider)}</p>
        </div>
        <div>
          <strong>Support</strong>
          <p>${escapeHtml(data.supportEmail)}</p>
          <p>${escapeHtml(data.supportPhone)}</p>
          <p style="margin-top:10px;">Goods once sold are subject to Mithron return and warranty policy.</p>
        </div>
      </div>

      <div class="signature">Authorized Signatory — ${escapeHtml(data.companyName)}</div>
    </div>
  </div>
</body>
</html>`;
}
