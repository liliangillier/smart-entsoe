"use server";

import axios from "axios";
import { parseEntsoeXML } from "@/lib/xml-parser";
import { DataTypeOptions, DefaultDomain } from "@/lib/data-types";

export async function fetchEntsoeData({
  startDate,
  endDate,
  documentType,
}: {
  startDate: string;
  endDate: string;
  documentType: string;
}) {
  const API_KEY = process.env.ENTSOE_API_KEY;
  const API_BASE_URL = "https://web-api.tp.entsoe.eu/api";

  if (!API_KEY) {
    throw new Error("Missing ENTSOE_API_KEY in environment variables.");
  }

  // 🔄 Trouver le processType associé au documentType
  const config = DataTypeOptions.find((d) => d.value === documentType);
  if (!config) {
    throw new Error(`Invalid document type: ${documentType}`);
  }

  const params = new URLSearchParams({
    securityToken: API_KEY,
    documentType: config.value,
    processType: config.processType,
    in_Domain: DefaultDomain,
    out_Domain: DefaultDomain,
    periodStart: startDate,
    periodEnd: endDate,
  });

  const url = `${API_BASE_URL}?${params.toString()}`;
  console.log("➡️ ENTSOE API URL:", url);

  try {
    const response = await axios.get(url, {
      headers: { Accept: "application/xml" },
      timeout: 20000,
    });

    if (!response.data.includes("<TimeSeries>")) {
      console.warn("⚠️ Aucune TimeSeries trouvée pour cette période.");
      return [];
    }

    console.log("📄 Données XML brutes :\n", response.data);

    const parsed = parseEntsoeXML(response.data);
    console.log("✅ Données récupérées :", parsed.length);
    return parsed;
  } catch (error: any) {
    const raw = error.response?.data || error.message;
    const match =
      typeof raw === "string" ? raw.match(/<text>(.*?)<\/text>/) : null;
    const message = match?.[1] || raw;
    console.error("❌ ERREUR API ENTSO-E :", message);
    throw new Error(`ENTSO-E error: ${message}`);
  }
}
