"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { OperationalFeedback } from "@/components/admin/module-panel";
import { AdminOrdersOptimisticProvider } from "@/components/admin/admin-orders-optimistic";
import { AdminOrderActionsRail } from "@/components/admin/orders/admin-order-actions-rail";
import { AdminOrderCreateDrawer } from "@/components/admin/orders/admin-order-create-drawer";
import { AdminOrderDetail } from "@/components/admin/orders/admin-order-detail";
import { AdminOrderDetailEmpty, AdminOrderDetailPanel } from "@/components/admin/orders/admin-order-detail-panel";
import { AdminOrderList } from "@/components/admin/orders/admin-order-list";
import { AdminOrdersFilterBar } from "@/components/admin/orders/admin-orders-filter-bar";
import { AdminOrdersShell } from "@/components/admin/orders/admin-orders-shell";
import { AdminOrdersToolbar } from "@/components/admin/orders/admin-orders-toolbar";
import { useAdminOrdersKeyboard } from "@/components/admin/orders/use-admin-orders-keyboard";
import {
  buildOrdersUrl,
  filterOrders,
  filtersToSearchParams,
  orderItemsForOrder,
  parseOrderFiltersFromSearchParams,
  text,
  sortOrders,
  type AdminRow,
  type OrderFilterState
} from "@/components/admin/orders/order-view-helpers";

type AdminOrdersWorkspaceProps = {
  orders: AdminRow[];
  orderItems: AdminRow[];
  stock: AdminRow[];
  shipments: AdminRow[];
  products: AdminRow[];
  warehouses: Array<{ code: string; name: string }>;
  defaultWarehouseCode: string;
  selectedOrder: AdminRow | null;
  selectedOrderId: string;
  selectedOrderKey: string;
  queue: string;
  query: string;
  orderStatus: string;
  orderMessage: string;
  snapshotStatus: string;
  blockedReason?: string | null;
  createAdminManualOrderAction: (formData: FormData) => Promise<void>;
  confirmAdminOrderAction: (formData: FormData) => Promise<void>;
  rejectAdminOrderAction: (formData: FormData) => Promise<void>;
  cancelAdminOrderAction: (formData: FormData) => Promise<void>;
  deleteAdminOrderAction: (formData: FormData) => Promise<void>;
  archiveAdminOrderAction: (formData: FormData) => Promise<void>;
  restoreAdminOrderAction: (formData: FormData) => Promise<void>;
  permanentDeleteAdminOrderAction: (formData: FormData) => Promise<void>;
  assignAdminWarehouseAction: (formData: FormData) => Promise<void>;
  updateAdminOrderLifecycleAction: (formData: FormData) => Promise<void>;
  confirmAdminWarehouseHandoffAction: (formData: FormData) => Promise<void>;
};

function ShortcutsLegend({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 p-4" onMouseDown={onClose}>
      <div
        className="w-full max-w-sm rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface)] p-4 text-sm"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h3 className="font-semibold text-[var(--platform-text-primary)]">Keyboard shortcuts</h3>
        <ul className="mt-3 space-y-1.5 text-xs text-[var(--platform-text-secondary)]">
          <li><kbd className="rounded border px-1">↑</kbd> / <kbd className="rounded border px-1">↓</kbd> Navigate orders</li>
          <li><kbd className="rounded border px-1">Esc</kbd> Close drawer or clear selection</li>
          <li><kbd className="rounded border px-1">c</kbd> Create order</li>
          <li><kbd className="rounded border px-1">?</kbd> Show shortcuts</li>
        </ul>
        <button type="button" onClick={onClose} className="mt-4 text-xs text-violet-300 hover:underline">
          Close
        </button>
      </div>
    </div>
  );
}

export function AdminOrdersWorkspace(props: AdminOrdersWorkspaceProps) {
  const {
    orders,
    orderItems,
    stock,
    shipments,
    products,
    warehouses,
    defaultWarehouseCode,
    selectedOrder,
    selectedOrderId,
    selectedOrderKey,
    queue,
    orderStatus,
    orderMessage,
    blockedReason,
    createAdminManualOrderAction,
    confirmAdminOrderAction,
    rejectAdminOrderAction,
    cancelAdminOrderAction,
    deleteAdminOrderAction,
    archiveAdminOrderAction,
    restoreAdminOrderAction,
    permanentDeleteAdminOrderAction,
    assignAdminWarehouseAction,
    updateAdminOrderLifecycleAction,
    confirmAdminWarehouseHandoffAction
  } = props;

  const router = useRouter();
  const searchParams = useSearchParams();
  const createOpen = searchParams.get("tool") === "create";
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const filters = useMemo(
    () => parseOrderFiltersFromSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );

  const selectedKey = selectedOrderKey || (selectedOrder ? text(selectedOrder.order_number) || selectedOrderId : "");

  const catalogProducts = useMemo(
    () =>
      products
        .map((product) => ({
          slug: text(product.slug),
          name: text(product.name, text(product.slug)),
          price: Number(product.price ?? 0) || 0,
          chargeTax: product.charge_tax !== false,
          taxRate: product.tax_rate != null ? Number(product.tax_rate) : null,
          taxIncluded: Boolean(product.tax_included),
          taxGroup: text(product.tax_group) || null
        }))
        .filter((product) => product.slug),
    [products]
  );

  const filteredOrders = useMemo(() => {
    const filtered = filterOrders(orders, orderItems, queue, filters, defaultWarehouseCode);
    return sortOrders(filtered, filters.sort);
  }, [orders, orderItems, queue, filters, defaultWarehouseCode]);

  const replaceOrdersUrl = useCallback(
    (url: string) => {
      router.replace(url, { scroll: false });
    },
    [router]
  );

  const syncFilters = useCallback(
    (patch: Partial<OrderFilterState>) => {
      const nextFilters = { ...filters, ...patch };
      const params = filtersToSearchParams(new URLSearchParams(searchParams.toString()), nextFilters, {
        queue,
        order: selectedKey || undefined,
        tool: createOpen ? "create" : undefined
      });
      replaceOrdersUrl(buildOrdersUrl(Object.fromEntries(params.entries())));
    },
    [filters, searchParams, queue, selectedKey, createOpen, replaceOrdersUrl]
  );

  const openCreate = useCallback(() => {
    const params = filtersToSearchParams(new URLSearchParams(searchParams.toString()), filters, {
      queue,
      order: selectedKey || undefined,
      tool: "create"
    });
    replaceOrdersUrl(buildOrdersUrl(Object.fromEntries(params.entries())));
  }, [filters, queue, replaceOrdersUrl, searchParams, selectedKey]);

  const closeCreate = useCallback(() => {
    const params = filtersToSearchParams(new URLSearchParams(searchParams.toString()), filters, {
      queue,
      order: selectedKey || undefined
    });
    replaceOrdersUrl(buildOrdersUrl(Object.fromEntries(params.entries())));
  }, [filters, queue, replaceOrdersUrl, searchParams, selectedKey]);

  const orderHref = useCallback(
    (orderNumber: string) => {
      const params = filtersToSearchParams(new URLSearchParams(searchParams.toString()), filters, {
        queue,
        order: orderNumber,
        tool: createOpen ? "create" : undefined
      });
      return buildOrdersUrl(Object.fromEntries(params.entries()));
    },
    [filters, queue, searchParams, createOpen]
  );

  const selectOrder = useCallback(
    (orderNumber: string) => {
      replaceOrdersUrl(orderHref(orderNumber));
    },
    [orderHref, replaceOrdersUrl]
  );

  const clearSelection = useCallback(() => {
    const params = filtersToSearchParams(new URLSearchParams(searchParams.toString()), filters, { queue });
    replaceOrdersUrl(buildOrdersUrl(Object.fromEntries(params.entries())));
  }, [filters, queue, replaceOrdersUrl, searchParams]);

  useEffect(() => {
    function onShowShortcuts() {
      setShortcutsOpen(true);
    }
    window.addEventListener("admin-orders-show-shortcuts", onShowShortcuts);
    return () => window.removeEventListener("admin-orders-show-shortcuts", onShowShortcuts);
  }, []);

  useAdminOrdersKeyboard({
    orders: filteredOrders,
    selectedKey,
    selectedOrderId,
    selectOrder,
    createDrawerOpen: createOpen,
    onOpenCreate: openCreate,
    onCloseCreate: closeCreate,
    onClearSelection: clearSelection,
    focusedIndex,
    onFocusIndex: setFocusedIndex
  });

  const selectedItems = selectedOrder ? orderItemsForOrder(selectedOrderId, orderItems) : [];
  const selectedShipments = selectedOrder
    ? shipments.filter((shipment) => text(shipment.order_id) === selectedOrderId)
    : [];
  const firstItem = selectedItems[0] ?? null;

  return (
    <>
      <OperationalFeedback
        status={orderStatus}
        message={orderMessage}
        context="Order workflow"
        idle="Select an order, review details, then take action from the actions panel."
      />

      <AdminOrdersOptimisticProvider orders={filteredOrders}>
        {(optimisticOrders) => (
          <AdminOrdersShell
            hasSelectedOrder={Boolean(selectedOrder)}
            toolbar={
              <AdminOrdersToolbar
                orders={orders}
                queue={queue}
                selectedKey={selectedKey}
                filtersQuery={filters.query}
                sort={filters.sort}
                onCreateOrder={openCreate}
                onShowShortcuts={() => setShortcutsOpen(true)}
              />
            }
            filters={
              <AdminOrdersFilterBar filters={filters} warehouses={warehouses} onChange={syncFilters} />
            }
            list={
              <AdminOrderList
                orders={optimisticOrders}
                orderItems={orderItems}
                products={products}
                shipments={shipments}
                defaultWarehouseCode={defaultWarehouseCode}
                selectedKey={selectedKey}
                selectedOrderId={selectedOrderId}
                buildOrderHref={orderHref}
                onSelectOrder={selectOrder}
                blockedReason={blockedReason}
                focusedIndex={focusedIndex}
                onFocusIndex={setFocusedIndex}
              />
            }
            detail={
              selectedOrder ? (
                <AdminOrderDetailPanel orderId={selectedOrderId}>
                  <AdminOrderDetail
                    order={selectedOrder}
                    orderId={selectedOrderId}
                    allOrders={orders}
                    orderItems={orderItems}
                    products={products}
                    stock={stock}
                    shipments={shipments}
                    catalogProducts={catalogProducts}
                    defaultWarehouseCode={defaultWarehouseCode}
                    queue={queue}
                    filtersQuery={filters.query}
                    onSelectOrder={selectOrder}
                  />
                </AdminOrderDetailPanel>
              ) : (
                <AdminOrderDetailEmpty />
              )
            }
            actions={
              selectedOrder ? (
                <AdminOrderActionsRail
                  order={selectedOrder}
                  orderId={selectedOrderId}
                  queue={queue}
                  query={filters.query}
                  warehouses={warehouses}
                  defaultWarehouseCode={defaultWarehouseCode}
                  firstItem={firstItem}
                  selectedShipments={selectedShipments}
                  confirmAdminOrderAction={confirmAdminOrderAction}
                  rejectAdminOrderAction={rejectAdminOrderAction}
                  cancelAdminOrderAction={cancelAdminOrderAction}
                  deleteAdminOrderAction={deleteAdminOrderAction}
                  archiveAdminOrderAction={archiveAdminOrderAction}
                  restoreAdminOrderAction={restoreAdminOrderAction}
                  permanentDeleteAdminOrderAction={permanentDeleteAdminOrderAction}
                  assignAdminWarehouseAction={assignAdminWarehouseAction}
                  updateAdminOrderLifecycleAction={updateAdminOrderLifecycleAction}
                  confirmAdminWarehouseHandoffAction={confirmAdminWarehouseHandoffAction}
                />
              ) : null
            }
          />
        )}
      </AdminOrdersOptimisticProvider>

      <AdminOrderCreateDrawer
        open={createOpen}
        onClose={closeCreate}
        products={catalogProducts}
        defaultWarehouseCode={defaultWarehouseCode}
        createAction={createAdminManualOrderAction}
      />

      <ShortcutsLegend open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </>
  );
}
