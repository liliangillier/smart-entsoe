"use client";

import { useState, useMemo } from "react";
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

interface DataTableProps {
  data: any[];
}

const HIDDEN_COLUMNS = [
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
  "timestamp",
];

export function DataTable({ data }: DataTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const itemsPerPage = 10;

  const columns =
    data.length > 0
      ? Object.keys(data[0]).filter((col) => !HIDDEN_COLUMNS.includes(col))
      : [];

  const COLUMN_LABELS: Record<string, string> = {
    timeStart: "Début",
    timeEnd: "Fin",
    date: "Date",
    resolution: "Rés",
    position: "Heure",
    quantity: "Quantité (MWh)",
    price: "€/MWh",
    priceMeasureUnit: "Unité de prix",
    currencyUnit: "Devise",
    quantityMeasureUnit: "Unité quantité",
    inDomain: "Dans la zone",
    outDomain: "Hors zone",
    resourceProvider: "Fournisseur",
    resourceType: "Type de ressource",
    curveType: "Type de courbe",
    timestamp: "Timestamp",
  };

  const filteredData = useMemo(() => {
    return data.filter((item) =>
      Object.values(item).some((value) =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [data, searchTerm]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const paginationItems = [];
  const maxVisiblePages = 5;
  if (totalPages <= maxVisiblePages) {
    for (let i = 1; i <= totalPages; i++) paginationItems.push(i);
  } else {
    if (currentPage <= 3) {
      for (let i = 1; i <= 5; i++) paginationItems.push(i);
      paginationItems.push("ellipsis", totalPages);
    } else if (currentPage >= totalPages - 2) {
      paginationItems.push(1, "ellipsis");
      for (let i = totalPages - 4; i <= totalPages; i++)
        paginationItems.push(i);
    } else {
      paginationItems.push(
        1,
        "ellipsis",
        currentPage - 1,
        currentPage,
        currentPage + 1,
        "ellipsis",
        totalPages
      );
    }
  }

  return (
    <div className="space-y-4">
      {/* Barre de recherche */}
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-muted-foreground">
          Affichage {Math.min(filteredData.length, 1 + startIndex)}-
          {Math.min(filteredData.length, startIndex + itemsPerPage)} de{" "}
          {filteredData.length} résultats
        </div>
        <div className="w-72">
          <Input
            placeholder="Rechercher des données..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="max-w-sm p-2 border rounded-md shadow-sm"
          />
        </div>
      </div>

      {/* Tableau des données */}
      <div className="rounded-md border overflow-auto max-h-[500px] shadow-md">
        <ScrollArea className="w-full">
          <Table className="min-w-max table-fixed border-collapse">
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead
                    key={column}
                    className="sticky top-0 bg-background px-4 py-3 whitespace-nowrap text-left text-sm font-medium border-b"
                  >
                    {COLUMN_LABELS[column] ?? column}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-gray-500"
                  >
                    Aucun résultat trouvé.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((row, rowIndex) => (
                  <TableRow
                    key={rowIndex}
                    className={rowIndex % 2 === 0 ? "bg-muted" : undefined}
                  >
                    {columns.map((column) => (
                      <TableCell
                        key={`${rowIndex}-${column}`}
                        className="px-4 py-2 text-sm max-w-[140px] truncate whitespace-nowrap"
                        title={String(row[column])}
                      >
                        {typeof row[column] === "number"
                          ? row[column].toFixed(2)
                          : row[column] ?? "-"}
                      </TableCell>
                    ))}
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
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                className={
                  currentPage === 1
                    ? "pointer-events-none opacity-50"
                    : "cursor-pointer"
                }
              />
            </PaginationItem>
            {paginationItems.map((item, index) =>
              item === "ellipsis" ? (
                <PaginationItem key={`ellipsis-${index}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={`page-${item}`}>
                  <PaginationLink
                    isActive={currentPage === item}
                    onClick={() =>
                      typeof item === "number" && handlePageChange(item)
                    }
                    className="cursor-pointer"
                  >
                    {item}
                  </PaginationLink>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              <PaginationNext
                onClick={() =>
                  handlePageChange(Math.min(totalPages, currentPage + 1))
                }
                className={
                  currentPage === totalPages
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
