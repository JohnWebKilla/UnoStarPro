"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import {
  importDriversFromRawDataAction,
  batchCreateDriversAction,
} from "../server-actions";
import { Driver } from "../types";
import { ScrollArea } from "@/components/ui/scroll-area";

// Define the required fields and their descriptions
const REQUIRED_FIELDS = {
  name: "Driver's full name",
  phone_number: "Phone number",
  truck_number: "Truck number",
  solo_or_team: "Driver type (solo/team)",
};

type ColumnMapping = {
  name?: string;
  phone_number?: string;
  truck_number?: string;
  solo_or_team?: string;
};

// Type for driver data during import
type ImportDriverData = {
  name: string;
  phone_number: string;
  truck_number: string;
  solo_or_team: "solo" | "team";
};

// Function to clean string values
const cleanValue = (value: string): string => {
  return (
    value
      .trim()
      // Remove both single and double quotes from start and end
      .replace(/^["']|["']$/g, "")
      // Remove any remaining quotes
      .replace(/["']/g, "")
      // Remove multiple spaces
      .replace(/\s+/g, " ")
  );
};

// Function to clean phone and truck numbers
const cleanNumberValue = (value: string): string => {
  return (
    value
      .trim()
      // Remove quotes
      .replace(/["']/g, "")
      // Remove all spaces
      .replace(/\s+/g, "")
  );
};

// Function to create a new driver data object
const createDriverData = (
  data: Partial<ImportDriverData> = {}
): ImportDriverData => ({
  name: data.name ? cleanValue(data.name) : "",
  phone_number: data.phone_number ? cleanNumberValue(data.phone_number) : "",
  truck_number: data.truck_number ? cleanNumberValue(data.truck_number) : "",
  solo_or_team: (data.solo_or_team
    ? cleanValue(data.solo_or_team).toLowerCase()
    : "solo") as "solo" | "team",
});

// Function to parse CSV data
const parseCSVData = (content: string): Array<Record<string, string>> => {
  console.log("Parsing CSV content:", content);

  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) return [];

  const headers = lines[0].split(",").map((h) => cleanValue(h));
  console.log("CSV headers:", headers);

  const data = lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => cleanValue(v));
    const rowData: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (values[index]) {
        rowData[header] = values[index];
      }
    });
    console.log("Parsed row:", rowData);
    return rowData;
  });

  console.log("Parsed CSV data:", data);
  return data;
};

// Function to parse JSON data
const parseJSONData = (content: string): Array<Record<string, any>> => {
  try {
    const data = JSON.parse(content);
    console.log("Parsed JSON data:", data);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Error parsing JSON:", error);
    return [];
  }
};

// Function to extract headers from data
const extractHeaders = (data: Array<Record<string, any>>): string[] => {
  if (data.length === 0) return [];
  const headers = Object.keys(data[0]);
  console.log("Extracted headers:", headers);
  return headers;
};

export function ImportDrivers() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [manualDrivers, setManualDrivers] = useState<ImportDriverData[]>([]);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [fileContent, setFileContent] = useState<string>("");
  const [fileType, setFileType] = useState<"json" | "csv" | null>(null);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    const content = await selectedFile.text();
    setFileContent(content);

    const type = selectedFile.name.endsWith(".json") ? "json" : "csv";
    setFileType(type);

    // Parse data and extract headers
    const data =
      type === "json" ? parseJSONData(content) : parseCSVData(content);
    const headers = extractHeaders(data);
    setFileHeaders(headers);

    // Try to auto-map columns based on similar names
    const autoMapping: ColumnMapping = {};
    Object.keys(REQUIRED_FIELDS).forEach((requiredField) => {
      // Try exact match first
      let matchingHeader = headers.find(
        (h) => h.toLowerCase() === requiredField.toLowerCase()
      );

      // If no exact match, try partial matches
      if (!matchingHeader) {
        matchingHeader = headers.find((h) => {
          const headerWords = h.toLowerCase().split(/[_\s-]+/);
          const fieldWords = requiredField.toLowerCase().split(/[_\s-]+/);
          return headerWords.some((hw) =>
            fieldWords.some((fw) => hw.includes(fw) || fw.includes(hw))
          );
        });
      }

      if (matchingHeader) {
        console.log(`Mapped ${requiredField} to ${matchingHeader}`);
        autoMapping[requiredField as keyof typeof REQUIRED_FIELDS] =
          matchingHeader;
      } else {
        console.log(`No mapping found for ${requiredField}`);
      }
    });
    console.log("Auto-mapped columns:", autoMapping);
    setColumnMapping(autoMapping);
  };

  const addManualDriver = () => {
    setManualDrivers((prev) => [...prev, createDriverData()]);
  };

  const updateManualDriver = (
    index: number,
    field: keyof ImportDriverData,
    value: string
  ) => {
    setManualDrivers((prev) => {
      const updated = [...prev];
      let cleanedValue =
        field === "phone_number" || field === "truck_number"
          ? cleanNumberValue(value)
          : cleanValue(value);

      updated[index] = createDriverData({
        ...updated[index],
        [field]:
          field === "solo_or_team"
            ? (cleanedValue as "solo" | "team")
            : cleanedValue,
      });
      return updated;
    });
  };

  const handleFileUpload = async () => {
    if (!file || !fileType || !fileContent) return;

    // Validate mapping
    const missingFields = Object.keys(REQUIRED_FIELDS).filter(
      (field) => !columnMapping[field as keyof typeof REQUIRED_FIELDS]
    );

    if (missingFields.length > 0) {
      toast({
        title: "Missing Mappings",
        description: `Please map the following required fields: ${missingFields.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const rawData =
        fileType === "json"
          ? parseJSONData(fileContent)
          : parseCSVData(fileContent);

      const result = await importDriversFromRawDataAction(
        rawData,
        columnMapping
      );

      if (result.success) {
        toast({
          title: "Success",
          description: `Successfully imported ${result.imported} drivers. ${
            result.errors.length ? `\nErrors: ${result.errors.join(", ")}` : ""
          }`,
        });
        // Reset file-related state
        setFile(null);
        setFileHeaders([]);
        setColumnMapping({});
        setFileContent("");
        setFileType(null);
      } else {
        toast({
          title: "Error",
          description: `Failed to import drivers. ${result.errors.join(", ")}`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to process file",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSubmit = async () => {
    const cleanedDrivers = manualDrivers.map((driver) => ({
      ...driver,
      name: cleanValue(driver.name),
      phone_number: cleanNumberValue(driver.phone_number),
      truck_number: cleanNumberValue(driver.truck_number),
      solo_or_team: cleanValue(driver.solo_or_team).toLowerCase() as
        | "solo"
        | "team",
    }));

    setIsLoading(true);
    try {
      const result = await batchCreateDriversAction(cleanedDrivers);

      if (result.success) {
        toast({
          title: "Success",
          description: `Successfully created ${result.imported} driver(s)`,
        });
        setManualDrivers([]);
      } else {
        toast({
          title: "Error",
          description: result.errors.join("\n"),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create drivers",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="file">
        <TabsList>
          <TabsTrigger value="file">File Upload</TabsTrigger>
          <TabsTrigger value="manual">Manual Entry</TabsTrigger>
        </TabsList>

        <TabsContent value="file">
          <div className="space-y-4">
            <div>
              <Label htmlFor="file">Upload JSON or CSV file</Label>
              <Input
                id="file"
                type="file"
                accept=".json,.csv"
                onChange={handleFileChange}
                disabled={isLoading}
              />
            </div>

            {fileHeaders.length > 0 && (
              <div className="space-y-4 border rounded-lg p-4">
                <h3 className="font-medium">Map Columns</h3>
                <p className="text-sm text-gray-500">
                  Match your file's columns to our required fields
                </p>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-4">
                    {(
                      Object.entries(REQUIRED_FIELDS) as [
                        keyof typeof REQUIRED_FIELDS,
                        string,
                      ][]
                    ).map(([field, description]) => (
                      <div key={field} className="grid gap-2">
                        <Label htmlFor={`mapping-${field}`}>
                          {field} <span className="text-red-500">*</span>
                          <span className="text-sm text-gray-500 block">
                            {description}
                          </span>
                        </Label>
                        <select
                          id={`mapping-${field}`}
                          value={columnMapping[field] || ""}
                          onChange={(e) =>
                            setColumnMapping((prev) => ({
                              ...prev,
                              [field]: e.target.value,
                            }))
                          }
                          className="w-full p-2 border rounded"
                          disabled={isLoading}
                        >
                          <option value="">Select a column</option>
                          {fileHeaders.map((header) => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            <Button
              onClick={handleFileUpload}
              disabled={!file || isLoading || fileHeaders.length === 0}
            >
              {isLoading ? "Importing..." : "Import Drivers"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="manual">
          <div className="space-y-4">
            {manualDrivers.map((driver, index) => (
              <div key={index} className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`name-${index}`}>Name</Label>
                  <Input
                    id={`name-${index}`}
                    value={driver.name}
                    onChange={(e) =>
                      updateManualDriver(index, "name", e.target.value)
                    }
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <Label htmlFor={`phone-${index}`}>Phone</Label>
                  <Input
                    id={`phone-${index}`}
                    value={driver.phone_number}
                    onChange={(e) =>
                      updateManualDriver(index, "phone_number", e.target.value)
                    }
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <Label htmlFor={`truck-${index}`}>Truck #</Label>
                  <Input
                    id={`truck-${index}`}
                    value={driver.truck_number}
                    onChange={(e) =>
                      updateManualDriver(index, "truck_number", e.target.value)
                    }
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <Label htmlFor={`type-${index}`}>Type</Label>
                  <select
                    id={`type-${index}`}
                    value={driver.solo_or_team}
                    onChange={(e) =>
                      updateManualDriver(index, "solo_or_team", e.target.value)
                    }
                    disabled={isLoading}
                    className="w-full p-2 border rounded"
                  >
                    <option value="solo">Solo</option>
                    <option value="team">Team</option>
                  </select>
                </div>
              </div>
            ))}

            <div className="flex gap-4">
              <Button
                onClick={addManualDriver}
                variant="outline"
                disabled={isLoading}
              >
                Add Driver
              </Button>
              <Button
                onClick={handleManualSubmit}
                disabled={manualDrivers.length === 0 || isLoading}
              >
                {isLoading ? "Creating..." : "Create Drivers"}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
