"use client";



import { useState } from "react";

import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";

import { buildPackingSlipLines } from "@/services/warehouse-packing";



export type PackingOrderItem = {

  id: string;

  sku: string;

  productSlug: string;

  productName: string;

  quantity: number;

};



type WarehousePackingOrderCardProps = {

  orderId: string;

  orderNumber: string;

  warehouseCode: string;

  items: PackingOrderItem[];

  warehouses: Array<{ code: string; name: string }>;

  defaultWarehouseCode: string;

  defaultCarrier: string;

  completeAction: (formData: FormData) => Promise<void>;

};



function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function printPackingSlip(lines: string[]) {

  const popup = window.open("", "_blank", "noopener,noreferrer,width=720,height=900");

  if (!popup) return;

  const escapedContent = lines.map(escapeHtml).join("\n");

  popup.document.write(`<!doctype html><html><head><title>Packing slip</title></head><body><pre style="font:14px/1.5 monospace;padding:24px;">${escapedContent}</pre><script>window.onload=function(){window.print();};<\/script></body></html>`);

  popup.document.close();

}



export function WarehousePackingOrderCard({

  orderId,

  orderNumber,

  warehouseCode,

  items,

  defaultWarehouseCode,

  defaultCarrier,

  completeAction

}: WarehousePackingOrderCardProps) {

  const [verifiedIds, setVerifiedIds] = useState<Set<string>>(new Set());

  const [slipConfirmed, setSlipConfirmed] = useState(false);

  const packingNote = "Packed and verified";



  const allVerified = items.every((item) => verifiedIds.has(item.id));

  const canSubmit = allVerified && slipConfirmed && packingNote.trim().length > 0;



  function toggleVerified(itemId: string, checked: boolean) {

    setVerifiedIds((current) => {

      const next = new Set(current);

      if (checked) next.add(itemId);

      else next.delete(itemId);

      return next;

    });

  }



  function verifyAll() {

    setVerifiedIds(new Set(items.map((item) => item.id)));

  }



  function handlePrintSlip() {

    const lines = buildPackingSlipLines({

      orderNumber,

      warehouseCode,

      carrierName: defaultCarrier,

      trackingNumber: "",

      shipmentNumber: orderNumber,

      items: items.map((item) => ({ sku: item.sku, productSlug: item.productSlug, quantity: item.quantity })),

      packingNote: packingNote || "Packed and verified"

    });

    printPackingSlip(lines);

    setSlipConfirmed(true);

  }



  return (

    <article className="content-visibility-auto rounded-[var(--platform-radius)] border border-[var(--platform-border)] bg-[var(--platform-surface)] p-4 [contain-intrinsic-size:320px] [content-visibility:auto]">

      <div className="flex flex-wrap items-start justify-between gap-3">

        <div>

          <p className="text-sm font-medium text-[var(--platform-text-primary)]">{orderNumber}</p>

          <p className="mt-1 platform-type-caption">{items.length} line item{items.length === 1 ? "" : "s"}</p>

        </div>

      </div>



      <form action={completeAction} className="mt-4 grid gap-4">

        <input type="hidden" name="order_id" value={orderId} />

        <input type="hidden" name="require_item_scan" value="off" />

        {items.map((item) => (

          verifiedIds.has(item.id) ? <input key={`verified-${item.id}`} type="hidden" name="verified_item_id" value={item.id} /> : null

        ))}

        {items.map((item) => (

          <div key={item.id}>

            <input type="hidden" name="order_item_id" value={item.id} />

            <input type="hidden" name="shipment_product_id" value={item.productSlug} />

            <input type="hidden" name="shipment_quantity" value={String(item.quantity)} />

          </div>

        ))}



        <div data-packing-checklist className="grid gap-3">

          <div className="flex flex-wrap gap-2">

            <button

              type="button"

              onClick={verifyAll}

              className="platform-btn-secondary platform-btn-sm"

            >

              Verify all items

            </button>

          </div>



          <div className="grid gap-2">

            {items.map((item) => {

              const verified = verifiedIds.has(item.id);

              return (

                <label

                  key={item.id}

                  className={`flex items-center justify-between gap-3 rounded-[var(--platform-radius)] border px-3 py-2.5 text-sm ${verified ? "border-[color-mix(in_srgb,var(--platform-success)_35%,transparent)] bg-[var(--platform-success-soft)] text-[var(--platform-text-primary)]" : "border-[var(--platform-border)] bg-[var(--platform-surface-muted)] text-[var(--platform-text-secondary)]"}`}

                >

                  <span>

                    <span className="font-mono text-xs">{item.sku}</span>

                    <span className="mx-2 text-slate-600">·</span>

                    {item.productName || item.productSlug}

                    <span className="ml-2 platform-type-caption">qty {item.quantity}</span>

                  </span>

                  <input

                    type="checkbox"

                    checked={verified}

                    onChange={(event) => toggleVerified(item.id, event.target.checked)}

                    className="h-4 w-4 accent-[var(--platform-accent)]"

                  />

                </label>

              );

            })}

          </div>



          <input type="hidden" name="packing_note" value={packingNote} />



          <div className="flex flex-wrap items-center gap-3">

            <button

              type="button"

              onClick={handlePrintSlip}

              className="platform-btn-ghost platform-btn-sm"

            >

              Print packing slip

            </button>

            <label className="inline-flex items-center gap-2 text-sm text-[var(--platform-text-secondary)]">

              <input

                name="slip_confirmed"

                type="checkbox"

                checked={slipConfirmed}

                onChange={(event) => setSlipConfirmed(event.target.checked)}

                className="h-4 w-4 accent-[var(--platform-accent)]"

              />

              Packing slip confirmed

            </label>

          </div>

        </div>



        <input type="hidden" name="warehouse_id" value={warehouseCode || defaultWarehouseCode} />

        <input type="hidden" name="carrier_name" value={defaultCarrier} />

        <input type="hidden" name="tracking_number" value="" />

        <input type="hidden" name="change_summary" value={`Complete pack ${orderNumber}`} />

        <OperationalSubmitButton

          disabled={!canSubmit}

          pendingLabel="Completing pack"

          className="platform-btn-primary platform-btn-md disabled:cursor-not-allowed"

        >

          Packed — queue for dispatch

        </OperationalSubmitButton>

        {!canSubmit ? (

          <p className="platform-type-caption">Verify every line item and confirm the packing slip before completing.</p>

        ) : null}

      </form>

    </article>

  );

}


