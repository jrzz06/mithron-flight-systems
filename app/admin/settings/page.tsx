import { ModulePanel, OperationalFeedback } from "@/components/admin/module-panel";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import { footerContent } from "@/config/storefront-content";
import { getAdminSettingsSnapshot } from "@/services/admin";
import { saveAdminSettingsFormAction } from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type SettingsRecord = Record<string, unknown>;

function searchValue(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function record(value: unknown): SettingsRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as SettingsRecord : {};
}

function section(settings: SettingsRecord, key: string) {
  return record(settings[key]);
}

function text(settings: SettingsRecord, key: string, fallback = "") {
  const value = settings[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function enabled(settings: SettingsRecord, key: string, fallback = false) {
  const value = settings[key];
  return typeof value === "boolean" ? value : fallback;
}

function formatBytes(value: number) {
  if (value <= 0) return "0 MB";
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function inputClass() {
  return "h-10 rounded-lg border border-slate-700 bg-[#10151d] px-3 text-sm text-slate-100 outline-none focus:border-emerald-500/70";
}

function SettingsCard({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-800 bg-[#0f141b] p-4 shadow-none">
      <h2 className="text-base font-semibold text-slate-100">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      <div className="mt-4 grid gap-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text"
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm text-slate-300">
      {label}
      <input name={name} type={type} defaultValue={defaultValue} className={inputClass()} />
    </label>
  );
}

function Toggle({
  label,
  description,
  name,
  defaultChecked
}: {
  label: string;
  description: string;
  name: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-lg border border-slate-800 bg-[#10151d] p-3">
      <span>
        <span className="block text-sm font-semibold text-slate-100">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
      </span>
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="mt-1 h-5 w-5 accent-emerald-500" />
    </label>
  );
}

export default async function AdminSettingsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const snapshot = await getAdminSettingsSnapshot();
  const params = searchParams ? await searchParams : {};
  const settingsStatus = searchValue(params, "settings_status");
  const settingsMessage = searchValue(params, "settings_message");
  const general = section(snapshot.data.settings, "general");
  const performance = section(snapshot.data.settings, "performance");
  const cms = section(snapshot.data.settings, "cms");
  const footer = section(snapshot.data.settings, "footer");
  const security = section(snapshot.data.settings, "security");
  const notifications = section(snapshot.data.settings, "notifications");

  return (
    <ModulePanel
      eyebrow="Application settings"
      title="Settings."
      description={snapshot.blockedReason ?? "Manage application settings, CMS behavior, performance defaults, security policy, storage maintenance, and notifications."}
      status={snapshot.status}
      metrics={[
        { label: "Media", value: String(snapshot.data.storage.mediaCount) },
        { label: "Optimized images", value: String(snapshot.data.storage.optimizedImagesCount) },
        { label: "Storage usage", value: formatBytes(snapshot.data.storage.usageBytes) },
        { label: "CDN cache", value: snapshot.data.storage.cdnCacheStatus }
      ]}
    >
      <form data-admin-settings-route action={saveAdminSettingsFormAction} className="grid gap-4">
        <OperationalFeedback
          status={settingsStatus}
          message={settingsMessage}
          context="Settings"
          idle="Settings changes save to Supabase admin_settings."
        />

        <SettingsCard title="General" description="Branding and localization defaults for the admin and storefront.">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Website name" name="website_name" defaultValue={text(general, "website_name", "Mithron Flight Systems")} />
            <Field label="Brand logo" name="brand_logo" defaultValue={text(general, "brand_logo")} />
            <Field label="Admin theme" name="admin_theme" defaultValue={text(general, "admin_theme", "dark")} />
            <Field label="Accent color" name="accent_color" type="color" defaultValue={text(general, "accent_color", "#10b981")} />
            <Field label="Timezone" name="timezone" defaultValue={text(general, "timezone", "Asia/Kolkata")} />
            <Field label="Currency" name="currency" defaultValue={text(general, "currency", "INR")} />
            <Field label="Language" name="language" defaultValue={text(general, "language", "en")} />
          </div>
        </SettingsCard>

        <SettingsCard title="Performance" description="Keep storefront and admin media lightweight under normal traffic.">
          <div className="grid gap-3 md:grid-cols-2">
            <Toggle label="Enable image compression" description="Compress uploads before they are exposed to the storefront." name="image_compression" defaultChecked={enabled(performance, "image_compression", true)} />
            <Toggle label="Enable AVIF/WebP conversion" description="Generate modern image formats for supported assets." name="avif_webp_conversion" defaultChecked={enabled(performance, "avif_webp_conversion", true)} />
            <Toggle label="Enable lazy loading" description="Defer below-fold media and noncritical previews." name="lazy_loading" defaultChecked={enabled(performance, "lazy_loading", true)} />
            <Toggle label="Enable CDN optimization" description="Serve optimized public media through cache-friendly URLs." name="cdn_optimization" defaultChecked={enabled(performance, "cdn_optimization", true)} />
            <Toggle label="Enable thumbnail mode" description="Use thumbnails in admin lists instead of full-size assets." name="thumbnail_mode" defaultChecked={enabled(performance, "thumbnail_mode", true)} />
            <Toggle label="Enable query caching" description="Cache bounded public reads and avoid repeated identical requests." name="query_caching" defaultChecked={enabled(performance, "query_caching", true)} />
            <Toggle label="Enable realtime updates" description="Allow live refresh where the workflow needs it." name="realtime_updates" defaultChecked={enabled(performance, "realtime_updates", false)} />
            <Toggle label="Low bandwidth mode" description="Prefer compact previews and shorter result windows." name="low_bandwidth_mode" defaultChecked={enabled(performance, "low_bandwidth_mode", false)} />
          </div>
        </SettingsCard>

        <SettingsCard title="CMS" description="Publishing and visual editing behavior for CMS-controlled pages.">
          <div className="grid gap-3 md:grid-cols-2">
            <Toggle label="Instant publish" description="Publish approved CMS edits without a staged delay." name="instant_publish" defaultChecked={enabled(cms, "instant_publish", false)} />
            <Toggle label="Draft mode" description="Keep unpublished edits separate from public content." name="draft_mode" defaultChecked={enabled(cms, "draft_mode", true)} />
            <Toggle label="Section visibility controls" description="Allow editors to show or hide homepage sections." name="section_visibility_controls" defaultChecked={enabled(cms, "section_visibility_controls", true)} />
            <Toggle label="Auto-save drafts" description="Save visual editor drafts while editors work." name="autosave_drafts" defaultChecked={enabled(cms, "autosave_drafts", true)} />
            <Toggle label="Homepage cache clear on publish" description="Refresh the homepage after CMS publish actions." name="clear_homepage_cache_on_publish" defaultChecked={enabled(cms, "clear_homepage_cache_on_publish", true)} />
            <Toggle label="Enable visual editor" description="Use the visual CMS editor for homepage, navigation, media, and footer content." name="visual_editor" defaultChecked={enabled(cms, "visual_editor", true)} />
            <Toggle label="Enable image previews" description="Show selected media inside CMS edit panels." name="image_previews" defaultChecked={enabled(cms, "image_previews", true)} />
          </div>
        </SettingsCard>

        <SettingsCard title="Footer lead" description="Newsletter headline, body copy, and CTA labels shown in the site footer lead column.">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Lead title" name="footer_lead_title" defaultValue={text(footer, "leadTitle", footerContent.leadTitle)} />
            <Field label="CTA label" name="footer_cta_label" defaultValue={text(footer, "ctaLabel", footerContent.ctaLabel)} />
            <Field label="Email placeholder" name="footer_email_placeholder" defaultValue={text(footer, "emailPlaceholder", footerContent.emailPlaceholder)} />
            <Field label="Legal text" name="footer_legal_text" defaultValue={text(footer, "legalText", footerContent.legalText)} />
          </div>
          <label className="grid gap-1.5 text-sm text-slate-300">
            Lead body
            <textarea
              name="footer_lead_body"
              defaultValue={text(footer, "leadBody", footerContent.leadBody)}
              className="min-h-24 rounded-lg border border-slate-700 bg-[#10151d] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/70"
            />
          </label>
        </SettingsCard>

        <SettingsCard title="Security" description="Operator session and login protection settings.">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Session timeout" name="session_timeout_minutes" defaultValue={text(security, "session_timeout_minutes", "60")} />
            <Field label="Allowed admin domains" name="allowed_admin_domains" defaultValue={text(security, "allowed_admin_domains")} />
            <Toggle label="2FA toggle" description="Require two-factor authentication for admin users when available." name="two_factor_required" defaultChecked={enabled(security, "two_factor_required", false)} />
            <Toggle label="Login alerts" description="Notify admins when privileged sessions start." name="login_alerts" defaultChecked={enabled(security, "login_alerts", true)} />
            <Toggle label="Device tracking" description="Record device context for admin sessions." name="device_tracking" defaultChecked={enabled(security, "device_tracking", true)} />
            <Toggle label="Password reset control" description="Allow admin-managed password reset workflows." name="password_reset_enabled" defaultChecked={enabled(security, "password_reset_enabled", true)} />
          </div>
        </SettingsCard>

        <SettingsCard title="Storage" description="Canonical media usage and maintenance actions.">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-slate-800 bg-[#10151d] p-3">
              <p className="text-xs text-slate-500">Supabase storage usage</p>
              <p className="mt-1 text-lg font-semibold text-slate-100">{formatBytes(snapshot.data.storage.usageBytes)}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#10151d] p-3">
              <p className="text-xs text-slate-500">Media count</p>
              <p className="mt-1 text-lg font-semibold text-slate-100">{snapshot.data.storage.mediaCount}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#10151d] p-3">
              <p className="text-xs text-slate-500">Optimized images count</p>
              <p className="mt-1 text-lg font-semibold text-slate-100">{snapshot.data.storage.optimizedImagesCount}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#10151d] p-3">
              <p className="text-xs text-slate-500">CDN cache status</p>
              <p className="mt-1 text-lg font-semibold text-slate-100">{snapshot.data.storage.cdnCacheStatus}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {["Clear cache", "Regenerate thumbnails", "Optimize media", "Cleanup unused assets"].map((label) => (
              <button key={label} type="submit" name="maintenance_action" value={label.toLowerCase().replaceAll(" ", "_")} className="h-9 rounded-lg border border-slate-700 bg-[#10151d] px-3 text-sm font-semibold text-slate-100 hover:border-slate-600">
                {label}
              </button>
            ))}
          </div>
        </SettingsCard>

        <SettingsCard title="Notifications" description="Choose which operational events should notify admins.">
          <div className="grid gap-3 md:grid-cols-2">
            <Toggle label="Order alerts" description="Notify admins about new or changed orders." name="order_alerts" defaultChecked={enabled(notifications, "order_alerts", true)} />
            <Toggle label="Warehouse alerts" description="Notify warehouse staff about stock and shipment events." name="warehouse_alerts" defaultChecked={enabled(notifications, "warehouse_alerts", true)} />
            <Toggle label="CMS publish alerts" description="Notify content owners when public CMS content changes." name="cms_publish_alerts" defaultChecked={enabled(notifications, "cms_publish_alerts", true)} />
            <Toggle label="Admin login alerts" description="Notify administrators about privileged sign-ins." name="admin_login_alerts" defaultChecked={enabled(notifications, "admin_login_alerts", true)} />
            <Toggle label="Email notifications" description="Send configured notifications through email when available." name="email_notifications" defaultChecked={enabled(notifications, "email_notifications", false)} />
          </div>
        </SettingsCard>

        <div className="sticky bottom-0 z-20 rounded-xl border border-slate-800 bg-[#0b1017] p-3 text-right">
          <OperationalSubmitButton pendingLabel="Saving settings" className="inline-flex h-10 items-center rounded-lg border border-emerald-600 bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700">
            Save settings
          </OperationalSubmitButton>
        </div>
      </form>
    </ModulePanel>
  );
}
