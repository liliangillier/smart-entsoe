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

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend
);

import { fr } from "date-fns/locale";

interface Props {
  day: Date;
  rawXml: string;
  onClose: () => void;
}

export function DayChart({ day, rawXml, onClose }: Props) {
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

  const chartData = {
    labels: filteredData.map((d) =>
      new Date(d.timestamp!).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    ),
    datasets: [
      {
        label: "Prix (€/MWh)",
        data: filteredData.map((d) => d.price ?? d.quantity),
        borderColor: "rgba(75,192,192,1)",
        tension: 0.3,
        pointRadius: 2,
        fill: false,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: true,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "€/MWh",
        },
      },
      x: {
        title: {
          display: true,
          text: "Heure",
        },
      },
    },
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">
        Prix spot - {format(day, "PPP", { locale: fr })}
      </h3>
      <Line data={chartData} options={chartOptions} />
      <div className="flex justify-end">
        <Button onClick={onClose}>Fermer</Button>
      </div>
    </div>
  );
}
