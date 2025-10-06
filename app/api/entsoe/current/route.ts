export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { headers } from "next/headers";

/** Europe/Paris → Y-M-D-H-m (minute arrondie au quart d’heure) + offset minutes */
function getParisYMDHM(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).formatToParts(now);

  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const y = Number(get("year"));
  const m = Number(get("month"));
  const d = Number(get("day"));
  const h = Number(get("hour"));
  const miRaw = Number(get("minute"));
  const mi = Math.floor(miRaw / 15) * 15;

  const tzName = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+0";
  const match = tzName.match(/([+\-]\d{1,2})/);
  const offsetMinutes = (match ? Number(match[1]) : 0) * 60;

  return { y, m, d, h, mi, offsetMinutes };
}

/** yyyyMMddHHmm (UTC) attendu par ENTSO-E */
function toEntsoeUTC(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes())
  );
}

export async function GET() {
  try {
    // Fenêtre jour UTC [00:00 → +1j 00:00]
    const now = new Date();
    const dayStartUTC = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0
      )
    );
    const nextDayUTC = new Date(dayStartUTC.getTime() + 24 * 3600_000);

    const startDate = toEntsoeUTC(dayStartUTC);
    const endDate = toEntsoeUTC(nextDayUTC);
    const documentType = "A44";

    // Origin dynamique (local/prod)
    const h = await headers(); // 👈 IMPORTANT
    const host =
      h.get("x-forwarded-host") ??
      h.get("host") ??
      process.env.VERCEL_URL ??
      "localhost:3000";
    const proto =
      h.get("x-forwarded-proto") ??
      (host.startsWith("localhost") ? "http" : "https");
    const origin = `${proto}://${host}`;

    // Appel de ta route POST /api/entsoe (proxy sécurisé)
    const respFetch = await fetch(`${origin}/api/entsoe`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ startDate, endDate, documentType }),
      cache: "no-store",
    });

    if (!respFetch.ok) {
      const body = await respFetch.text().catch(() => "");
      return NextResponse.json(
        { error: "Upstream /api/entsoe KO", status: respFetch.status, body },
        { status: 502, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const upstream = await respFetch.json();
    const points: Array<{ timestamp: string; price: number }> =
      upstream?.data ?? [];
    if (!Array.isArray(points) || points.length === 0) {
      return NextResponse.json(
        { error: "Aucune donnée disponible" },
        { status: 404, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Slot courant Europe/Paris → UTC
    const { y, m, d, h: hh, mi, offsetMinutes } = getParisYMDHM(now);
    const slotUtcMs =
      Date.UTC(y, m - 1, d, hh, mi, 0, 0) - offsetMinutes * 60_000;
    const slotUtcISO = new Date(slotUtcMs).toISOString();

    // Matching strict puis tolérance ±60s
    const match =
      points.find((p) => p.timestamp === slotUtcISO) ??
      points.find(
        (p) => Math.abs(new Date(p.timestamp).getTime() - slotUtcMs) <= 60_000
      );

    if (!match) {
      return NextResponse.json(
        {
          error: "Slot courant introuvable",
          slotUtcISO,
          paris: { y, m, d, hh, mi, offsetMinutes },
        },
        { status: 502, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Lisible en Europe/Paris
    const slotLocal = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .format(new Date(slotUtcMs))
      .replace(" ", "T");

    const prev =
      points.find(
        (p) => new Date(p.timestamp).getTime() === slotUtcMs - 15 * 60_000
      ) ?? null;
    const next =
      points.find(
        (p) => new Date(p.timestamp).getTime() === slotUtcMs + 15 * 60_000
      ) ?? null;

    return NextResponse.json(
      {
        now_local_paris: new Intl.DateTimeFormat("sv-SE", {
          timeZone: "Europe/Paris",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hourCycle: "h23",
        })
          .format(new Date())
          .replace(" ", "T"),
        slot_local_paris: `${slotLocal} (Europe/Paris)`,
        slot_utc: slotUtcISO,
        matched_delta_minutes: Math.round(
          Math.abs(new Date(match.timestamp).getTime() - slotUtcMs) / 60000
        ),
        price_eur_per_mwh: Number(match.price.toFixed(2)),
        price_eur_per_kwh: Number((match.price / 1000).toFixed(5)),
        context: { prev, curr: match, next },
      },
      { headers: { "Access-Control-Allow-Origin": "*" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: "Erreur /entsoe/current", message: e?.message ?? String(e) },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
