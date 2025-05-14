import { XMLParser } from "fast-xml-parser";

interface EntsoePoint {
  documentId: string;
  documentType: string;
  createdDateTime: string;
  businessType: string;
  curveType: string;
  timeStart: string;
  timeEnd: string;
  resolution: string;
  date: string;
  position: number;
  quantity: number;
  priceMeasureUnit: string;
  currencyUnit: string;
  quantityMeasureUnit: string;
  inDomain: string;
  outDomain: string;
  resourceProvider: string;
  resourceType?: string;
  price?: number;
  timestamp?: Date;
}

// Configure XML Parser
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "_",
  isArray: (name) =>
    ["TimeSeries", "Period", "Point", "MktPSRType", "Reason"].includes(name),
});

/**
 * Parse ENTSO-E XML response to structured JSON data
 */
export function parseEntsoeXML(xmlString: string): EntsoePoint[] {
  try {
    const parsed = parser.parse(xmlString);

    const publication =
      parsed?.Publication_MarketDocument ||
      parsed?.GL_MarketDocument ||
      parsed?.Unavailability_MarketDocument ||
      parsed?.BalancingMarketDocument;

    if (!publication) {
      throw new Error("Invalid XML structure: No valid root document found.");
    }

    const documentType = publication.type || "Unknown";
    const documentId = publication.mRID || "Unknown";
    const createdDateTime = publication.createdDateTime || "Unknown";

    const timeSeries = publication.TimeSeries || [];
    if (!Array.isArray(timeSeries) || timeSeries.length === 0) {
      return [];
    }

    const formattedData: EntsoePoint[] = [];

    timeSeries.forEach((series: any) => {
      const businessType = series.businessType || "Unknown";
      const curveType = series.curveType || "Unknown";
      const inDomain =
        typeof series["in_Domain.mRID"] === "string"
          ? series["in_Domain.mRID"]
          : "Unknown";
      const outDomain =
        typeof series["out_Domain.mRID"] === "string"
          ? series["out_Domain.mRID"]
          : "Unknown";
      const priceMeasureUnit =
        typeof series["price_Measure_Unit.name"] === "string"
          ? series["price_Measure_Unit.name"]
          : "Unknown";
      const currencyUnit =
        typeof series["currency_Unit.name"] === "string"
          ? series["currency_Unit.name"]
          : "Unknown";
      const quantityMeasureUnit =
        typeof series["quantity_Measure_Unit.name"] === "string"
          ? series["quantity_Measure_Unit.name"]
          : "Unknown";
      const resourceProvider =
        series.resourceProvider?.marketParticipant?.mRID || "Unknown";

      const resourceType = series.MktPSRType?.[0]?.psrType || undefined;

      const periods = series.Period || [];
      if (!Array.isArray(periods) || periods.length === 0) return;

      periods.forEach((period: any) => {
        const timeInterval = {
          start: period.timeInterval?.start || "Unknown",
          end: period.timeInterval?.end || "Unknown",
        };

        const resolution = period.resolution || "PT60M";
        const resolutionMap: Record<string, number> = {
          PT15M: 15,
          PT30M: 30,
          PT60M: 60,
        };

        const resolutionMinutes = resolutionMap[resolution] ?? 60;

        const startTime = new Date(timeInterval.start);
        const points = period.Point || [];

        if (!Array.isArray(points) || points.length === 0) return;

        points.forEach((point: any) => {
          const position = Number(point.position || 0);
          const quantity = Number(point.quantity || 0);
          const price =
            point["price.amount"] !== undefined
              ? Number(point["price.amount"])
              : undefined;
          const timestamp = new Date(
            startTime.getTime() + (position - 1) * resolutionMinutes * 60000
          );

          const dateOnly = timestamp.toISOString().slice(0, 10); // Format YYYY-MM-DD

          const formattedPoint: EntsoePoint = {
            documentId,
            documentType,
            createdDateTime,
            businessType,
            curveType,
            timeStart: timeInterval.start,
            timeEnd: timeInterval.end,
            date: dateOnly, // champ supplémentaire
            resolution,
            position,
            quantity,
            priceMeasureUnit,
            currencyUnit,
            quantityMeasureUnit,
            inDomain,
            outDomain,
            resourceProvider,
            price,
            resourceType,
            timestamp,
          };

          formattedData.push(formattedPoint);
        });
      });
    });

    return formattedData;
  } catch (error: any) {
    console.error("❌ Error parsing XML:", error);
    throw new Error(`Failed to parse ENTSO-E XML response: ${error.message}`);
  }
}
