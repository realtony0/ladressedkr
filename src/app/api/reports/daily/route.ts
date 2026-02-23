import { NextResponse } from "next/server";

import { requireStaffApiContext } from "@/lib/helpers/api-auth";
import { DEFAULT_RESTAURANT_ID } from "@/lib/supabase/env";
import { getServiceSupabase } from "@/lib/supabase/server";

function getUtcDayBounds() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
  return { start, end };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-SN", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(value);
}

async function sendEmail(subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REPORT_EMAIL_FROM;
  const to = process.env.REPORT_EMAIL_TO;

  if (!apiKey || !from || !to) {
    return { sent: false, reason: "Email env vars missing" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    return { sent: false, reason: `Resend error ${response.status}` };
  }

  return { sent: true };
}

async function sendWhatsapp(text: string) {
  const webhook = process.env.WHATSAPP_WEBHOOK_URL;
  if (!webhook) {
    return { sent: false, reason: "WHATSAPP_WEBHOOK_URL missing" };
  }

  const response = await fetch(webhook, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
    }),
  });

  if (!response.ok) {
    return { sent: false, reason: `Webhook error ${response.status}` };
  }

  return { sent: true };
}

async function buildDailyReport(restaurantId: string) {
  const supabase = getServiceSupabase();
  if (!supabase) {
    throw new Error("Supabase non configuré");
  }

  const { start, end } = getUtcDayBounds();

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, total")
    .eq("restaurant_id", restaurantId)
    .gte("heure", start.toISOString())
    .lte("heure", end.toISOString());

  if (ordersError) {
    throw ordersError;
  }

  const orderIds = (orders ?? []).map((order) => order.id);

  const [{ data: orderItems }, { data: ratings }] = await Promise.all([
    orderIds.length
      ? supabase
          .from("order_items")
          .select("quantite, item:items(nom)")
          .in("order_id", orderIds)
      : Promise.resolve({ data: [] }),
    orderIds.length ? supabase.from("ratings").select("note").in("order_id", orderIds) : Promise.resolve({ data: [] }),
  ]);

  const revenue = (orders ?? []).reduce((sum, order) => sum + order.total, 0);
  const orderCount = orders?.length ?? 0;
  const avgTicket = orderCount > 0 ? revenue / orderCount : 0;

  const topMap = new Map<string, number>();
  (orderItems ?? []).forEach((line) => {
    const itemName = (line.item as { nom?: string } | null)?.nom;
    if (!itemName) {
      return;
    }
    topMap.set(itemName, (topMap.get(itemName) ?? 0) + line.quantite);
  });

  const topItems = [...topMap.entries()].sort((left, right) => right[1] - left[1]).slice(0, 3);

  const avgRating =
    (ratings ?? []).length > 0
      ? (ratings ?? []).reduce((sum, row) => sum + row.note, 0) / (ratings?.length ?? 1)
      : 0;

  return {
    start,
    end,
    revenue,
    orderCount,
    avgTicket,
    avgRating,
    topItems,
  };
}

function reportText(report: Awaited<ReturnType<typeof buildDailyReport>>) {
  const date = report.start.toISOString().slice(0, 10);
  const top = report.topItems.length
    ? report.topItems.map(([name, qty]) => `${name} (${qty})`).join(" · ")
    : "Aucune vente enregistrée";

  return [
    `Rapport L'Adresse Dakar - ${date}`,
    `CA: ${formatNumber(report.revenue)}`,
    `Commandes: ${report.orderCount}`,
    `Ticket moyen: ${formatNumber(report.avgTicket)}`,
    `Note moyenne: ${report.avgRating.toFixed(2)}/5`,
    `Top ventes: ${top}`,
  ].join("\n");
}

function reportHtml(text: string) {
  return `<pre style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; line-height: 1.5;">${text}</pre>`;
}

function isCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return false;
  }
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

async function resolveRestaurantId(request: Request) {
  if (isCronAuthorized(request)) {
    if (!DEFAULT_RESTAURANT_ID) {
      throw new Error("NEXT_PUBLIC_DEFAULT_RESTAURANT_ID missing for cron daily report.");
    }
    return DEFAULT_RESTAURANT_ID;
  }

  const context = await requireStaffApiContext(["admin", "proprio"]);
  if (context instanceof NextResponse) {
    return context;
  }

  return context.restaurantId;
}

async function handle(request: Request) {
  const restaurantId = await resolveRestaurantId(request);
  if (restaurantId instanceof NextResponse) {
    return restaurantId;
  }

  const report = await buildDailyReport(restaurantId);
  const text = reportText(report);

  const [emailResult, whatsappResult] = await Promise.all([
    sendEmail(`Rapport journalier L'Adresse Dakar - ${report.start.toISOString().slice(0, 10)}`, reportHtml(text)),
    sendWhatsapp(text),
  ]);

  return {
    report,
    delivery: {
      email: emailResult,
      whatsapp: whatsappResult,
    },
  };
}

export async function POST(request: Request) {
  try {
    const payload = await handle(request);
    if (payload instanceof NextResponse) {
      return payload;
    }
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const payload = await handle(request);
    if (payload instanceof NextResponse) {
      return payload;
    }
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
