"use client";

import { useState, useTransition } from "react";
import { format, eachDayOfInterval } from "date-fns";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { fetchEntsoeDay } from "@/app/actions/fetch-entsoe-day";
import { DataTypeOptions } from "@/lib/data-types";
import { exportToExcel } from "@/lib/excel-export";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
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

const formSchema = z
  .object({
    startDate: z.date(),
    endDate: z.date(),
    dataType: z.string().min(1),
  })
  .refine((data) => data.endDate >= data.startDate, {
    path: ["endDate"],
    message: "End date must be after start date",
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
        title: "Done",
        description: `${allData.length} records retrieved.`,
      });
    });
  };

  const handleExport = () => {
    if (!data || data.length === 0) {
      toast({
        variant: "destructive",
        title: "No data to export",
        description: "Please fetch some data before exporting",
      });
      return;
    }

    const { startDate, endDate, dataType } = form.getValues();
    const fileName = `entsoe-${dataType}-${format(
      startDate,
      "yyyy-MM-dd"
    )}-to-${format(endDate, "yyyy-MM-dd")}.xlsx`;
    exportToExcel(data, fileName);
    toast({ title: "Exported", description: fileName });
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Data Request
          </CardTitle>
          <CardDescription>
            Configure your energy data request parameters
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Start Date Picker */}
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn("pl-3 text-left font-normal")}
                            >
                              {field.value
                                ? format(field.value, "PPP")
                                : "Pick a date"}
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
                      <FormDescription>Start date</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* End Date Picker */}
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn("pl-3 text-left font-normal")}
                            >
                              {field.value
                                ? format(field.value, "PPP")
                                : "Pick a date"}
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
                      <FormDescription>End date</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* Data Type Select */}
                <FormField
                  control={form.control}
                  name="dataType"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Data Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a data type" />
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
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Fetching..." : "Fetch Data"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {Object.keys(statusByDay).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {Object.entries(statusByDay).map(([date, status]) => (
                <li key={date} className="text-sm">
                  {`📆 ${date} : `}
                  {status === "loading" && "⏳"}
                  {status === "success" && "✅"}
                  {status === "error" && "❌"}
                  {rawResponses[date] && (
                    <details className="ml-2">
                      <summary className="cursor-pointer text-xs text-blue-600">
                        View Raw
                      </summary>
                      <pre className="max-h-40 overflow-auto bg-gray-100 p-2 text-xs">
                        {rawResponses[date]}
                      </pre>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {data && data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>Results</span>
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" /> Export to Excel
              </Button>
            </CardTitle>
            <CardDescription>{data.length} records retrieved</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable data={data} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
