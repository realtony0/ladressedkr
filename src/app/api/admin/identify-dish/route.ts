import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import { requireStaffApiContext } from "@/lib/helpers/api-auth";
// eslint-disable-next-line @typescript-eslint/no-unused-vars

export async function POST(request: Request) {
  const ctx = await requireStaffApiContext(["admin", "proprio"]);
  if (ctx instanceof NextResponse) return ctx;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY non configuré" }, { status: 501 });
  }

  let body: { imageBase64: string; mimeType: string; dishes: { id: string; nom: string; categorie: string }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const { imageBase64, mimeType, dishes } = body;
  if (!imageBase64 || !dishes?.length) {
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
  }

  const dishList = dishes
    .map((d, i) => `${i + 1}. [${d.categorie}] ${d.nom}`)
    .join("\n");

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 100,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType as "image/jpeg" | "image/png" | "image/webp",
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: `Tu es un assistant pour un restaurant. Voici la liste des plats du menu :\n\n${dishList}\n\nRegarde la photo et réponds UNIQUEMENT avec le numéro du plat le plus probable (juste le chiffre, rien d'autre). Si tu n'es pas sûr, réponds 0.`,
          },
        ],
      },
    ],
  });

  const text = (response.content[0] as { type: string; text: string }).text.trim();
  const index = parseInt(text, 10);

  if (!index || index < 1 || index > dishes.length) {
    return NextResponse.json({ dishId: null });
  }

  return NextResponse.json({ dishId: dishes[index - 1].id });
}
