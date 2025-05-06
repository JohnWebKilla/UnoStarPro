"use client";

import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  SortingState,
  getSortedRowModel,
  ColumnFiltersState,
  getFilteredRowModel,
  VisibilityState,
  Column,
  Row,
  Table as TableType,
  Header,
  RowSelectionState,
  OnChangeFn,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Search,
  Settings2,
  SlidersHorizontal,
  ChevronDown,
  Edit,
  Eye,
  Trash,
  CheckCircle,
  XCircle,
  Filter,
  FileDown,
  RefreshCw,
  Loader2,
  AlertCircle,
  Clock,
  MoreHorizontal,
  Power,
  X,
  Phone,
  MessageSquare,
} from "lucide-react";
import { useState, ReactNode, useCallback, useEffect, useMemo } from "react";
import { Driver, DRIVER_STATUS_OPTIONS, DRIVER_TEAM_OPTIONS } from "../types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { useDrivers } from "./DriversClientProvider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { toast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { updateDriverAction } from "../server-actions";
import { useToast } from "@/components/ui/use-toast";
import { formatPhoneNumber } from "@/lib/utils/phone-format";

interface TableToolbarProps {
  table: TableType<any>;
  hasSelectedRows: boolean;
  selectedRowCount: number;
  totalRows: number;
  allSelectedActive?: boolean;
  allSelectedInactive?: boolean;
  isProcessing: boolean;
  handleBulkAction: (action: "activate" | "deactivate") => Promise<void>;
  exportToCSV: () => void;
  showAdvancedFilters: boolean;
  setShowAdvancedFilters: (show: boolean) => void;
}

const TableToolbar = React.memo(function TableToolbar({
  table,
  hasSelectedRows,
  selectedRowCount,
  totalRows,
  allSelectedActive = false,
  allSelectedInactive = false,
  isProcessing,
  handleBulkAction,
  exportToCSV,
  showAdvancedFilters,
  setShowAdvancedFilters,
}: TableToolbarProps): ReactNode {
  return (
    <div className="flex items-center justify-between pb-4">
      <div className="flex flex-1 items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <Input
            placeholder="Search drivers..."
            value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("name")?.setFilterValue(event.target.value)
            }
            className="pl-9 h-10 bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 rounded-md"
          />
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={cn(
                  "h-10 w-10 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40",
                  showAdvancedFilters &&
                    "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-50"
                )}
              >
                {showAdvancedFilters ? (
                  <X className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                ) : (
                  <Filter className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {showAdvancedFilters ? "Hide filters" : "Show filters"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <DropdownMenu>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40"
                  >
                    <SlidersHorizontal className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Customize columns</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DropdownMenuContent align="end" className="w-[200px]">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter(
                (column) =>
                  typeof column.accessorFn !== "undefined" &&
                  column.getCanHide()
              )
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id.replace(/_/g, " ")}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2">
        {hasSelectedRows ? (
          <>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {selectedRowCount} of {totalRows} selected
            </div>
            {!allSelectedActive && allSelectedInactive && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkAction("activate")}
                      disabled={isProcessing}
                      className="text-green-600 border-green-600 hover:bg-green-50 dark:text-green-400 dark:border-green-400 dark:hover:bg-green-900/20"
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Activate
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Activate selected drivers</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {!allSelectedInactive && allSelectedActive && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkAction("deactivate")}
                      disabled={isProcessing}
                      className="text-destructive border-destructive hover:bg-destructive/10"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Deactivate
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Deactivate selected drivers</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {!allSelectedActive && !allSelectedInactive && (
              <>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkAction("activate")}
                        disabled={isProcessing}
                        className="text-green-600 border-green-600 hover:bg-green-50 dark:text-green-400 dark:border-green-400 dark:hover:bg-green-900/20"
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Activate
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Activate selected drivers</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkAction("deactivate")}
                        disabled={isProcessing}
                        className="text-destructive border-destructive hover:bg-destructive/10"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Deactivate
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Deactivate selected drivers</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            )}
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            className="bg-white dark:bg-slate-800/40"
          >
            <FileDown className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        )}
      </div>
    </div>
  );
});

TableToolbar.displayName = "TableToolbar";

interface TablePaginationProps {
  table: TableType<any>;
}

const TablePagination = React.memo(function TablePagination({
  table,
}: TablePaginationProps): ReactNode {
  return (
    <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
      <div className="flex-1 text-sm text-slate-500 dark:text-slate-400">
        {table.getFilteredSelectedRowModel().rows.length} of{" "}
        {table.getFilteredRowModel().rows.length} row(s) selected.
      </div>
      <div className="flex items-center space-x-6 lg:space-x-8">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Rows per page
          </p>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
          >
            <SelectTrigger className="h-8 w-[70px] bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700">
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 30, 40, 50].map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="h-8 w-24 bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="h-8 w-24 bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
});

TablePagination.displayName = "TablePagination";

interface DataTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[] | undefined;
  error?: string;
  onActivateSelected?: (ids: number[]) => Promise<void>;
  onDeactivateSelected?: (ids: number[]) => Promise<void>;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  onRowDoubleClick?: (row: Row<TData>) => void;
  onRowClick?: (row: Row<TData>) => void;
  onViewDetails?: (driver: TData) => void;
  isProcessing?: boolean;
  selectedRow?: TData | null;
  hasSelectedRow?: boolean;
  allSelectedActive?: boolean;
  allSelectedInactive?: boolean;
}

export function DataTable<TData>({
  columns,
  data,
  error,
  onActivateSelected,
  onDeactivateSelected,
  rowSelection = {},
  onRowSelectionChange,
  onRowDoubleClick,
  onRowClick,
  onViewDetails,
  isProcessing: externalProcessing = false,
  selectedRow = null,
  hasSelectedRow = false,
  allSelectedActive = false,
  allSelectedInactive = false,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [companyFilter, setCompanyFilter] = useState("all");
  const [loadingRows, setLoadingRows] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingDrivers, setProcessingDrivers] = useState<
    Record<string, boolean>
  >({});
  const {
    processingDrivers: contextProcessingDrivers,
    setProcessingDriver: contextSetProcessingDriver,
    refreshDrivers,
  } = useDrivers();
  const router = useRouter();
  const { toast } = useToast();

  // Combined processing state
  const isBatchProcessing = isProcessing || externalProcessing;

  // Log processing state for debugging
  useEffect(() => {
    console.log("DataTable processingDrivers state:", processingDrivers);
    console.log("Context processingDrivers state:", contextProcessingDrivers);
  }, [processingDrivers, contextProcessingDrivers]);

  // Keep local state in sync with context
  useEffect(() => {
    setProcessingDrivers(contextProcessingDrivers);
  }, [contextProcessingDrivers]);

  // Local processing driver state setter that also updates context
  const setProcessingDriver = useCallback(
    (id: string, processing: boolean) => {
      setProcessingDrivers((prev) => ({ ...prev, [id]: processing }));
      contextSetProcessingDriver(id, processing);
      console.log(`Setting processing state for driver ${id} to ${processing}`);
    },
    [contextSetProcessingDriver]
  );

  // Get unique companies from data
  const companies = useMemo(() => {
    if (!data) return [];
    const uniqueCompanies = new Set<string>();
    data.forEach((item: any) => {
      if (item.company_name) {
        uniqueCompanies.add(item.company_name);
      }
    });
    return Array.from(uniqueCompanies).sort();
  }, [data]);

  // Filter data based on company
  const filteredData = useMemo(() => {
    if (!data) return [];
    if (companyFilter === "all") return data;
    return (data as any[]).filter(
      (item) => item.company_name === companyFilter
    );
  }, [data, companyFilter]);

  const table = useReactTable({
    data: filteredData || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: onRowSelectionChange,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    enableRowSelection: true,
  });

  // Define hasSelectedRows to include both checkbox selections and single row selections
  const hasSelectedRows = useMemo(() => {
    return Object.keys(rowSelection).length > 0 || hasSelectedRow;
  }, [rowSelection, hasSelectedRow]);

  const selectedRowCount = useMemo(() => {
    return (
      Object.keys(rowSelection).length +
      (hasSelectedRow && !Object.keys(rowSelection).length ? 1 : 0)
    );
  }, [rowSelection, hasSelectedRow]);

  // Helper function to check if a row is selected via the selectedRow prop
  const isRowSelected = useCallback(
    (row: Row<TData>): boolean => {
      if (!selectedRow) return false;

      // Compare IDs to determine if this row is selected
      const rowId = (row.original as any)?.id;
      const selectedId = (selectedRow as any)?.id;

      return (
        rowId !== undefined && selectedId !== undefined && rowId === selectedId
      );
    },
    [selectedRow]
  );

  const handleBulkAction = async (action: "activate" | "deactivate") => {
    if (isBatchProcessing) return;
    setIsProcessing(true);

    try {
      // Get IDs from selected rows
      const selectedDriverIds = table
        .getSelectedRowModel()
        .rows.map((row) => {
          const driver = row.original as any;
          return driver?.id ? parseInt(String(driver.id)) : null;
        })
        .filter((id): id is number => id !== null);

      if (selectedDriverIds.length === 0 && selectedRow) {
        // If no rows are selected but we have a selectedRow, use that
        const driver = selectedRow as any;
        const selectedDriverId = driver?.id
          ? parseInt(String(driver.id))
          : null;
        if (selectedDriverId !== null) {
          selectedDriverIds.push(selectedDriverId);
        }
      }

      if (selectedDriverIds.length === 0) {
        toast({
          title: "No drivers selected",
          description:
            "Please select one or more drivers to perform this action",
        });
        return;
      }

      // Call the appropriate handler based on the action
      if (action === "activate" && onActivateSelected) {
        await onActivateSelected(selectedDriverIds);
      } else if (action === "deactivate" && onDeactivateSelected) {
        await onDeactivateSelected(selectedDriverIds);
      }

      // Clear selection
      table.resetRowSelection();
    } catch (error) {
      console.error(`Error performing bulk ${action} action:`, error);
      toast({
        title: "Error",
        description: `Failed to ${action} drivers: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const exportToCSV = () => {
    if (!data || data.length === 0) {
      toast({
        title: "No data to export",
        description: "There is no data available to export.",
        variant: "destructive",
      });
      return;
    }

    try {
      const visibleColumns = table
        .getAllColumns()
        .filter((column) => column.getIsVisible());
      const headers = visibleColumns.map((column) => {
        // Use the column ID as header with some formatting
        return column.id
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());
      });

      // Extract data from visible rows and columns
      const csvRows = [headers];

      // Get visible rows
      const visibleRows = table.getRowModel().rows;

      visibleRows.forEach((row) => {
        const rowData: string[] = [];
        visibleColumns.forEach((column) => {
          // Get the cell value
          const cell = row.getAllCells().find((c) => c.column.id === column.id);
          if (cell) {
            // Convert any complex value to a simple string
            let value = String(cell.getValue() || "");

            // Clean the value for CSV (handle commas, quotes)
            if (
              value.includes(",") ||
              value.includes('"') ||
              value.includes("\n")
            ) {
              value = `"${value.replace(/"/g, '""')}"`;
            }

            rowData.push(value);
          } else {
            rowData.push("");
          }
        });
        csvRows.push(rowData);
      });

      // Convert to CSV string
      const csvContent = csvRows.map((row) => row.join(",")).join("\n");

      // Create a Blob and download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", "drivers_export.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error exporting to CSV:", error);
      toast({
        title: "Export Failed",
        description: "Failed to export data to CSV.",
        variant: "destructive",
      });
    }
  };

  const handleRowClickEvent = (e: React.MouseEvent, row: Row<TData>) => {
    e.preventDefault();
    e.stopPropagation();

    // If we're clicking on a checkbox, button, or link, don't trigger row click
    if (
      e.target instanceof HTMLElement &&
      (e.target.closest("button") ||
        e.target.closest("a") ||
        e.target.closest("input[type='checkbox']"))
    ) {
      return;
    }

    // Call the onRowClick handler if provided
    if (onRowClick) {
      onRowClick(row);
    }
  };

  const updateDriverOptimistically = useCallback(
    (id: string, updates: Partial<Driver>) => {
      contextSetProcessingDriver(id, true);
    },
    [contextSetProcessingDriver]
  );

  const handleCall = (phoneNumber: string) => {
    window.location.href = `tel:${phoneNumber}`;
  };

  const handleText = (phoneNumber: string) => {
    window.location.href = `sms:${phoneNumber}`;
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-destructive/15 text-destructive px-4 py-2 rounded-md">
          {error}
        </div>
      )}

      <TableToolbar
        table={table}
        hasSelectedRows={hasSelectedRows}
        selectedRowCount={selectedRowCount}
        totalRows={data?.length || 0}
        allSelectedActive={allSelectedActive}
        allSelectedInactive={allSelectedInactive}
        isProcessing={isBatchProcessing}
        handleBulkAction={handleBulkAction}
        exportToCSV={exportToCSV}
        showAdvancedFilters={showAdvancedFilters}
        setShowAdvancedFilters={setShowAdvancedFilters}
      />

      {showAdvancedFilters && (
        <div className="p-4 space-y-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Status
              </label>
              <Select
                value={
                  (table.getColumn("status")?.getFilterValue() as string) ??
                  "all"
                }
                onValueChange={(value) =>
                  table
                    .getColumn("status")
                    ?.setFilterValue(value === "all" ? "" : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Company
              </label>
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  {companies.map((company) => (
                    <SelectItem key={company} value={company}>
                      {company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Driver Type
              </label>
              <Select
                value={
                  (table.getColumn("type")?.getFilterValue() as string) ?? "all"
                }
                onValueChange={(value) =>
                  table
                    .getColumn("type")
                    ?.setFilterValue(value === "all" ? "" : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Solo">Solo</SelectItem>
                  <SelectItem value="Team">Team</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Documents
              </label>
              <Select
                value={
                  (table.getColumn("documents")?.getFilterValue() as string) ??
                  "all"
                }
                onValueChange={(value) =>
                  table
                    .getColumn("documents")
                    ?.setFilterValue(value === "all" ? "" : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by documents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Documents</SelectItem>
                  <SelectItem value="issues">Has Issues</SelectItem>
                  <SelectItem value="no_issues">No Issues</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-md border overflow-hidden bg-white dark:bg-slate-800/30">
        <div className="relative w-full overflow-auto">
          <Table className="w-full caption-bottom text-sm">
            <TableHeader className="bg-slate-50 dark:bg-slate-800/50 relative z-10">
              <TableRow className="border-b border-slate-200 dark:border-slate-700 hover:bg-transparent">
                <TableHead className="w-[30px] h-12 px-4 text-slate-700 dark:text-slate-300 font-medium text-left">
                  <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) =>
                      table.toggleAllPageRowsSelected(!!value)
                    }
                    aria-label="Select all"
                    className="translate-y-[2px]"
                  />
                </TableHead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <React.Fragment key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      if (!header.column.getCanHide()) return null;
                      return (
                        <TableHead
                          key={header.id}
                          className="h-12 px-4 text-slate-700 dark:text-slate-300 font-medium text-left"
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      );
                    })}
                  </React.Fragment>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={
                      row.getIsSelected() || isRowSelected(row)
                        ? "selected"
                        : ""
                    }
                    data-loading={loadingRows[row.id] ? "true" : undefined}
                    className={cn(
                      "border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50",
                      row.getIsSelected() || isRowSelected(row)
                        ? "bg-slate-100 dark:bg-slate-800/60 data-[state=selected]:bg-slate-100 dark:data-[state=selected]:bg-slate-800/60"
                        : "",
                      "cursor-pointer transition-colors duration-200 tr-hoverable",
                      loadingRows[row.id] && "opacity-70 pointer-events-none",
                      (processingDrivers as any)?.[(row.original as any)?.id] &&
                        "opacity-50"
                    )}
                    onClick={(e) => handleRowClickEvent(e, row)}
                    onDoubleClick={() => onRowDoubleClick?.(row)}
                  >
                    <TableCell className="w-[30px] p-4 align-middle checkbox-cell">
                      <Checkbox
                        checked={row.getIsSelected() || isRowSelected(row)}
                        onCheckedChange={(value) => row.toggleSelected(!!value)}
                        aria-label="Select row"
                        className="translate-y-[2px] checkbox"
                      />
                    </TableCell>
                    {row.getVisibleCells().map((cell) => {
                      const columnId = cell.column.id;
                      const driver = row.original as Driver;
                      return (
                        <TableCell
                          key={cell.id}
                          data-column={columnId}
                          className={`p-4 align-middle ${columnId === "actions" ? "text-center" : ""}`}
                        >
                          {(columnId === "status" || columnId === "actions") &&
                            (() => {
                              console.log(
                                `Rendering ${columnId} for driver ${String(driver.id)}`,
                                {
                                  isProcessing:
                                    processingDrivers[String(driver.id)],
                                  processingDrivers,
                                }
                              );
                              return null;
                            })()}

                          {columnId === "status" ? (
                            <StatusBadge
                              status={cell.getValue() as string}
                              isProcessing={
                                processingDrivers[String(driver.id)] || false
                              }
                              driverId={String(driver.id)}
                            />
                          ) : columnId === "actions" ? (
                            <QuickActions
                              row={row as Row<Driver>}
                              processingDrivers={processingDrivers}
                              setProcessingDriver={setProcessingDriver}
                              updateDriverOptimistically={
                                updateDriverOptimistically
                              }
                              updateDrivers={async (
                                id: number,
                                data: Partial<Driver>
                              ) => {
                                try {
                                  return await updateDriverAction(id, data);
                                } catch (error) {
                                  console.error(
                                    "Failed to update driver:",
                                    error
                                  );
                                  throw error;
                                }
                              }}
                              onViewDetails={
                                onViewDetails as
                                  | ((driver: Driver) => void)
                                  | undefined
                              }
                            />
                          ) : columnId === "phone_number" ? (
                            <div className="flex items-center gap-2">
                              <span className="min-w-[120px]">
                                {(cell.getValue() as string)
                                  ? formatPhoneNumber(cell.getValue() as string)
                                  : "N/A"}
                              </span>
                              {(cell.getValue() as string) && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 hover:bg-green-50"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCall(cell.getValue() as string);
                                    }}
                                    title="Call driver"
                                  >
                                    <Phone className="h-4 w-4 text-green-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 hover:bg-blue-50"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleText(cell.getValue() as string);
                                    }}
                                    title="Text driver"
                                  >
                                    <MessageSquare className="h-4 w-4 text-blue-600" />
                                  </Button>
                                </>
                              )}
                            </div>
                          ) : (
                            flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              ) : !isLoading && !error ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + 1}
                    className="h-24 text-center"
                  >
                    No results.
                  </TableCell>
                </TableRow>
              ) : null}

              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => <LoadingRow key={i} />)}

              {error && (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + 1}
                    className="h-24 text-center text-red-500"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="h-5 w-5" />
                      <p>Error loading drivers: {error}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refreshDrivers(true)}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Retry
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <TablePagination table={table} />
    </div>
  );
}

function LoadingRow() {
  return (
    <TableRow className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <TableCell className="p-4 align-middle w-[30px]">
        <Skeleton className="h-4 w-4" />
      </TableCell>
      <TableCell className="p-4 align-middle">
        <div className="flex flex-col space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </TableCell>
      <TableCell className="p-4 align-middle">
        <Skeleton className="h-4 w-32" />
      </TableCell>
      <TableCell className="p-4 align-middle">
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell className="p-4 align-middle">
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell className="p-4 align-middle">
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell className="p-4 align-middle">
        <Skeleton className="h-6 w-24" />
      </TableCell>
      <TableCell className="p-4 align-middle">
        <Skeleton className="h-4 w-24" />
      </TableCell>
    </TableRow>
  );
}

interface StatusBadgeProps {
  status: string;
  isProcessing?: boolean;
  driverId?: string;
}

function StatusBadge({
  status,
  isProcessing = false,
  driverId,
}: StatusBadgeProps) {
  const variants = {
    active: {
      variant: "success" as const,
      icon: CheckCircle,
      className:
        "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400 hover:bg-green-500/20 dark:hover:bg-green-500/30 border-green-500/20 dark:border-green-500/30",
    },
    inactive: {
      variant: "secondary" as const,
      icon: XCircle,
      className:
        "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600",
    },
    pending: {
      variant: "outline" as const,
      icon: Clock,
      className:
        "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 hover:bg-blue-500/20 dark:hover:bg-blue-500/30 border-blue-500/20 dark:border-blue-500/30",
    },
  };

  const config = variants[status.toLowerCase() as keyof typeof variants] || {
    variant: "outline" as const,
    icon: AlertCircle,
    className:
      "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600",
  };

  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={cn("h-6 badge", config.className)}
    >
      {isProcessing ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Icon className="h-3 w-3" />
      )}
      {status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}
    </Badge>
  );
}

interface QuickActionsProps {
  row: Row<Driver>;
  processingDrivers: Record<string, boolean>;
  setProcessingDriver: (id: string, processing: boolean) => void;
  updateDriverOptimistically: (id: string, updates: Partial<Driver>) => void;
  updateDrivers: (id: number, data: Partial<Driver>) => Promise<Driver>;
  onViewDetails?: (driver: Driver) => void;
}

function QuickActions({
  row,
  processingDrivers,
  setProcessingDriver,
  updateDriverOptimistically,
  updateDrivers,
  onViewDetails,
}: QuickActionsProps): JSX.Element {
  const { toast } = useToast();
  const router = useRouter();
  const { refreshDrivers } = useDrivers();
  const [localProcessing, setLocalProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const driver = row.original;
  const driverId = String(driver.id);
  const isProcessing = processingDrivers[driverId] || localProcessing;

  // Handle status toggle with optimistic updates
  const handleStatusToggle = useCallback(async () => {
    try {
      console.log(`Starting status toggle for driver ${driverId}`);
      const newStatus = driver.status === "active" ? "inactive" : "active";

      // Set both states to true before any updates
      setLocalProcessing(true);
      setProcessingDriver(driverId, true);
      console.log(`Set processing states to true for driver ${driverId}`);

      // Store a complete copy of the original driver
      const originalDriver = JSON.parse(JSON.stringify(driver));

      // Create a complete copy with just the status changed
      const updatedDriver = {
        ...originalDriver,
        status: newStatus as "active" | "inactive" | "terminated" | "pending",
        updated_at: new Date().toISOString(),
      };

      // Apply the complete driver update directly
      updateDriverOptimistically(driverId, updatedDriver);
      console.log(`Applied optimistic update for driver ${driverId}`);

      // Call the API with just the status change
      const response = await updateDrivers(Number(driver.id), {
        status: newStatus as "active" | "inactive" | "terminated" | "pending",
      });

      console.log(`API call completed for driver ${driverId}`, response);

      if (!response) {
        throw new Error("Failed to update driver status");
      }

      // Show success state
      setShowSuccess(true);

      toast({
        title: "Success",
        description: `Driver status updated to ${newStatus}`,
      });

      // Clear success state after a delay
      setTimeout(() => {
        setShowSuccess(false);
      }, 1000);

      // Wait a short time to show animation before resetting the processing state
      setTimeout(() => {
        setLocalProcessing(false);
        setProcessingDriver(driverId, false);
        console.log(`Reset processing states for driver ${driverId}`);

        // Force a complete data refresh after the UI updates are done
        router.refresh();
        refreshDrivers(true);
      }, 300); // Short delay so user can see the success animation
    } catch (err) {
      console.error(`Error updating driver ${driverId}:`, err);

      // Revert to original status on error by restoring the complete original driver
      const originalDriver = JSON.parse(JSON.stringify(driver));
      updateDriverOptimistically(driverId, originalDriver);

      toast({
        title: "Error",
        description: `Failed to update driver status: ${err instanceof Error ? err.message : String(err)}`,
        variant: "destructive",
      });

      // Reset processing states on error
      setLocalProcessing(false);
      setProcessingDriver(driverId, false);

      // Force a complete data refresh to ensure UI is in sync
      router.refresh();
      refreshDrivers(true);
    }
  }, [
    driver,
    driverId,
    setProcessingDriver,
    updateDriverOptimistically,
    updateDrivers,
    toast,
    router,
    refreshDrivers,
  ]);

  // Show loading if either state is true
  const showLoading = isProcessing || localProcessing;

  // Handle view action - Updated to fix navigation issue
  const handleView = useCallback(() => {
    console.log("View details clicked for driver:", driver.id);

    if (onViewDetails) {
      onViewDetails(driver);
    } else {
      // Store data first
      sessionStorage.setItem("selectedDriver", JSON.stringify(driver));

      // Force a hard navigation by using window.location instead of router
      console.log("Forcing hard navigation to:", `/Drivers/${driver.id}`);

      // Add a small delay to ensure the session storage is set
      setTimeout(() => {
        window.location.href = `/Drivers/${driver.id}`;
      }, 10);
    }
  }, [driver, onViewDetails]);

  // Handle edit action - Updated to use window.location
  const handleEdit = useCallback(() => {
    // Store data first
    sessionStorage.setItem("selectedDriver", JSON.stringify(driver));

    // Force a hard navigation for edit page
    console.log(
      "Forcing hard navigation to edit page:",
      `/Drivers/${driver.id}/edit`
    );

    // Add a small delay to ensure the session storage is set
    setTimeout(() => {
      window.location.href = `/Drivers/${driver.id}/edit`;
    }, 10);
  }, [driver]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 mx-auto flex items-center justify-center transition-colors duration-200 ${
            showSuccess
              ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
              : ""
          }`}
          disabled={showLoading}
        >
          {showLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : showSuccess ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <MoreHorizontal className="h-5 w-5" />
          )}
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem onClick={handleView} disabled={showLoading}>
          <Eye className="mr-2 h-4 w-4" />
          View Details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleEdit} disabled={showLoading}>
          <Edit className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleStatusToggle}
          disabled={showLoading}
          className={
            driver.status === "active" ? "text-destructive" : "text-green-600"
          }
        >
          {showLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : driver.status === "active" ? (
            <Power className="mr-2 h-4 w-4" />
          ) : (
            <CheckCircle className="mr-2 h-4 w-4" />
          )}
          {showLoading
            ? "Processing..."
            : driver.status === "active"
              ? "Deactivate"
              : "Activate"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

QuickActions.displayName = "QuickActions";
