"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/common/button";
import { PageShell } from "@/components/layout/page-shell";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { useNotifications } from "@/providers/notifications-provider";
import type { MenuItem } from "@/types/domain";

interface DishOption {
  id: string;
  nom: string;
  categorie: string;
}

interface PhotoSlot {
  file: File;
  preview: string;
  itemId: string;
  status: "idle" | "identifying" | "uploading" | "done" | "error";
  errorMsg?: string;
}

async function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function identifyDish(file: File, dishes: DishOption[]): Promise<string | null> {
  try {
    const imageBase64 = await toBase64(file);
    const mimeType = file.type || "image/jpeg";
    const response = await fetch("/api/admin/identify-dish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64, mimeType, dishes }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.dishId ?? null;
  } catch {
    return null;
  }
}

export function AdminPhotosPage() {
  const { notifyError, notifySuccess } = useNotifications();
  const inputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<MenuItem[]>([]);
  const [dishes, setDishes] = useState<DishOption[]>([]);
  const [slots, setSlots] = useState<PhotoSlot[]>([]);
  const [uploading, setUploading] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    supabase
      .from("items")
      .select("id, nom, categorie_id")
      .order("nom", { ascending: true })
      .then(({ data }) => {
        if (data) {
          setItems(data as MenuItem[]);
          setDishes(
            (data as { id: string; nom: string; categorie_id: string }[]).map((d) => ({
              id: d.id,
              nom: d.nom,
              categorie: d.categorie_id,
            })),
          );
        }
      });

    fetch("/api/admin/identify-dish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageBase64: "", mimeType: "image/jpeg", dishes: [] }) })
      .then((r) => setAiAvailable(r.status !== 501))
      .catch(() => setAiAvailable(false));
  }, []);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const newSlots: PhotoSlot[] = Array.from(files).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      itemId: "",
      status: aiAvailable ? "identifying" : "idle",
    }));

    setSlots((prev) => [...prev, ...newSlots]);

    if (aiAvailable && dishes.length > 0) {
      for (let i = 0; i < newSlots.length; i++) {
        const slot = newSlots[i];
        const globalIndex = slots.length + i;
        const dishId = await identifyDish(slot.file, dishes);
        setSlots((prev) =>
          prev.map((s, idx) =>
            idx === globalIndex
              ? { ...s, itemId: dishId ?? "", status: "idle" }
              : s,
          ),
        );
      }
    }
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
      notifyError("Rien à uploader", "Associe chaque photo à un plat d'abord.");
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

  const pendingCount = slots.filter((s) => s.itemId && s.status !== "done").length;
  const doneCount = slots.filter((s) => s.status === "done").length;
  const identifyingCount = slots.filter((s) => s.status === "identifying").length;

  return (
    <PageShell
      title="Photos des plats"
      subtitle={
        aiAvailable
          ? "Sélectionne tes photos — le site identifie le plat automatiquement. Vérifie puis clique Tout uploader."
          : "Sélectionne tes photos, choisis le plat pour chacune, puis clique Tout uploader."
      }
    >
      {aiAvailable === false && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
          <strong>Identification automatique désactivée.</strong> Pour l&apos;activer, ajoute la variable <code className="font-mono bg-amber-100 px-1 rounded">ANTHROPIC_API_KEY</code> dans tes variables d&apos;environnement Vercel.
        </div>
      )}

      {/* Drop zone */}
      <div
        className="mb-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--color-sage)] bg-[#f7faf7] py-10 transition-colors hover:bg-[#eef4ee]"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void handleFiles(e.dataTransfer.files);
        }}
      >
        <span className="text-4xl">📸</span>
        <p className="mt-3 text-sm font-semibold text-[var(--color-dark-green)]">
          {aiAvailable
            ? "Clique ou glisse tes photos — identification automatique"
            : "Clique ici ou glisse tes photos"}
        </p>
        <p className="mt-1 text-xs text-[var(--color-black)]/50">
          Sélectionne plusieurs photos à la fois
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>

      {identifyingCount > 0 && (
        <p className="mb-4 text-sm text-[var(--color-sage)] font-semibold animate-pulse">
          ✨ Identification en cours pour {identifyingCount} photo(s)…
        </p>
      )}

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
                      : slot.status === "identifying"
                        ? "border-[var(--color-gold)]"
                        : "border-[var(--color-light-gray)]"
                }`}
              >
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
                {slot.status === "identifying" && (
                  <span className="absolute right-2 top-2 z-10 rounded-full bg-[var(--color-gold)] px-2 py-0.5 text-[10px] font-bold uppercase text-white animate-pulse">
                    ✨ Identification…
                  </span>
                )}
                {slot.status === "error" && (
                  <span className="absolute right-2 top-2 z-10 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                    ✗ Erreur
                  </span>
                )}

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
                    disabled={slot.status === "done" || slot.status === "uploading" || slot.status === "identifying"}
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
              onClick={() => void uploadAll()}
              disabled={uploading || pendingCount === 0 || identifyingCount > 0}
              className="px-8"
            >
              {uploading
                ? "Upload en cours…"
                : identifyingCount > 0
                  ? "Identification en cours…"
                  : `Tout uploader (${pendingCount})`}
            </Button>
          </div>
        </>
      ) : null}
    </PageShell>
  );
}
