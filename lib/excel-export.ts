import * as XLSX from "xlsx";

/**
 * Export data to Excel file for download
 * @param data Array of objects to export
 * @param fileName Name of the exported file
 */
export function exportToExcel(data: any[], fileName: string) {
  try {
    // Create a new workbook
    const workbook = XLSX.utils.book_new();

    // Create a worksheet from the JSON data
    const worksheet = XLSX.utils.json_to_sheet(data);

    // Auto-size columns
    const colWidths = estimateColumnWidths(data);
    worksheet["!cols"] = colWidths;

    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "ENTSO-E Data");

    // Write and download the workbook
    XLSX.writeFile(workbook, fileName);
  } catch (error: unknown) {
    // Type de l'erreur en 'unknown'
    console.error("Error export Excel:", error);

    // Gérer le cas où l'erreur n'est pas de type Error
    if (error instanceof Error) {
      throw new Error(`Failed to export data to Excel: ${error.message}`);
    } else {
      throw new Error(
        "Failed to export data to Excel: An unknown error occurred"
      );
    }
  }
}

/**
 * Estimate column widths based on data content
 * @param data Array of data objects
 * @returns Array of column width specifications
 */
function estimateColumnWidths(data: any[]): { wch: number }[] {
  if (!data || data.length === 0) {
    return [];
  }

  // Get column headers
  const headers = Object.keys(data[0]);

  // Initialize column widths with header lengths
  const colWidths = headers.map((header) => ({
    wch: Math.max(10, header.length * 1.2),
  }));

  // Estimate width based on content (up to first 100 rows for performance)
  const sampleData = data.slice(0, 100);

  sampleData.forEach((row) => {
    headers.forEach((header, index) => {
      const value = String(row[header] || "");
      const valueLength = value.length * 1.1; // Add a little extra width

      if (valueLength > colWidths[index].wch) {
        colWidths[index].wch = Math.min(50, valueLength); // Cap at 50 characters
      }
    });
  });

  return colWidths;
}
