"use client";

import { useMemo, useState, useEffect } from "react";
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
import { ArrowUpDown } from "lucide-react";

type Row = Record<string, unknown>;

interface DataTableProps<T extends Row = Row> {
  data: T[];
  itemsPerPage?: number;
}

const HIDDEN_COLUMNS = new Set<string>([
  "documentId",
  "documentType",
  "businessType",
  "curveType",
  "timeStart",
  "timeEnd",
  "resolution",
  "createdDateTime",
  "resourceProvider",
  "resourceType",
  "quantityMeasureUnit",
  "inDomain",
  "outDomain",
  "quantity",
  "timestamp", // on masque la brute pour éviter les secondes "21"
]);

const COLUMN_LABELS: Record<string, string> = {
  date: "Date",
  position: "Heure",
  price: "€/MWh",
  currencyUnit: "Devise",
  priceMeasureUnit: "Unité de prix",
};

const nf2 = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

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

// --- Utils ---
function isNumeric(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
function toDate(v: unknown): Date | null {
  if (v instanceof Date) return v;
  if (typeof v === "string") {
    const d = new Date(v); // gère 'Z' (UTC) correctement
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}
function normalizeString(v: unknown): string {
  return String(v ?? "").toLowerCase();
}
function parseResolutionMinutes(res: unknown): number | null {
  if (typeof res !== "string") return null;
  const m = /^PT(\d+)M$/i.exec(res);
  return m ? parseInt(m[1], 10) : null;
}

// Reconstruit l’instant UTC fiable depuis la ligne (priorité: timeStart+position+resolution, fallback: timestamp)
function getUtcInstantFromRow(row: Row): Date | null {
  const t0 = toDate(row.timeStart);
  const p = Number(row.position);
  if (t0 && Number.isFinite(p)) {
    const step = parseResolutionMinutes(row.resolution) ?? 15;
    return new Date(t0.getTime() + (p - 1) * step * 60_000);
  }
  const ts = toDate(row.timestamp);
  if (ts) return ts;
  return null;
}

// --- Renderers basés sur la ligne complète ---
type Renderer = (row: Row) => string;

const COLUMN_RENDERERS: Record<string, Renderer> = {
  // Date locale Europe/Paris au format YYYY-MM-DD, dérivée de l’instant réel
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

  // Heure locale Europe/Paris au format HH:mm, dérivée de l’instant réel
  position: (row) => {
    const inst = getUtcInstantFromRow(row);
    if (!inst) {
      // Fallback: calcul à partir de l’index si pas d’instant fiable
      const v = row.position;
      if (isNumeric(v)) {
        const idx = v - 1;
        const step = parseResolutionMinutes(row.resolution) ?? 15;
        const minutes = idx * step;
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
  currencyUnit: (row) => String(row.currencyUnit ?? "-"),
  priceMeasureUnit: (row) => String(row.priceMeasureUnit ?? "-"),
};

// --- Composant ---
type SortDir = "asc" | "desc" | null;

export function DataTable<T extends Row = Row>({
  data,
  itemsPerPage = 10,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  const columns = useMemo(() => {
    if (!data?.length) return [] as string[];
    return Object.keys(data[0]).filter((c) => !HIDDEN_COLUMNS.has(c));
  }, [data]);

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

  // Filtre sur colonnes visibles (valeurs brutes)
  const filtered = useMemo(() => {
    if (!debouncedQuery) return data;
    const q = debouncedQuery.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => normalizeString(row[col]).includes(q))
    );
  }, [data, debouncedQuery, columns]);

  // Tri : pour 'date'/'position' on trie sur l’instant reconstruit
  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      // tri sur instant pour date/position
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

  // Pagination compacte
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

  return (
    <div className="space-y-4">
      {/* Barre de recherche */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          {total === 0 ? (
            "Aucun résultat"
          ) : (
            <>
              Affichage {startIndex + 1}-{endIndex} sur {total} résultats
            </>
          )}
        </div>
        <div className="w-full sm:w-80">
          <Input
            placeholder="Rechercher…"
            value={debouncedQuery ? debouncedQuery : ""}
            onChange={(e) => {
              // on saisit dans query, debouncedQuery suit avec 200ms
            }}
            className="hidden"
            aria-hidden
          />
          <Input
            placeholder="Rechercher…"
            value={debouncedQuery ? query : query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="p-2"
          />
        </div>
      </div>

      {/* Tableau */}
      <div className="rounded-md border shadow-md">
        <ScrollArea className="w-full max-h-[540px]">
          <Table className="min-w-max table-fixed border-collapse">
            <TableHeader>
              <TableRow>
                {columns.map((col) => {
                  const label = COLUMN_LABELS[col] ?? col;
                  const isActive = sortKey === col;
                  const dir = isActive ? sortDir : null;
                  return (
                    <TableHead
                      key={col}
                      onClick={() => {
                        // tri par défaut: date/heure → instant reconstruit
                        // autres colonnes → comportement standard
                        const key = col;
                        if (sortKey !== key) {
                          setSortKey(key);
                          setSortDir("asc");
                          setCurrentPage(1);
                          return;
                        }
                        setSortDir((prev) =>
                          prev === "asc"
                            ? "desc"
                            : prev === "desc"
                            ? null
                            : "asc"
                        );
                        setCurrentPage(1);
                      }}
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
                      // renderer par colonne, sinon fallback numérique/texte
                      const renderer = COLUMN_RENDERERS[col];
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
                          className="px-4 py-2 text-sm max-w-[180px] truncate whitespace-nowrap"
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
