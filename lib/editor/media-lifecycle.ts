import { assertSupabaseAdminConfig } from "@/lib/env";
import type { JSONContent } from "@tiptap/core";
import { extractMediaAssetIds } from "@/lib/editor/serialize";

const ORPHAN_GRACE_DAYS = 7;

type EnvSource = Record<string, string | undefined>;

function adminHeaders(config: ReturnType<typeof assertSupabaseAdminConfig>) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal"
  };
}

export async function syncEditorMediaReferences(input: {
  documentType: string;
  documentId: string;
  json: JSONContent;
  env?: EnvSource;
}) {
  const config = assertSupabaseAdminConfig(input.env);
  const mediaAssetIds = extractMediaAssetIds(input.json);
  const now = new Date().toISOString();
  const graceUntil = new Date(Date.now() + ORPHAN_GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await fetch(`${config.url}/rest/v1/editor_document_media?document_type=eq.${encodeURIComponent(input.documentType)}&document_id=eq.${encodeURIComponent(input.documentId)}`, {
    method: "DELETE",
    headers: adminHeaders(config)
  }).catch(() => undefined);

  if (mediaAssetIds.length) {
    await fetch(`${config.url}/rest/v1/editor_document_media`, {
      method: "POST",
      headers: adminHeaders(config),
      body: JSON.stringify(
        mediaAssetIds.map((mediaAssetId) => ({
          document_type: input.documentType,
          document_id: input.documentId,
          media_asset_id: mediaAssetId,
          referenced_at: now
        }))
      )
    });
  }

  const orphanedResponse = await fetch(
    `${config.url}/rest/v1/media_assets?select=id&status=eq.orphaned&orphaned_at=lt.${encodeURIComponent(graceUntil)}`,
    { headers: adminHeaders(config), cache: "no-store" }
  );

  if (!orphanedResponse.ok) return;

  const orphaned = (await orphanedResponse.json()) as Array<{ id: string }>;
  for (const asset of orphaned) {
    if (mediaAssetIds.includes(asset.id)) {
      await fetch(`${config.url}/rest/v1/media_assets?id=eq.${asset.id}`, {
        method: "PATCH",
        headers: adminHeaders(config),
        body: JSON.stringify({ status: "active", orphaned_at: null })
      });
      continue;
    }

    const refCheck = await fetch(
      `${config.url}/rest/v1/editor_document_media?media_asset_id=eq.${asset.id}&select=id&limit=1`,
      { headers: adminHeaders(config), cache: "no-store" }
    );
    if (!refCheck.ok) continue;
    const refs = (await refCheck.json()) as unknown[];
    if (refs.length) continue;

    const assetRow = await fetch(`${config.url}/rest/v1/media_assets?id=eq.${asset.id}&select=bucket,storage_path`, {
      headers: adminHeaders(config),
      cache: "no-store"
    });
    if (assetRow.ok) {
      const [row] = (await assetRow.json()) as Array<{ bucket: string; storage_path: string }>;
      if (row?.bucket && row?.storage_path) {
        await fetch(`${config.url}/storage/v1/object/${row.bucket}/${encodeURIComponent(row.storage_path)}`, {
          method: "DELETE",
          headers: adminHeaders(config)
        }).catch(() => undefined);
      }
    }

    await fetch(`${config.url}/rest/v1/media_assets?id=eq.${asset.id}`, {
      method: "DELETE",
      headers: adminHeaders(config)
    }).catch(() => undefined);
  }

  const activeIdsResponse = await fetch(
    `${config.url}/rest/v1/editor_document_media?document_type=eq.${encodeURIComponent(input.documentType)}&document_id=eq.${encodeURIComponent(input.documentId)}&select=media_asset_id`,
    { headers: adminHeaders(config), cache: "no-store" }
  );
  if (!activeIdsResponse.ok) return;
  const activeIds = new Set(
    ((await activeIdsResponse.json()) as Array<{ media_asset_id: string }>).map((row) => row.media_asset_id)
  );

  const previousResponse = await fetch(
    `${config.url}/rest/v1/editor_document_media?document_type=eq.${encodeURIComponent(input.documentType)}&document_id=neq.${encodeURIComponent(input.documentId)}&select=media_asset_id`,
    { headers: adminHeaders(config), cache: "no-store" }
  ).catch(() => null);

  const stillReferencedElsewhere = new Set<string>();
  if (previousResponse?.ok) {
    for (const row of (await previousResponse.json()) as Array<{ media_asset_id: string }>) {
      stillReferencedElsewhere.add(row.media_asset_id);
    }
  }

  for (const mediaAssetId of mediaAssetIds) {
    await fetch(`${config.url}/rest/v1/media_assets?id=eq.${mediaAssetId}`, {
      method: "PATCH",
      headers: adminHeaders(config),
      body: JSON.stringify({ status: "active", orphaned_at: null })
    }).catch(() => undefined);
  }
}

export async function markRemovedEditorMediaOrphaned(input: {
  previousMediaAssetIds: string[];
  nextMediaAssetIds: string[];
  env?: EnvSource;
}) {
  const config = assertSupabaseAdminConfig(input.env);
  const removed = input.previousMediaAssetIds.filter((id) => !input.nextMediaAssetIds.includes(id));
  if (!removed.length) return;

  const now = new Date().toISOString();
  for (const mediaAssetId of removed) {
    const refResponse = await fetch(
      `${config.url}/rest/v1/editor_document_media?media_asset_id=eq.${mediaAssetId}&select=id&limit=1`,
      { headers: adminHeaders(config), cache: "no-store" }
    );
    if (!refResponse.ok) continue;
    const refs = (await refResponse.json()) as unknown[];
    if (refs.length) continue;

    await fetch(`${config.url}/rest/v1/media_assets?id=eq.${mediaAssetId}`, {
      method: "PATCH",
      headers: adminHeaders(config),
      body: JSON.stringify({ status: "orphaned", orphaned_at: now })
    }).catch(() => undefined);
  }
}
