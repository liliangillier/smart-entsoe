// lib/excel-export.ts
import * as XLSX from "xlsx";
import { getUtcInstantFromRow, Row } from "./a44-normalize";

/** Export générique simple (conservé) */
export function exportToExcel(data: any[], fileName: string) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  const range = XLSX.utils.decode_range(ws["!ref"] as string);
  ws["!autofilter"] = { ref: XLSX.utils.encode_range(range) };
  ws["!cols"] = autosizeColumns(ws);
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, ensureXlsx(fileName));
}

/** Export ENTSO-E A44 propre (FR, formats Excel natifs) */
export function exportEntsoeA44ToExcel(raw: Row[], fileName: string) {
  if (!raw?.length) return;

  const rows = buildA44Rows(raw); // garde la même construction y/m/d + hh:mm

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["Horodatage", "€/MWh", "Devise", "Unité prix"],
  ]);

  rows.forEach((r, i) => {
    const rIdx = i + 2;
    const datetimeSerial = r.dateSerial + r.timeSerial; // ← fusion
    setCellNumber(ws, rIdx, 1, datetimeSerial, "yyyy-mm-dd hh:mm");
    setCellNumber(ws, rIdx, 2, r.price, "0.00");
    setCellText(ws, rIdx, 3, r.currency);
    setCellText(ws, rIdx, 4, r.priceUnit);
  });

  const ref = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: rows.length + 1, c: 3 },
  });
  ws["!ref"] = ref;
  ws["!autofilter"] = { ref };
  ws["!cols"] = autosizeColumns(ws, [20, 10, 8, 12]);

  XLSX.utils.book_append_sheet(wb, ws, "ENTSO-E A44 (FR)");
  XLSX.writeFile(wb, ensureXlsx(fileName));
}

/* ---------- A44 helpers ---------- */

type A44Row = {
  dateSerial: number; // jour Excel
  timeSerial: number; // fraction Excel
  price: number | null;
  currency: string;
  priceUnit: string;
};

function buildA44Rows(raw: Row[]): A44Row[] {
  return raw.map((row) => {
    const instUtc = getUtcInstantFromRow(row);
    const parts = instUtc
      ? toParisParts(instUtc)
      : { y: 1970, m: 1, d: 1, hh: 0, mm: 0 };
    const dateSerial = excelDateSerial(parts.y, parts.m, parts.d);
    const timeSerial = (parts.hh * 60 + parts.mm) / 1440;
    return {
      dateSerial,
      timeSerial,
      price: toNumber(row.price),
      currency: String(row.currencyUnit ?? "EUR"),
      priceUnit: String(row.priceMeasureUnit ?? "MWH"),
    };
  });
}

function toParisParts(utcDate: Date): {
  y: number;
  m: number;
  d: number;
  hh: number;
  mm: number;
} {
  const dfDate = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dfTime = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const dp = dfDate.formatToParts(utcDate);
  const tp = dfTime.formatToParts(utcDate);
  const y = Number(dp.find((p) => p.type === "year")?.value ?? "1970");
  const m = Number(dp.find((p) => p.type === "month")?.value ?? "01");
  const d = Number(dp.find((p) => p.type === "day")?.value ?? "01");
  const hh = Number(tp.find((p) => p.type === "hour")?.value ?? "00");
  const mm = Number(tp.find((p) => p.type === "minute")?.value ?? "00");
  return { y, m, d, hh, mm };
}

function excelDateSerial(y: number, m: number, d: number): number {
  const msPerDay = 86400000;
  const epoch = Date.UTC(1899, 11, 30); // 1899-12-30
  const t = Date.UTC(y, m - 1, d);
  return (t - epoch) / msPerDay;
}

function toNumber(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* ---------- Sheet helpers ---------- */

function ensureXlsx(name: string) {
  return name.endsWith(".xlsx") ? name : `${name}.xlsx`;
}

function cell(ws: XLSX.WorkSheet, r: number, c: number): XLSX.CellObject {
  const addr = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 });
  let obj = ws[addr] as XLSX.CellObject | undefined;
  if (!obj) {
    obj = { t: "z" } as XLSX.CellObject;
    ws[addr] = obj;
  }
  return obj;
}

function setCellNumber(
  ws: XLSX.WorkSheet,
  r: number,
  c: number,
  v: number | null,
  z?: string
) {
  const cc = cell(ws, r, c);
  if (v == null) cc.t = "z";
  else {
    cc.t = "n";
    cc.v = v;
    if (z) cc.z = z;
  }
}

function setCellText(ws: XLSX.WorkSheet, r: number, c: number, v: string) {
  const cc = cell(ws, r, c);
  cc.t = "s";
  cc.v = v ?? "";
}

/** Auto-size colonnes (capées) */
function autosizeColumns(
  ws: XLSX.WorkSheet,
  minWidths: number[] = []
): { wch: number }[] {
  const ref = ws["!ref"];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const cols: number[] = new Array(range.e.c - range.s.c + 1).fill(0);

  for (let C = range.s.c; C <= range.e.c; ++C) {
    const header =
      (ws[XLSX.utils.encode_cell({ r: range.s.r, c: C })] as XLSX.CellObject)
        ?.v ?? "";
    cols[C - range.s.c] = Math.max(
      10,
      String(header).length + 2,
      minWidths[C - range.s.c] ?? 0
    );
  }
  for (let R = range.s.r + 1; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const v = (ws[addr] as XLSX.CellObject | undefined)?.v;
      const len =
        typeof v === "number" ? String(v).length : String(v ?? "").length;
      const idx = C - range.s.c;
      cols[idx] = Math.min(50, Math.max(cols[idx], len + 2));
    }
  }
  return cols.map((w) => ({ wch: w }));
}
