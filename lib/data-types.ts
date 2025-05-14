// Data types available in the ENTSO-E API with their corresponding process types
export const DataTypeOptions = [
  { value: "A44", label: "Price Data", processType: "A01" }, // Day ahead
  { value: "A65", label: "System Total Load", processType: "A16" }, // Realised
  { value: "A69", label: "Generation Forecast", processType: "A01" }, // Day ahead
  { value: "A70", label: "Load Forecast Margin", processType: "A01" }, // Day ahead
  { value: "A71", label: "Generation Forecast Wind/Solar", processType: "A01" }, // Day ahead
  { value: "A72", label: "Reservoir Filling Information", processType: "A16" }, // Realised
  { value: "A73", label: "Actual Generation Per Unit", processType: "A16" }, // Realised
  { value: "A74", label: "Wind and Solar Forecast", processType: "A01" }, // Day ahead
  { value: "A75", label: "Actual Generation Per Type", processType: "A16" }, // Realised
  { value: "A76", label: "Load Unavailability", processType: "A16" }, // Realised
  { value: "A77", label: "Production Unavailability", processType: "A16" }, // Realised
  { value: "A78", label: "Transmission Unavailability", processType: "A16" }, // Realised
  { value: "A79", label: "Offshore Grid Unavailability", processType: "A16" }, // Realised
  { value: "A80", label: "Generation Unavailability", processType: "A16" }, // Realised
];

// Area codes used in the ENTSO-E API
export const AreaCodes = {
  "10YFR-RTE------C": "France (FR)",
  "10Y1001A1001A83F": "Germany (DE)",
  "10YES-REE------0": "Spain (ES)",
  "10YIT-GRTN-----B": "Italy (IT)",
  "10YGB----------A": "United Kingdom (GB)",
  "10YNL----------L": "Netherlands (NL)",
  "10YBE----------2": "Belgium (BE)",
  "10YPT-REN------W": "Portugal (PT)",
  "10YCH-SWISSGRIDZ": "Switzerland (CH)",
  "10YAT-APG------L": "Austria (AT)",
};

export const DefaultDomain = "10YFR-RTE------C"; // France