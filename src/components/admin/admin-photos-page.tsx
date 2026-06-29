"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/common/button";
import { PageShell } from "@/components/layout/page-shell";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { useNotifications } from "@/providers/notifications-provider";
import type { MenuItem } from "@/types/domain";

interface PhotoSlot {
  file: File;
  preview: string;
  itemId: string;
  status: "idle" | "uploading" | "done" | "error";
  errorMsg?: string;
}

export function AdminPhotosPage() {
  const { notifyError, notifySuccess } = useNotifications();
  const inputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<MenuItem[]>([]);
  const [slots, setSlots] = useState<PhotoSlot[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    supabase
      .from("items")
      .select("*")
      .order("nom", { ascending: true })
      .then(({ data }) => {
        if (data) setItems(data as MenuItem[]);
      });
  }, []);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const newSlots: PhotoSlot[] = Array.from(files).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      itemId: "",
      status: "idle",
    }));
    setSlots((prev) => [...prev, ...newSlots]);
  }

  function setItemId(index: number, itemId: string) {
    setSlots((prev) =>
      prev.map((slot, i) => (i === index ? { ...slot, itemId } : slot)),
    );
  }

  function removeSlot(index: number) {
    setSlots((prev) => {
      const removed = prev[index];
      URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function uploadAll() {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      notifyError("Erreur", "Supabase non configuré.");
      return;
    }

    const toUpload = slots.filter((s) => s.itemId && s.status !== "done");
    if (toUpload.length === 0) {
      notifyError("Rien à uploader", "Associe chaque photo à un plat.");
      return;
    }

    setUploading(true);

    for (const slot of toUpload) {
      const index = slots.findIndex((s) => s.file === slot.file);
      setSlots((prev) =>
        prev.map((s, i) => (i === index ? { ...s, status: "uploading" } : s)),
      );

      try {
        const ext = (slot.file.name.split(".").pop() ?? "jpg").toLowerCase();
        const path = `${slot.itemId}-${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("dish-photos")
          .upload(path, slot.file, { upsert: true, contentType: slot.file.type });

        if (uploadError) throw new Error(uploadError.message);

        const { data } = supabase.storage.from("dish-photos").getPublicUrl(path);

        const { error: updateError } = await supabase
          .from("items")
          .update({ photo: data.publicUrl })
          .eq("id", slot.itemId);

        if (updateError) throw new Error(updateError.message);

        setSlots((prev) =>
          prev.map((s, i) => (i === index ? { ...s, status: "done" } : s)),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur inconnue";
        setSlots((prev) =>
          prev.map((s, i) => (i === index ? { ...s, status: "error", errorMsg: msg } : s)),
        );
      }
    }

    setUploading(false);
    notifySuccess("Upload terminé", `${toUpload.length} photo(s) traitée(s).`);
  }

  const allAssigned = slots.length > 0 && slots.every((s) => s.itemId);
  const doneCount = slots.filter((s) => s.status === "done").length;

  return (
    <PageShell
      title="Photos des plats"
      subtitle="Sélectionne toutes tes photos, associe chaque photo à son plat, puis clique Tout uploader."
    >
      {/* Drop zone / file picker */}
      <div
        className="mb-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--color-sage)] bg-[#f7faf7] py-10 transition-colors hover:bg-[#eef4ee]"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
      >
        <span className="text-4xl">📸</span>
        <p className="mt-3 text-sm font-semibold text-[var(--color-dark-green)]">
          Clique ici ou glisse tes photos
        </p>
        <p className="mt-1 text-xs text-[var(--color-black)]/50">
          Tu peux en sélectionner plusieurs à la fois
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

      {/* Photo slots */}
      {slots.length > 0 ? (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {slots.map((slot, index) => (
              <div
                key={index}
                className={`relative overflow-hidden rounded-2xl border bg-white shadow-sm ${
                  slot.status === "done"
                    ? "border-[var(--color-dark-green)]"
                    : slot.status === "error"
                      ? "border-red-400"
                      : "border-[var(--color-light-gray)]"
                }`}
              >
                {/* Status badge */}
                {slot.status === "done" && (
                  <span className="absolute right-2 top-2 z-10 rounded-full bg-[var(--color-dark-green)] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                    ✓ Uploadé
                  </span>
                )}
                {slot.status === "uploading" && (
                  <span className="absolute right-2 top-2 z-10 rounded-full bg-[var(--color-gold)] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                    ↑ En cours…
                  </span>
                )}
                {slot.status === "error" && (
                  <span className="absolute right-2 top-2 z-10 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                    ✗ Erreur
                  </span>
                )}

                {/* Preview */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={slot.preview}
                  alt="aperçu"
                  className="h-44 w-full object-cover"
                />

                <div className="p-3">
                  <select
                    value={slot.itemId}
                    onChange={(e) => setItemId(index, e.target.value)}
                    disabled={slot.status === "done" || slot.status === "uploading"}
                    className="w-full rounded-xl border border-[var(--color-light-gray)] bg-white px-3 py-2 text-sm text-[var(--color-dark-green)] focus:border-[var(--color-sage)] focus:outline-none"
                  >
                    <option value="">— Choisir le plat —</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nom}
                      </option>
                    ))}
                  </select>

                  {slot.status === "error" && (
                    <p className="mt-1 text-xs text-red-500">{slot.errorMsg}</p>
                  )}

                  {slot.status !== "done" && (
                    <button
                      type="button"
                      onClick={() => removeSlot(index)}
                      className="mt-2 text-xs text-[var(--color-black)]/40 hover:text-red-500"
                    >
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-[var(--color-black)]/60">
              {doneCount}/{slots.length} photos uploadées
            </p>
            <Button
              type="button"
              onClick={uploadAll}
              disabled={uploading || !allAssigned}
              className="px-8"
            >
              {uploading ? "Upload en cours…" : `Tout uploader (${slots.filter((s) => s.itemId && s.status !== "done").length})`}
            </Button>
          </div>
        </>
      ) : null}
    </PageShell>
  );
}
