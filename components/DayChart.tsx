"use client";

import { Line } from "react-chartjs-2";
import { format } from "date-fns";
import { parseEntsoeXML } from "@/lib/xml-parser";
import { Button } from "@/components/ui/button";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";

import { fr } from "date-fns/locale";

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend
);

interface Props {
  day: Date;
  rawXml: string;
  dataType: string;
  onClose: () => void;
}

export function DayChart({ day, rawXml, dataType, onClose }: Props) {
  if (!rawXml) return null;

  let parsed;
  try {
    parsed = parseEntsoeXML(rawXml);
  } catch (err) {
    return <p>❌ Erreur lors du parsing XML</p>;
  }

  const filteredData = parsed.filter(
    (point) =>
      format(point.timestamp!, "yyyy-MM-dd") === format(day, "yyyy-MM-dd")
  );

  const { label, field } = getLabelAndDataField(dataType);

  const chartData = {
    labels: filteredData.map((d) =>
      new Date(d.timestamp!).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    ),
    datasets: [
      {
        label,
        data: filteredData.map((d) => d[field as keyof typeof d] ?? 0),
        borderColor: "rgba(75,192,192,1)",
        // 🔸 Tracé en escalier “x1,y1 -> x2,y1 -> x2,y2”
        stepped: "after",
        tension: 0, // pas d’arrondi
        pointRadius: 2,
        fill: false,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: true },
      tooltip: { intersect: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: label },
      },
      x: {
        title: { display: true, text: "Heure" },
      },
    },
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">
        {label} – {format(day, "PPP", { locale: fr })}
      </h3>
      <Line data={chartData} options={chartOptions} />
      <div className="flex justify-end">
        <Button onClick={onClose}>Fermer</Button>
      </div>
    </div>
  );
}

// Déterminer dynamiquement le label et le champ à afficher selon dataType
function getLabelAndDataField(type: string) {
  switch (type) {
    case "A44":
      return { label: "Prix (€/MWh)", field: "price" };
    case "A65":
      return { label: "Charge totale (MW)", field: "quantity" };
    case "A69":
    case "A70":
    case "A71":
    case "A74":
      return { label: "Prévision (MW)", field: "quantity" };
    case "A72":
      return { label: "Remplissage (%)", field: "quantity" };
    case "A73":
    case "A75":
    case "A80":
      return { label: "Production réelle (MW)", field: "quantity" };
    case "A76":
    case "A77":
    case "A78":
    case "A79":
      return { label: "Indisponibilité (MW)", field: "quantity" };
    default:
      return { label: "Valeur", field: "quantity" };
  }
}
