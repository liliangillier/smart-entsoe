export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import axios from "axios";

/** Récupère Y-M-D-H-m en Europe/Paris (minute arrondie au quart d’heure) */
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

  const get = (t: string) => parts.find((p) => p.type === t)?.value!;
  const y = Number(get("year"));
  const m = Number(get("month"));
  const d = Number(get("day"));
  const h = Number(get("hour"));
  const miRaw = Number(get("minute"));

  // arrondi au quart d’heure inférieur
  const mi = Math.floor(miRaw / 15) * 15;

  // détection de l’offset via GMT+X
  const tzName = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+0";
  const match = tzName.match(/([+\-]\d{1,2})/);
  const offsetHours = match ? Number(match[1]) : 0;
  const offsetMinutes = offsetHours * 60;

  return { y, m, d, h, mi, offsetMinutes };
}

/** yyyyMMddHHmm (UTC) pour ENTSO-E */
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
    // ---- Étape 1 : Récupération des données du jour (A44) ----
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

    const resp = await axios.post(
      "http://localhost:3000/api/entsoe",
      { startDate, endDate, documentType },
      { timeout: 20000 }
    );

    const points: Array<{ timestamp: string; price: number }> =
      resp.data?.data ?? [];
    if (!Array.isArray(points) || points.length === 0) {
      return NextResponse.json(
        { error: "Aucune donnée disponible" },
        { status: 404, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // ---- Étape 2 : Détermination du quart d’heure courant Europe/Paris ----
    const { y, m, d, h, mi, offsetMinutes } = getParisYMDHM(now);

    // Conversion du slot Paris vers UTC
    const slotUtcMs =
      Date.UTC(y, m - 1, d, h, mi, 0, 0) - offsetMinutes * 60_000;
    const slotUtcISO = new Date(slotUtcMs).toISOString();

    // ---- Étape 3 : Matching sur le timestamp ENTSO-E ----
    const match =
      points.find((p) => p.timestamp === slotUtcISO) ??
      points.find(
        (p) => Math.abs(new Date(p.timestamp).getTime() - slotUtcMs) <= 60_000
      );

    if (!match) {
      return NextResponse.json(
        {
          error: "Slot courant introuvable",
          debug: { slotUtcISO, paris: { y, m, d, h, mi, offsetMinutes } },
        },
        { status: 502, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Slot local lisible
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

    // ---- Étape 4 : Enrichissement debug et sortie ----
    const prev = points.find(
      (p) => new Date(p.timestamp).getTime() === slotUtcMs - 15 * 60_000
    );
    const next = points.find(
      (p) => new Date(p.timestamp).getTime() === slotUtcMs + 15 * 60_000
    );

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
