import { NextRequest, NextResponse } from "next/server";
import axios, { AxiosError } from "axios"; // Importer AxiosError
import { parseEntsoeXML } from "@/lib/xml-parser";
import { DataTypeOptions, DefaultDomain } from "@/lib/data-types";

// Environment configuration
const API_KEY = process.env.ENTSOE_API_KEY || "your-entsoe-api-key";
const API_BASE_URL = "https://web-api.tp.entsoe.eu/api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { startDate, endDate, documentType } = body;

    // Input validation
    if (!startDate || !endDate || !documentType) {
      return NextResponse.json(
        {
          message:
            "Missing required parameters: startDate, endDate, and documentType are required",
        },
        { status: 400 }
      );
    }

    // Find the corresponding process type for the document type
    const dataTypeConfig = DataTypeOptions.find(
      (dt) => dt.value === documentType
    );
    if (!dataTypeConfig) {
      return NextResponse.json(
        { message: "Invalid document type" },
        { status: 400 }
      );
    }

    // Build query parameters
    const params = new URLSearchParams({
      securityToken: API_KEY,
      documentType,
      processType: dataTypeConfig.processType,
      in_Domain: DefaultDomain,
      out_Domain: DefaultDomain,
      periodStart: startDate,
      periodEnd: endDate,
    });

    // Make request to ENTSO-E API
    const response = await axios.get(`${API_BASE_URL}?${params}`, {
      headers: {
        Accept: "application/xml",
      },
      timeout: 30000, // 30 seconds timeout
    });

    // Parse XML response to JSON
    const parsedData = parseEntsoeXML(response.data);

    return NextResponse.json({
      success: true,
      data: parsedData,
    });
  } catch (error: unknown) {
    console.error("ENTSO-E API error:", error);

    if (axios.isAxiosError(error)) {
      let status = 500;
      let message = "An error occurred while fetching data from ENTSO-E API";

      if (error.response) {
        status = error.response.status;

        if (status === 401) {
          message = "Invalid ENTSO-E API key";
        } else if (status === 400) {
          message = "Invalid request parameters";
        } else if (status === 404) {
          message = "No data available for the specified criteria";
        }

        if (error.response.data && typeof error.response.data === "string") {
          const errorMatch = error.response.data.match(
            /<code>(.*?)<\/code>.*?<message>(.*?)<\/message>/s
          );
          if (errorMatch && errorMatch.length >= 3) {
            message = `ENTSO-E Error ${errorMatch[1]}: ${errorMatch[2]}`;
          }
        }
      } else if (error.request) {
        message =
          "No response received from ENTSO-E API, please try again later";
      }

      return NextResponse.json({ success: false, message }, { status });
    } else {
      return NextResponse.json(
        { success: false, message: "An unexpected error occurred" },
        { status: 500 }
      );
    }
  }
}
