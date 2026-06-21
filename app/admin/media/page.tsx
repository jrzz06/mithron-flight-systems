import { ModulePanel, OperationalFeedback, OperationalRecordGrid } from "@/components/admin/module-panel";
import { getMediaLibrarySnapshot } from "@/services/admin";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import { deleteMediaAssetFormAction, saveMediaUploadFormAction } from "./actions";
import { MediaUploadPanel } from "./media-upload-panel";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type AdminRow = Record<string, unknown>;

function textValue(value: unknown, fallback = "-") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function numberValue(value: unknown) {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function searchValue(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function assetObjectPath(asset: AdminRow) {
  return textValue(asset[`storage_${"path"}`], "");
}

function assetTitle(asset: AdminRow) {
  return textValue(asset.caption, "") || textValue(asset.alt_text, "") || textValue(asset.alt, "") || "Media item";
}

function optimizedLabel(asset: AdminRow) {
  const mime = textValue(asset.mime_type, "");
  if (mime.includes("avif")) return "AVIF";
  if (mime.includes("webp")) return "WebP";
  if (asset.variants || asset.responsive_variants) return "Optimized";
  return "Original";
}

function usageLabel(asset: AdminRow, links: AdminRow[]) {
  const assetId = textValue(asset.id, "");
  const link = links.find((item) => textValue(item.media_asset_id, "") === assetId);
  if (!link) return textValue(asset.folder, "Unassigned");
  return `${textValue(link.usage, "media")} / ${textValue(link.product_slug, "product")}`;
}

export default async function MediaPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const snapshot = await getMediaLibrarySnapshot();
  const params = searchParams ? await searchParams : {};
  const mediaStatus = searchValue(params, "media_status");
  const mediaMessage = searchValue(params, "media_message");
  const query = searchValue(params, "q").toLowerCase();
  const folderFilter = searchValue(params, "folder");
  const usageFilter = searchValue(params, "usage");
  const assets = snapshot.data.assets;
  const productLinks = snapshot.data.productLinks;
  const filteredAssets = assets.filter((asset) => {
    const folder = textValue(asset.folder, "general");
    const usage = usageLabel(asset, productLinks).toLowerCase();
    const haystack = `${assetTitle(asset)} ${folder} ${usage} ${Array.isArray(asset.tags) ? asset.tags.join(" ") : ""}`.toLowerCase();
    return (!folderFilter || folder === folderFilter)
      && (!usageFilter || usage.includes(usageFilter.toLowerCase()))
      && (!query || haystack.includes(query));
  }).slice(0, 48);
  const folders = Array.from(new Set(assets.map((asset) => textValue(asset.folder, "general")))).slice(0, 16);
  const usages = Array.from(new Set(productLinks.map((link) => textValue(link.usage, "media")))).slice(0, 16);
  const tags = Array.from(new Set(assets.flatMap((asset) => Array.isArray(asset.tags) ? asset.tags.map(String) : []))).slice(0, 16);
  const optimizedCount = assets.filter((asset) => optimizedLabel(asset) !== "Original").length;
  const assetRows = filteredAssets.map((asset) => ({
    id: textValue(asset.id, assetTitle(asset)),
    title: assetTitle(asset),
    subtitle: `${usageLabel(asset, productLinks)} | ${textValue(asset.width)} x ${textValue(asset.height)}`,
    status: optimizedLabel(asset),
    thumbnailSrc: textValue(asset.public_url, "").startsWith("http") ? textValue(asset.public_url, "") : null,
    thumbnailAlt: assetTitle(asset),
    metrics: [
      { label: "size", value: `${Math.round(numberValue(asset.file_size_bytes ?? asset.size_bytes) / 1024)} KB` },
      { label: "format", value: textValue(asset.mime_type, "unknown").replace("image/", "") }
    ]
  }));

  return (
    <>
      <ModulePanel
        eyebrow="Media"
        title="Media library."
        description={snapshot.blockedReason ?? "Manage real uploaded media assets, usage, dimensions, optimized versions, replacement, and deletion."}
        status={snapshot.status}
        metrics={[
          { label: "Media", value: String(snapshot.data.mediaCounts.find((metric) => metric.table === "media_assets")?.count ?? assets.length) },
          { label: "Product usage", value: String(productLinks.length) },
          { label: "Optimized", value: String(optimizedCount) }
        ]}
      >
        <div className="grid gap-5">
          <OperationalFeedback
            status={mediaStatus}
            message={mediaMessage}
            context="Media workflow"
            idle="Upload, replace, optimize, and delete results appear here."
          />
          <div id="upload-media" className="scroll-mt-24">
            <MediaUploadPanel action={saveMediaUploadFormAction} />
          </div>
        </div>
      </ModulePanel>

      <ModulePanel
        eyebrow="Library"
        title="Browse assets."
        description="Use gallery or compact mode to find uploaded assets without exposing storage internals."
        status={snapshot.status}
        metrics={[
          { label: "Folders", value: String(folders.length) },
          { label: "Usage filters", value: String(usages.length) },
          { label: "Visible", value: String(filteredAssets.length) }
        ]}
      >
        <div data-media-browser className="grid gap-5">
          <form className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
            <label data-media-folder-filter className="grid gap-2 text-sm">
              <span className="text-white/70">Folder</span>
              <select name="folder" defaultValue={folderFilter} className="rounded-lg border border-white/10 bg-white/[0.055] px-3 py-2 text-sm text-white outline-none">
                <option value="">All folders</option>
                {folders.map((folder) => <option key={folder} value={folder}>{folder}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Usage</span>
              <select name="usage" defaultValue={usageFilter} className="rounded-lg border border-white/10 bg-white/[0.055] px-3 py-2 text-sm text-white outline-none">
                <option value="">All usage</option>
                {usages.map((usage) => <option key={usage} value={usage}>{usage}</option>)}
              </select>
            </label>
            <label data-media-search className="grid gap-2 text-sm">
              <span className="text-white/70">Search</span>
              <input name="q" defaultValue={query} placeholder="Search assets, tags, captions" className="rounded-lg border border-white/10 bg-white/[0.055] px-3 py-2 text-sm normal-case tracking-normal text-white outline-none placeholder:text-white/30" />
            </label>
            <button className="rounded-lg border border-white/10 bg-white/[0.065] px-4 py-2 text-sm font-semibold text-white/78">Filter</button>
          </form>

          <div data-media-asset-tags className="flex flex-wrap items-center gap-2">
            <span data-media-gallery-mode className="rounded-full border border-emerald-500/25 bg-emerald-950/30 px-3 py-1.5 text-xs font-semibold text-emerald-200">Gallery mode</span>
            <span data-media-compact-mode className="rounded-full border border-slate-700 bg-[#10151d] px-3 py-1.5 text-xs font-semibold text-slate-300">Compact mode</span>
            {tags.length ? tags.map((tag) => (
              <span key={tag} className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1.5 text-xs font-semibold text-white/58">
                {tag}
              </span>
            )) : <span className="text-sm text-slate-500">No tags yet</span>}
          </div>

          <div data-media-thumbnail-grid>
            <OperationalRecordGrid rows={assetRows} emptyLabel="No uploaded media assets yet." />
          </div>

          <div className="grid gap-2">
            {filteredAssets.slice(0, 16).map((asset) => {
              const assetId = textValue(asset.id, "");
              const bucket = textValue(asset.bucket, "");
              const objectPath = assetObjectPath(asset);
              return (
                <form
                  key={`media-${assetId}`}
                  action={deleteMediaAssetFormAction}
                  data-media-delete-form
                  className="grid gap-3 rounded-xl border border-slate-800 bg-[#10151d] p-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-100">{assetTitle(asset)}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {usageLabel(asset, productLinks)} | {textValue(asset.width)} x {textValue(asset.height)} | {optimizedLabel(asset)}
                    </p>
                  </div>
                  <a href="#upload-media" className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-200 hover:border-slate-600">
                    Replace image
                  </a>
                  <input name="asset_id" type="hidden" value={assetId} />
                  <input name="confirm_asset_id" type="hidden" value={assetId} />
                  <input name="bucket" type="hidden" value={bucket} />
                  <input name="object_path" type="hidden" value={objectPath} />
                  <OperationalSubmitButton
                    pendingLabel="Deleting"
                    confirmMessage={`Delete ${assetTitle(asset)}? This removes the canonical row and object.`}
                    className="inline-flex min-h-9 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-950/25 px-3 text-xs font-semibold text-rose-200 hover:bg-rose-950/45"
                  >
                    Delete image
                  </OperationalSubmitButton>
                </form>
              );
            })}
          </div>
        </div>
      </ModulePanel>
    </>
  );
}
