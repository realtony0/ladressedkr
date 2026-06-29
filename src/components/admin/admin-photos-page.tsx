"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/common/button";
import { PageShell } from "@/components/layout/page-shell";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { useNotifications } from "@/providers/notifications-provider";

interface UploadSlot {
  file: File;
  preview: string;
  status: "pending" | "uploading" | "done" | "error";
  errorMsg?: string;
}

function safeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9.]+/g, "-")
    .replace(/-+/g, "-");
}

export function AdminPhotosPage() {
  const { notifyError, notifySuccess } = useNotifications();
  const inputRef = useRef<HTMLInputElement>(null);

  const [slots, setSlots] = useState<UploadSlot[]>([]);
  const [uploading, setUploading] = useState(false);
  const [finished, setFinished] = useState(false);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const newSlots: UploadSlot[] = Array.from(files).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      status: "pending",
    }));
    setSlots((prev) => [...prev, ...newSlots]);
    setFinished(false);
  }

  async function uploadAll() {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      notifyError("Erreur", "Supabase non configuré.");
      return;
    }

    const pending = slots.filter((s) => s.status === "pending" || s.status === "error");
    if (pending.length === 0) return;

    setUploading(true);

    for (const slot of pending) {
      const index = slots.findIndex((s) => s.file === slot.file);
      setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, status: "uploading" } : s)));

      try {
        const stamp = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
        const path = `_staging/${stamp}-${safeName(slot.file.name)}`;

        const { error: uploadError } = await supabase.storage
          .from("dish-photos")
          .upload(path, slot.file, { upsert: true, contentType: slot.file.type });

        if (uploadError) throw new Error(uploadError.message);

        setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, status: "done" } : s)));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur inconnue";
        setSlots((prev) =>
          prev.map((s, i) => (i === index ? { ...s, status: "error", errorMsg: msg } : s)),
        );
      }
    }

    setUploading(false);
    setFinished(true);
    notifySuccess("Photos envoyées", `${pending.length} photo(s) déposée(s).`);
  }

  const doneCount = slots.filter((s) => s.status === "done").length;
  const pendingCount = slots.filter((s) => s.status === "pending" || s.status === "error").length;

  return (
    <PageShell
      title="Photos des plats"
      subtitle="Dépose ici toutes les photos d'un coup. Pas besoin de les trier — l'équipe technique associe chaque photo au bon plat ensuite."
    >
      {/* Drop zone */}
      <div
        className="mb-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--color-sage)] bg-[#f7faf7] py-12 transition-colors hover:bg-[#eef4ee]"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
      >
        <span className="text-5xl">📸</span>
        <p className="mt-4 text-base font-semibold text-[var(--color-dark-green)]">
          Choisir toutes mes photos
        </p>
        <p className="mt-1 text-xs text-[var(--color-black)]/50">
          Sélectionne autant de photos que tu veux, en une seule fois
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Confirmation banner */}
      {finished && pendingCount === 0 && doneCount > 0 && (
        <div className="mb-6 rounded-2xl border border-[var(--color-dark-green)] bg-[#eef4ee] p-5 text-center">
          <p className="text-lg font-bold text-[var(--color-dark-green)]">
            ✓ {doneCount} photo(s) envoyée(s) !
          </p>
          <p className="mt-1 text-sm text-[var(--color-black)]/70">
            C&apos;est tout pour toi. Les photos seront associées aux bons plats et
            apparaîtront automatiquement sur le menu.
          </p>
        </div>
      )}

      {/* Thumbnails */}
      {slots.length > 0 ? (
        <>
          <div className="mb-5 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {slots.map((slot, index) => (
              <div
                key={index}
                className={`relative overflow-hidden rounded-xl border bg-white ${
                  slot.status === "done"
                    ? "border-[var(--color-dark-green)]"
                    : slot.status === "error"
                      ? "border-red-400"
                      : "border-[var(--color-light-gray)]"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={slot.preview} alt="aperçu" className="h-24 w-full object-cover" />
                {slot.status === "done" && (
                  <span className="absolute inset-0 flex items-center justify-center bg-[var(--color-dark-green)]/35">
                    <span className="text-2xl text-white">✓</span>
                  </span>
                )}
                {slot.status === "uploading" && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <span className="text-xs font-bold text-white animate-pulse">↑</span>
                  </span>
                )}
                {slot.status === "error" && (
                  <span className="absolute bottom-0 inset-x-0 bg-red-500 py-0.5 text-center text-[9px] font-bold text-white">
                    erreur
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-[var(--color-black)]/60">
              {doneCount}/{slots.length} envoyées
            </p>
            <Button
              type="button"
              onClick={() => void uploadAll()}
              disabled={uploading || pendingCount === 0}
              className="px-8"
            >
              {uploading ? "Envoi en cours…" : `Envoyer ${pendingCount} photo(s)`}
            </Button>
          </div>
        </>
      ) : null}
    </PageShell>
  );
}
