"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { format, eachDayOfInterval, addMonths } from "date-fns";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { fetchEntsoeDay } from "@/app/actions/fetch-entsoe-day";
import { DataTypeOptions } from "@/lib/data-types";
import { exportToExcel } from "@/lib/excel-export";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { fr } from "date-fns/locale"; // Importation de la locale française
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, Download, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/data-table";
import { DayChart } from "./DayChart";

const formSchema = z
  .object({
    startDate: z.date(),
    endDate: z.date(),
    dataType: z.string().min(1),
  })
  .refine((data) => data.endDate >= data.startDate, {
    path: ["endDate"],
    message: "La date de fin doit être après la date de début",
  });

export function DataFetcher() {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
      dataType: "",
    },
  });

  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusByDay, setStatusByDay] = useState<Record<string, string>>({});
  const [rawResponses, setRawResponses] = useState<Record<string, string>>({});
  const [selectedDayForChart, setSelectedDayForChart] = useState<Date | null>(
    null
  );
  const { toast } = useToast();

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    setError(null);
    setData([]);
    setStatusByDay({});
    setRawResponses({});

    const days = eachDayOfInterval({
      start: values.startDate,
      end: values.endDate,
    });

    startTransition(async () => {
      const allData: any[] = [];
      for (const day of days) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const key = format(day, "yyyy-MM-dd");
        setStatusByDay((prev) => ({ ...prev, [key]: "loading" }));

        try {
          const { parsed, raw } = await fetchEntsoeDay(
            format(day, "yyyyMMdd"),
            values.dataType
          );
          allData.push(...parsed);
          setRawResponses((prev) => ({ ...prev, [key]: raw }));
          setStatusByDay((prev) => ({ ...prev, [key]: "success" }));
        } catch (err: any) {
          setStatusByDay((prev) => ({ ...prev, [key]: "error" }));
        }
      }
      setData(allData);
      toast({
        title: "Terminé",
        description: `${allData.length} enregistrements récupérés.`,
      });
    });
  };

  const handleExport = () => {
    if (!data || data.length === 0) {
      toast({
        variant: "destructive",
        title: "Aucune donnée à exporter",
        description: "Veuillez récupérer des données avant d'exporter",
      });
      return;
    }

    const { startDate, endDate, dataType } = form.getValues();
    const fileName = `entsoe-${dataType}-${format(
      startDate,
      "yyyy-MM-dd"
    )}-to-${format(endDate, "yyyy-MM-dd")}.xlsx`;
    exportToExcel(data, fileName);
    toast({ title: "Exporté", description: fileName });
  };

  const days = eachDayOfInterval({
    start: form.getValues().startDate,
    end: form.getValues().endDate,
  });

  // Calcul des lignes à afficher (un mois par ligne)
  const getMonths = (days: Date[]) => {
    const months: Date[][] = [];
    let currentMonthDays: Date[] = [];
    let currentMonth = days[0].getMonth();

    days.forEach((day) => {
      if (day.getMonth() === currentMonth) {
        currentMonthDays.push(day);
      } else {
        months.push(currentMonthDays);
        currentMonthDays = [day];
        currentMonth = day.getMonth();
      }
    });

    if (currentMonthDays.length > 0) {
      months.push(currentMonthDays);
    }

    return months;
  };

  const months = useMemo(() => getMonths(days), [days]);

  const renderStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-green-500";
      case "loading":
        return "bg-yellow-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-300";
    }
  };

  return (
    <div className="space-y-8">
      <Card className="shadow-lg rounded-lg border border-gray-200 p-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-semibold text-brand-dark">
            <Zap className="h-5 w-5 text-primary" />
            Demande de données
          </CardTitle>
          <CardDescription>
            Configurez vos paramètres pour la récupération des données
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Sélecteur de date de début */}
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel>Date de début : </FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn("pl-3 text-left font-normal")}
                            >
                              {field.value
                                ? format(field.value, "PPP")
                                : "Choisir une date"}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent>
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date("2015-01-01")}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        Choisissez la date de début
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* Sélecteur de date de fin */}
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel>Date de fin : </FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn("pl-3 text-left font-normal")}
                            >
                              {field.value
                                ? format(field.value, "PPP")
                                : "Choisir une date"}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent>
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date("2015-01-01")}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        Choisissez la date de fin
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* Sélecteur de type de donnée */}
                <FormField
                  control={form.control}
                  name="dataType"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2 space-y-2">
                      <FormLabel>Type de donnée</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Choisir un type de donnée" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DataTypeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={isPending}
                  className="bg-brand text-white hover:bg-brand-dark focus:ring-2 focus:ring-brand-dark"
                >
                  {isPending ? "Récupération..." : "Récupérer les données"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Barre d'avancement */}
      {statusByDay && (
        <Card className="shadow-lg rounded-lg border border-gray-200 p-6">
          <CardHeader>
            <CardTitle>Avancement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {months.map((month, monthIndex) => (
                <div key={monthIndex}>
                  <div className="flex items-center justify-between">
                    {/* Affichage du nom du mois avec première lettre en majuscule */}
                    <span className="text-lg font-semibold">
                      {format(month[0], "MMMM", { locale: fr })
                        .charAt(0)
                        .toUpperCase() +
                        format(month[0], "MMMM", { locale: fr }).slice(1)}
                    </span>

                    {/* Affichage des carrés pour chaque jour du mois */}
                    <div className="flex gap-2 flex-wrap">
                      {month.map((day, index) => {
                        const dayKey = format(day, "yyyy-MM-dd");
                        const status = statusByDay[dayKey] || "pending";
                        return (
                          <div
                            key={index}
                            className={`w-6 h-6 rounded-md cursor-pointer ${renderStatusColor(
                              status
                            )} flex items-center justify-center text-xs text-white`}
                            title={format(day, "PPP", { locale: fr })}
                            onClick={() => {
                              if (status === "success") {
                                setSelectedDayForChart(day);
                              }
                            }}
                          >
                            {format(day, "d", { locale: fr })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedDayForChart &&
        rawResponses[format(selectedDayForChart, "yyyy-MM-dd")] && (
          <Card className="shadow-lg rounded-lg border border-gray-200 p-6">
            <CardHeader>
              <CardTitle>
                Courbe : {format(selectedDayForChart, "PPP", { locale: fr })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DayChart
                day={selectedDayForChart}
                rawXml={rawResponses[format(selectedDayForChart, "yyyy-MM-dd")]}
                onClose={() => setSelectedDayForChart(null)}
              />
            </CardContent>
          </Card>
        )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {data && data.length > 0 && (
        <Card className="shadow-lg rounded-lg border border-gray-200 p-6">
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>Résultats</span>
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" /> Exporter en Excel
              </Button>
            </CardTitle>
            <CardDescription>
              {data.length} enregistrements récupérés
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable data={data} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
