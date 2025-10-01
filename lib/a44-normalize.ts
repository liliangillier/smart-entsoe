// lib/a44-normalize.ts

export type Row = Record<string, unknown>;

/* --- Formatters Europe/Paris --- */
const dfParisDate = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dfParisTime = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/* --- Helpers --- */
const parseResolutionMinutes = (res: unknown): number => {
  if (typeof res !== "string") return 15;
  const m = /^PT(\d+)M$/i.exec(res);
  return m ? parseInt(m[1], 10) : 15;
};

const toDate = (v: unknown): Date | null => {
  if (v instanceof Date) return v;
  if (typeof v === "string") {
    const d = new Date(v); // gère 'Z' (UTC) nativement
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

/**
 * Instant UTC robuste:
 *   timeStart + (position-1) * resolution
 *   fallback: timestamp (si fourni par la source)
 */
export function getUtcInstantFromRow(row: Row): Date | null {
  const t0 = toDate(row.timeStart);
  const pos = Number(row.position);
  if (t0 && Number.isFinite(pos)) {
    const step = parseResolutionMinutes(row.resolution);
    return new Date(t0.getTime() + (pos - 1) * step * 60_000);
  }
  return toDate(row.timestamp); // fallback si pas de triplet timeStart/position/resolution
}

/**
 * Normalise les lignes ENTSO-E A44 en:
 *   - timestamp  : "YYYY-MM-DD HH:mm" (Europe/Paris, secondes=00)
 *   - date       : "YYYY-MM-DD"       (Europe/Paris)
 *   - heure      : "HH:mm"            (Europe/Paris)
 * On conserve toutes les autres colonnes d’origine.
 */
export function normalizeA44(rows: Row[]) {
  return rows.map((row) => {
    const instUtc = getUtcInstantFromRow(row);

    let dateStr = "-";
    let heureStr = "-";
    let timestampStr: string | null = null;

    if (instUtc) {
      // Force secondes/millis à 00 puis formate Europe/Paris
      const local = new Date(instUtc.getTime());
      local.setSeconds(0, 0);

      const dParts = dfParisDate.formatToParts(local);
      const year = dParts.find((p) => p.type === "year")?.value ?? "1970";
      const month = (
        dParts.find((p) => p.type === "month")?.value ?? "01"
      ).padStart(2, "0");
      const day = (
        dParts.find((p) => p.type === "day")?.value ?? "01"
      ).padStart(2, "0");

      dateStr = `${year}-${month}-${day}`;
      heureStr = dfParisTime.format(local); // HH:mm
      timestampStr = `${dateStr} ${heureStr}`;
    }

    return {
      ...row,
      // Champs d’affichage normalisés
      date: dateStr,
      heure: heureStr,
      timestamp: timestampStr, // colonne unique “horodatage” propre
    };
  });
}
