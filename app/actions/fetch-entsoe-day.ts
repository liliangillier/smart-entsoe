// app/actions/fetch-entsoe-day.ts
"use server";

import axios from "axios";
import { parseEntsoeXML } from "@/lib/xml-parser";
import { DataTypeOptions, DefaultDomain } from "@/lib/data-types";

export type EntsoeDayResponse = {
  parsed: any[]; // ou EntsoePoint[] si typé
  raw: string;
};

export async function fetchEntsoeDay(
  date: string,
  documentType: string
): Promise<EntsoeDayResponse> {
  const API_KEY = process.env.ENTSOE_API_KEY;
  const API_BASE_URL = "https://web-api.tp.entsoe.eu/api";

  const config = DataTypeOptions.find((d) => d.value === documentType);
  if (!config) {
    throw new Error(`Invalid document type: ${documentType}`);
  }

  const start = `${date}0000`; // format: YYYYMMDD0000
  const endDate = new Date(
    Date.UTC(
      parseInt(date.substring(0, 4)),
      parseInt(date.substring(4, 6)) - 1,
      parseInt(date.substring(6, 8)) + 1
    )
  );
  const end = `${endDate.getUTCFullYear()}${(endDate.getUTCMonth() + 1)
    .toString()
    .padStart(2, "0")}${endDate.getUTCDate().toString().padStart(2, "0")}0000`;

  const params = new URLSearchParams({
    securityToken: API_KEY || "",
    documentType,
    processType: config.processType,
    in_Domain: DefaultDomain,
    out_Domain: DefaultDomain,
    periodStart: start,
    periodEnd: end,
  });

  const url = `${API_BASE_URL}?${params.toString()}`;
  try {
    const response = await axios.get(url, {
      headers: { Accept: "application/xml" },
      timeout: 30000,
    });

    return {
      parsed: parseEntsoeXML(response.data),
      raw: response.data,
    };
  } catch (error: any) {
    console.error("ENTSO-E socket error:", error);
    throw new Error("Socket hang up – serveur distant instable ou trop lent.");
  }
}
