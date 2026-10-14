"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFlash } from "@/components/admin/flash";
import { inputCls, labelCls } from "@/components/admin/action-form";

export function PhotoUpload({ slug, hasImage, defaultAlt }: { slug: string; hasImage: boolean; defaultAlt: string }) {
  const router = useRouter();
  const flash = useFlash();
  const fileRef = useRef<HTMLInputElement>(null);
  const [alt, setAlt] = useState(defaultAlt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return setError("Choose an image file first.");
    if (file.size > 1_500_000) return setError("That image is over 1.5 MB. Please use a smaller one.");
    setBusy(true); setError(null);
    const fd = new FormData();
    fd.set("file", file); fd.set("serviceSlug", slug); fd.set("alt", alt);
    try {
      const res = await fetch("/api/admin/media", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (res.ok) { flash({ ok: true, message: "Photo saved." }); if (fileRef.current) fileRef.current.value = ""; router.refresh(); }
      else setError(body.message ?? "Upload failed. Nothing was changed.");
    } catch { setError("Network problem. Nothing was changed."); }
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      <div><label className={labelCls} htmlFor="photo-file">{hasImage ? "Replace photo" : "Upload photo"}</label><input id="photo-file" ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-sage-200 file:px-3 file:py-2 file:text-sm file:font-semibold" /></div>
      <div><label className={labelCls} htmlFor="photo-alt">Description for screen readers</label><input id="photo-alt" value={alt} maxLength={200} onChange={(e) => setAlt(e.target.value)} placeholder="e.g. Cleaner polishing a kitchen counter" className={inputCls} /></div>
      <Button size="sm" onClick={upload} disabled={busy} aria-busy={busy}>{busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} {hasImage ? "Replace" : "Upload"}</Button>
      {error ? <p role="alert" className="text-sm font-medium text-danger">{error}</p> : null}
    </div>
  );
}
