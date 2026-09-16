"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { translator, type Messages } from "@/lib/i18n";

const SIZE = 256;

/** Reduce la imagen a un cuadrado de 256 px en JPEG (data URL) en el navegador. */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("img"));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ProfileEditor({ messages, name, avatar, email }: { messages: Messages; name: string; avatar: string | null; email: string }) {
  const tr = translator(messages);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [photo, setPhoto] = useState<string | null>(avatar);
  const [photoChanged, setPhotoChanged] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      setPhoto(await shrink(file));
      setPhotoChanged(true);
    } catch {
      setError("profile2.errPhoto");
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: String(data.get("name") ?? "").trim(), ...(photoChanged ? { avatar: photo } : {}) }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && body.ok) {
        setSaved(true);
        setOpen(false);
        setPhotoChanged(false);
        router.refresh();
      } else setError(body.error ?? "formErrors.generic");
    } catch {
      setError("formErrors.generic");
    } finally {
      setBusy(false);
    }
  }

  const initial = (name || email).slice(0, 1).toUpperCase();
  const field = "w-full rounded-[12px] border border-line bg-surface-2 px-3.5 py-3 text-[15px] text-ink placeholder:text-faint focus:border-accent focus:outline-none";

  if (!open) {
    return (
      <div className="mt-3 flex flex-col items-center gap-1">
        <button type="button" onClick={() => { setOpen(true); setSaved(false); }} className="text-[13px] font-medium text-accent underline underline-offset-4">{tr("profile2.edit")}</button>
        {saved && <p className="text-[12px] text-accent">{tr("profile2.saved")}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 w-full rounded-card border border-line bg-surface p-5 text-left">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface-2 text-[24px] font-semibold text-accent">
          {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : initial}
        </div>
        <div className="grid gap-1.5">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="rounded-[10px] border border-line bg-surface-2 px-3 py-1.5 text-[13px] font-semibold text-ink hover:border-faint">{tr("profile2.photoChange")}</button>
            {photo && <button type="button" onClick={() => { setPhoto(null); setPhotoChanged(true); }} className="rounded-[10px] px-3 py-1.5 text-[13px] font-medium text-muted hover:text-ink">{tr("profile2.photoRemove")}</button>}
          </div>
          <p className="text-[11.5px] text-faint">{tr("profile2.photoHelp")}</p>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        </div>
      </div>
      <label className="mt-4 block text-[13px] font-medium text-ink" htmlFor="profile-name">{tr("profile2.name")}</label>
      <input id="profile-name" name="name" defaultValue={name} maxLength={60} minLength={2} required placeholder={tr("profile2.namePlaceholder")} className={"mt-1.5 " + field} />
      {error && <p role="alert" className="mt-2 text-[12.5px] text-danger">{tr(error)}</p>}
      <div className="mt-4 flex items-center gap-3">
        <button type="submit" disabled={busy} className="rounded-[12px] bg-accent px-4 py-2.5 text-[14px] font-semibold text-black hover:opacity-90 disabled:opacity-60">{busy ? tr("profile2.saving") : tr("profile2.save")}</button>
        <button type="button" onClick={() => { setOpen(false); setPhoto(avatar); setPhotoChanged(false); }} className="text-[14px] font-medium text-muted hover:text-ink">{tr("profile2.cancel")}</button>
      </div>
    </form>
  );
}
