"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ImageIcon, RotateCcw, UploadCloud, VideoIcon } from "lucide-react";

type MediaUploadPanelProps = {
  action: (formData: FormData) => void | Promise<void>;
};

type SelectedFile = {
  name: string;
  size: number;
  type: string;
  previewUrl: string | null;
  accepted: boolean;
};

const acceptedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/pdf"
]);

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function PendingSubmitButton({ files, rejectedCount }: { files: SelectedFile[]; rejectedCount: number }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || !files.length || rejectedCount > 0}
      aria-live="polite"
      className="inline-flex w-fit items-center justify-center gap-2 self-start rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55"
    >
      <UploadCloud className="h-4 w-4" aria-hidden="true" />
      {pending ? "Persisting uploads" : "Persist uploads"}
    </button>
  );
}

export function MediaUploadPanel({ action }: MediaUploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);

  const rejectedCount = useMemo(() => files.filter((file) => !file.accepted).length, [files]);
  const progress = files.length ? rejectedCount ? 35 : 82 : 0;

  useEffect(() => {
    return () => {
      for (const file of files) {
        if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
      }
    };
  }, [files]);

  function applyFiles(fileList: FileList | File[]) {
    const nextFiles = Array.from(fileList);
    const transfer = new DataTransfer();
    for (const file of nextFiles) {
      transfer.items.add(file);
    }
    if (inputRef.current) {
      inputRef.current.files = transfer.files;
    }

    setFiles(nextFiles.map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      accepted: acceptedTypes.has(file.type)
    })));
  }

  function resetSelection() {
    if (inputRef.current) inputRef.current.value = "";
    setFiles([]);
  }

  return (
    <form action={action} data-media-upload-form className="grid gap-5">
      <div
        data-media-upload-zone
        onDragEnter={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          applyFiles(event.dataTransfer.files);
        }}
        className={`grid gap-5 rounded-2xl border p-6 transition ${
          dragActive ? "border-slate-400 bg-slate-100" : "border-slate-200 bg-white"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Canonical intake</p>
            <h2 className="mt-3 font-[var(--type-display)] text-2xl font-semibold tracking-normal text-slate-950">
              Upload media to Supabase Storage
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Product and CMS assets are persisted as canonical media rows in the products bucket.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">
            <UploadCloud className="h-4 w-4" aria-hidden="true" />
            Select files
            <input
              ref={inputRef}
              name="files"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/svg+xml,video/mp4,video/webm,video/quicktime,application/pdf"
              className="sr-only"
              onChange={(event) => {
                if (event.currentTarget.files) applyFiles(event.currentTarget.files);
              }}
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <label className="grid gap-2 text-sm">
            <span className="text-slate-700">Bucket</span>
            <select name="bucket" defaultValue="mithron-products" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none">
              <option value="mithron-products">Products</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-slate-700">Folder</span>
            <input name="folder" defaultValue="editorial/intake" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-950 outline-none" />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-slate-700">Tags</span>
            <input name="tags" defaultValue="editorial, canonical" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-950 outline-none" />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-slate-700">Visibility</span>
            <select name="visibility" defaultValue="public" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none">
              <option value="public">Public CDN</option>
              <option value="private">Private</option>
              <option value="draft">Draft</option>
            </select>
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm">
            <span className="text-slate-700">Alt text</span>
            <input name="alt_text" defaultValue="" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-950 outline-none" />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-slate-700">Caption</span>
            <input name="caption" defaultValue="" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-950 outline-none" />
          </label>
        </div>

        <input type="hidden" name="usage_scope" value="admin-media-manager" />

        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" aria-label="Upload progress">
          <div data-media-upload-progress className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p aria-live="polite" className="text-xs uppercase tracking-[0.16em] text-slate-500">
          progress {progress}% {rejectedCount ? "blocked by validation" : files.length ? "ready for persistence" : "waiting for files"}
        </p>

        {files.length ? (
          <div className="grid gap-3 md:grid-cols-3">
            {files.map((file) => (
              <div key={`${file.name}-${file.size}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-xl bg-white">
                    {file.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={file.previewUrl} alt="" className="h-full w-full object-cover" />
                    ) : file.type.startsWith("video/") ? (
                      <VideoIcon className="h-5 w-5 text-slate-500" aria-hidden="true" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-slate-500" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">{file.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatBytes(file.size)} - {file.type || "unknown"}</p>
                    <p className={`mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] ${file.accepted ? "text-emerald-700" : "text-rose-700"}`}>
                      {file.accepted ? "validated" : "blocked"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <PendingSubmitButton files={files} rejectedCount={rejectedCount} />
          <button type="button" onClick={resetSelection} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            retry selection
          </button>
          {rejectedCount ? <p className="text-sm text-rose-700">{rejectedCount} file type blocked before upload.</p> : null}
        </div>
      </div>
    </form>
  );
}
