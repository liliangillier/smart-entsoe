"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowUpDown } from "lucide-react";

import { Row, getUtcInstantFromRow } from "@/lib/a44-normalize";
import { exportEntsoeA44ToExcel } from "@/lib/excel-export";

type SortDir = "asc" | "desc" | null;

const CORE_COLS = new Set([
  "date",
  "position",
  "price",
  "currencyUnit",
  "priceMeasureUnit",
]);
const ADVANCED_COLS = new Set([
  "inDomain",
  "outDomain",
  "resourceProvider",
  "curveType",
  "businessType",
  "resolution",
  "timeStart",
  "timeEnd",
  "createdDateTime",
  "quantity",
  "quantityMeasureUnit",
  "documentType",
  "documentId",
  "resourceType",
]);

const HIDE_ALWAYS = new Set(["timestamp"]); // on masque le brut

const LABELS: Record<string, string> = {
  date: "Date",
  position: "Heure",
  price: "€/MWh",
  currencyUnit: "Devise",
  priceMeasureUnit: "Unité de prix",
  inDomain: "Dans la zone",
  outDomain: "Hors zone",
  resourceProvider: "Fournisseur",
  curveType: "Type de courbe",
  businessType: "Type affaire",
  resolution: "Résolution",
  timeStart: "Début (UTC)",
  timeEnd: "Fin (UTC)",
  createdDateTime: "Création (UTC)",
  quantity: "Quantité",
  quantityMeasureUnit: "Unité quantité",
  documentType: "Doc",
  documentId: "Doc ID",
  resourceType: "Type ressource",
};

const nf2 = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

function isNumeric(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
function toDate(v: unknown): Date | null {
  if (v instanceof Date) return v;
  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}
function normalizeString(v: unknown): string {
  return String(v ?? "").toLowerCase();
}

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

const RENDERERS: Record<string, (row: Row) => string> = {
  // Date locale Europe/Paris (YYYY-MM-DD) depuis instant reconstruit
  date: (row) => {
    const inst = getUtcInstantFromRow(row);
    if (!inst) return String(row.date ?? "-");
    const parts = dfDate.formatToParts(inst);
    const y = parts.find((p) => p.type === "year")?.value ?? "0000";
    const m = (parts.find((p) => p.type === "month")?.value ?? "00").padStart(
      2,
      "0"
    );
    const d = (parts.find((p) => p.type === "day")?.value ?? "00").padStart(
      2,
      "0"
    );
    return `${y}-${m}-${d}`;
  },
  // Heure locale Europe/Paris (HH:mm) depuis instant reconstruit
  position: (row) => {
    const inst = getUtcInstantFromRow(row);
    if (!inst) {
      // fallback sur index si besoin
      const v = row.position;
      if (isNumeric(v)) {
        const step = 15;
        const minutes = (v - 1) * step;
        const h = String(Math.floor(minutes / 60)).padStart(2, "0");
        const m = String(minutes % 60).padStart(2, "0");
        return `${h}:${m}`;
      }
      return String(v ?? "-");
    }
    return dfTime.format(inst);
  },
  price: (row) =>
    isNumeric(row.price) ? nf2.format(row.price as number) : "-",
  quantity: (row) =>
    isNumeric(row.quantity) ? nf2.format(row.quantity as number) : "-",
};

interface DataTableProps<T extends Row = Row> {
  data: T[];
  itemsPerPage?: number;
  fileName?: string;
}

export function DataTable<T extends Row = Row>({
  data,
  itemsPerPage = 10,
  fileName = "ENTSOE_A44_FR.xlsx",
}: DataTableProps<T>) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  const columns = useMemo(() => {
    if (!data?.length) return [] as string[];
    const all = Object.keys(data[0]).filter((c) => !HIDE_ALWAYS.has(c));
    return all.filter((c) => {
      if (CORE_COLS.has(c)) return true;
      if (ADVANCED_COLS.has(c)) return showAdvanced;
      return showAdvanced; // autres -> avancé
    });
  }, [data, showAdvanced]);

  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const toggleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
      setCurrentPage(1);
      return;
    }
    setSortDir((prev) =>
      prev === "asc" ? "desc" : prev === "desc" ? null : "asc"
    );
    setCurrentPage(1);
  };

  // Filtrage (sur colonnes visibles, valeurs brutes)
  const filtered = useMemo(() => {
    if (!debouncedQuery) return data;
    const q = debouncedQuery.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => normalizeString(row[col]).includes(q))
    );
  }, [data, debouncedQuery, columns]);

  // Tri (date/heure triées sur instant reconstruit)
  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      if (sortKey === "date" || sortKey === "position") {
        const ia = getUtcInstantFromRow(a);
        const ib = getUtcInstantFromRow(b);
        const cmp = (ia?.getTime() ?? 0) - (ib?.getTime() ?? 0);
        return sortDir === "asc" ? cmp : -cmp;
      }
      const va = a[sortKey];
      const vb = b[sortKey];
      const da = toDate(va);
      const db = toDate(vb);
      if (da && db) {
        const cmp = da.getTime() - db.getTime();
        return sortDir === "asc" ? cmp : -cmp;
      }
      if (isNumeric(va) && isNumeric(vb)) {
        const cmp = (va as number) - (vb as number);
        return sortDir === "asc" ? cmp : -cmp;
      }
      const sa = normalizeString(va);
      const sb = normalizeString(vb);
      const cmp = sa.localeCompare(sb, "fr");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  // Pagination
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const endIndex = Math.min(total, startIndex + itemsPerPage);
  const pageRows = useMemo(
    () => sorted.slice(startIndex, endIndex),
    [sorted, startIndex, endIndex]
  );

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  const paginationItems: (number | "ellipsis")[] = useMemo(() => {
    const items: (number | "ellipsis")[] = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) items.push(i);
    } else if (safePage <= 3) {
      for (let i = 1; i <= 5; i++) items.push(i);
      items.push("ellipsis", totalPages);
    } else if (safePage >= totalPages - 2) {
      items.push(1, "ellipsis");
      for (let i = totalPages - 4; i <= totalPages; i++) items.push(i);
    } else {
      items.push(
        1,
        "ellipsis",
        safePage - 1,
        safePage,
        safePage + 1,
        "ellipsis",
        totalPages
      );
    }
    return items;
  }, [safePage, totalPages]);

  const handleExport = async () => {
    await exportEntsoeA44ToExcel(sorted, fileName);
  };

  return (
    <div className="space-y-4">
      {/* Barre d'actions */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Label htmlFor="adv">Colonnes avancées</Label>
          <Switch
            id="adv"
            checked={showAdvanced}
            onCheckedChange={setShowAdvanced}
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-56 sm:w-80">
            <Input
              placeholder="Rechercher…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="p-2"
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="text-sm text-muted-foreground">
        {total === 0 ? (
          "Aucun résultat"
        ) : (
          <>
            Affichage {startIndex + 1}-{endIndex} sur {total} résultats
          </>
        )}
      </div>

      {/* Tableau */}
      <div className="rounded-md border shadow-md">
        <ScrollArea className="w-full max-h-[540px]">
          <Table className="min-w-max table-fixed border-collapse">
            <TableHeader>
              <TableRow>
                {columns.map((col) => {
                  const label = LABELS[col] ?? col;
                  const isActive = sortKey === col;
                  const dir = isActive ? sortDir : null;
                  return (
                    <TableHead
                      key={col}
                      onClick={() => toggleSort(col)}
                      className="sticky top-0 z-10 bg-background px-4 py-3 whitespace-nowrap text-left text-sm font-medium border-b select-none cursor-pointer"
                      title={`Trier par ${label}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {label}
                        <ArrowUpDown className="h-3.5 w-3.5" />
                        {isActive && dir && (
                          <span className="text-[10px] uppercase text-muted-foreground">
                            {dir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </span>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>

            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-gray-500"
                  >
                    Aucun résultat trouvé.
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((row, rIdx) => (
                  <TableRow
                    key={rIdx}
                    className={rIdx % 2 === 0 ? "bg-muted/40" : undefined}
                  >
                    {columns.map((col) => {
                      const renderer = RENDERERS[col];
                      let text: string;
                      if (renderer) {
                        text = renderer(row);
                      } else {
                        const raw = row[col];
                        if (isNumeric(raw)) {
                          text = Number.isInteger(raw)
                            ? nf0.format(raw)
                            : nf2.format(raw);
                        } else {
                          text = String(raw ?? "-");
                        }
                      }
                      const raw = row[col];
                      return (
                        <TableCell
                          key={`${rIdx}-${col}`}
                          className="px-4 py-2 text-sm max-w-[200px] truncate whitespace-nowrap"
                          title={String(raw ?? "")}
                        >
                          {text}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className={
                  safePage === 1
                    ? "pointer-events-none opacity-50"
                    : "cursor-pointer"
                }
              />
            </PaginationItem>
            {paginationItems.map((it, i) =>
              it === "ellipsis" ? (
                <PaginationItem key={`e-${i}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={`p-${it}`}>
                  <PaginationLink
                    isActive={safePage === it}
                    onClick={() => setCurrentPage(it)}
                    className="cursor-pointer"
                  >
                    {it}
                  </PaginationLink>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              <PaginationNext
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                className={
                  safePage === totalPages
                    ? "pointer-events-none opacity-50"
                    : "cursor-pointer"
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
