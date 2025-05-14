import { XMLParser } from 'fast-xml-parser';

// Configure XML Parser
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "_",
  isArray: (name) => {
    // Ensure certain elements are always treated as arrays
    return [
      "TimeSeries",
      "Period",
      "Point",
      "MktPSRType",
      "Reason",
    ].includes(name);
  },
});

/**
 * Parse ENTSO-E XML response to a structured JSON format
 * @param xmlString The XML string response from ENTSO-E API
 * @returns Structured JSON data ready for display and export
 */
export function parseEntsoeXML(xmlString: string): any[] {
  try {
    // Parse XML to JSON
    const parsed = parser.parse(xmlString);
    
    // Access the publication document
    const publication = parsed?.Publication_MarketDocument || 
                        parsed?.GL_MarketDocument || 
                        parsed?.Unavailability_MarketDocument ||
                        parsed?.BalancingMarketDocument;
    
    if (!publication) {
      throw new Error("Invalid XML structure: Cannot find document root");
    }

    // Extract common data
    const documentType = publication.type || "Unknown";
    const documentId = publication.mRID || "Unknown";
    const createdDateTime = publication.createdDateTime || "Unknown";
    
    // Process time series data - this is where the actual data points are
    const timeSeries = publication.TimeSeries || [];
    
    if (!Array.isArray(timeSeries) || timeSeries.length === 0) {
      return [];
    }

    const formattedData: any[] = [];
    
    // Process each time series
    timeSeries.forEach((series: any) => {
      const businessType = series.businessType || "Unknown";
      const curveType = series.curveType || "Unknown";
      const objectAggregation = series.objectAggregation || "Unknown";
      const inDomain = series.in_Domain?._mRID || "Unknown";
      const outDomain = series.out_Domain?._mRID || "Unknown";
      
      // Process price measures
      const priceMeasureUnit = series.price_Measure_Unit?.name || "Unknown";
      const currencyUnit = series.currency_Unit?.name || "Unknown";
      
      // Process quantity measures
      const quantityMeasureUnit = series.quantity_Measure_Unit?.name || "Unknown";
      
      // Extract resource provider
      const resourceProvider = series.resourceProvider?._marketParticipant?.mRID || "Unknown";
      
      // Process periods - where the actual data points exist
      const periods = series.Period || [];
      
      if (!Array.isArray(periods) || periods.length === 0) {
        return;
      }
      
      periods.forEach((period: any) => {
        const timeInterval = {
          start: period.timeInterval?.start || "Unknown",
          end: period.timeInterval?.end || "Unknown",
        };
        
        const resolution = period.resolution || "Unknown";
        const points = period.Point || [];
        
        if (!Array.isArray(points) || points.length === 0) {
          return;
        }
        
        // Process each data point
        points.forEach((point: any) => {
          const formattedPoint = {
            documentId,
            documentType,
            createdDateTime,
            businessType,
            curveType,
            timeStart: timeInterval.start,
            timeEnd: timeInterval.end,
            resolution,
            position: point.position || 0,
            quantity: point.quantity || 0,
            priceMeasureUnit,
            currencyUnit,
            quantityMeasureUnit,
            inDomain,
            outDomain,
            resourceProvider,
          };
          
          // Add optional fields if they exist
          if (point.price) {
            formattedPoint["price"] = point.price;
          }
          
          if (series.MktPSRType && series.MktPSRType.length > 0) {
            formattedPoint["resourceType"] = series.MktPSRType[0].psrType || "Unknown";
          }
          
          formattedData.push(formattedPoint);
        });
      });
    });
    
    return formattedData;
  } catch (error) {
    console.error("Error parsing XML:", error);
    throw new Error(`Failed to parse ENTSO-E XML response: ${error.message}`);
  }
}