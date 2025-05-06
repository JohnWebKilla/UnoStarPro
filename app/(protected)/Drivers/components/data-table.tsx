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

interface TableToolbarProps {
  table: TableType<any>;
  hasSelectedRows: boolean;
  selectedRowCount: number;
  totalRows: number;
  allSelectedActive: boolean;
  allSelectedInactive: boolean;
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
  allSelectedActive,
  allSelectedInactive,
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
            {!allSelectedActive && (
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
            {!allSelectedInactive && (
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
          </>
        ) : (
          <>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={exportToCSV}
                    className="h-10 w-10 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40"
                  >
                    <FileDown className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export to CSV</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
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
  onViewDetails?: (driver: TData) => void;
  isProcessing?: boolean;
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
  onViewDetails,
  isProcessing: externalProcessing = false,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [companyFilter, setCompanyFilter] = useState("all");
  const [loadingRows, setLoadingRows] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [processingDrivers, setProcessingDrivers] = useState<
    Record<string, boolean>
  >({});
  const {
    processingDrivers: contextProcessingDrivers,
    setProcessingDriver: contextSetProcessingDriver,
    refreshDrivers,
  } = useDrivers();
  const router = useRouter();

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
  });

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const hasSelectedRows = selectedRows.length > 0;
  const allSelectedActive =
    hasSelectedRows &&
    selectedRows.every((row) => {
      const driver = row.original as Driver;
      return driver?.status === "active";
    });
  const allSelectedInactive =
    hasSelectedRows &&
    selectedRows.every((row) => {
      const driver = row.original as Driver;
      return driver?.status === "inactive";
    });

  const handleBulkAction = async (action: "activate" | "deactivate") => {
    if (processingDrivers || externalProcessing) return;

    const selectedIds = selectedRows
      .map((row) => {
        const driver = row.original as Driver;
        return driver?.id ? Number(driver.id) : null;
      })
      .filter((id): id is number => id !== null);

    if (selectedIds.length === 0) return;

    try {
      // Set processing state
      setProcessingDrivers((prev) => ({
        ...prev,
        ...Object.fromEntries(selectedIds.map((id) => [String(id), true])),
      }));

      // Apply optimistic updates
      const newStatus = action === "activate" ? "active" : "inactive";
      selectedIds.forEach((id) => {
        contextSetProcessingDriver(String(id), true);
      });

      // Perform the actual update
      if (action === "activate" && onActivateSelected) {
        await onActivateSelected(selectedIds);
      } else if (action === "deactivate" && onDeactivateSelected) {
        await onDeactivateSelected(selectedIds);
      }

      // Show success message
      toast({
        title: "Success",
        description: `Successfully ${action}d ${selectedIds.length} driver(s)`,
      });

      // Clear row selection
      table.toggleAllRowsSelected(false);
    } catch (error) {
      console.error(`Error during bulk ${action}:`, error);

      // Revert optimistic updates on error
      const originalStatus = action === "activate" ? "inactive" : "active";
      selectedIds.forEach((id) => {
        setProcessingDriver(String(id), false);
      });

      toast({
        title: "Error",
        description: `Failed to ${action} drivers: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      });
    } finally {
      // Clear processing states
      setProcessingDrivers((prev) => ({
        ...prev,
        ...Object.fromEntries(selectedIds.map((id) => [String(id), false])),
      }));

      // Force a refresh to ensure data consistency
      await refreshDrivers(true);
    }
  };

  const exportToCSV = () => {
    const selectedData = hasSelectedRows
      ? selectedRows.map((row) => row.original)
      : data;

    if (!selectedData || selectedData.length === 0) {
      toast({
        title: "No data to export",
        description:
          "Please select some rows or ensure there is data to export.",
        variant: "destructive",
      });
      return;
    }

    const headers = columns
      .filter((col: any) => col.accessorKey && col.getCanHide?.())
      .map((col: any) => col.accessorKey);

    const csvContent = [
      headers.join(","),
      ...selectedData.map((row) =>
        headers
          .map((header) => JSON.stringify((row as any)[header] || ""))
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `drivers_export_${new Date().toISOString()}.csv`;
    link.click();
  };

  const handleRowClick = (e: React.MouseEvent, row: Row<TData>) => {
    // Don't handle row clicks from within the checkbox cell or action buttons
    const target = e.target as HTMLElement;
    const isCheckboxClick =
      target.closest('[type="checkbox"]') ||
      target.closest(".checkbox-cell") ||
      target.classList.contains("checkbox-cell");

    const isActionButtonClick =
      target.closest("button") ||
      target.closest(".table-actions-visible") ||
      target.closest('[role="tooltip"]');

    if (isCheckboxClick || isActionButtonClick) {
      // Allow the checkbox or action button click to propagate naturally
      return;
    }

    // For regular row clicks, toggle selection
    row.toggleSelected(!row.getIsSelected());
  };

  const updateDriverOptimistically = useCallback(
    (id: string, updates: Partial<Driver>) => {
      contextSetProcessingDriver(id, true);
    },
    [contextSetProcessingDriver]
  );

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
        selectedRowCount={selectedRows.length}
        totalRows={data?.length || 0}
        allSelectedActive={allSelectedActive}
        allSelectedInactive={allSelectedInactive}
        isProcessing={
          Object.values(processingDrivers).some(Boolean) || externalProcessing
        }
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
                    data-state={row.getIsSelected() && "selected"}
                    data-loading={loadingRows[row.id] ? "true" : undefined}
                    className={cn(
                      "border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 data-[state=selected]:bg-slate-100 dark:data-[state=selected]:bg-slate-800/60",
                      "cursor-pointer transition-colors duration-200 tr-hoverable",
                      loadingRows[row.id] && "opacity-70 pointer-events-none",
                      (processingDrivers as any)?.[(row.original as any)?.id] &&
                        "opacity-50"
                    )}
                    onClick={(e) => handleRowClick(e, row)}
                    onDoubleClick={() => onRowDoubleClick?.(row)}
                  >
                    <TableCell className="w-[30px] p-4 align-middle checkbox-cell">
                      <Checkbox
                        checked={row.getIsSelected()}
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

      // Apply optimistic update immediately while preserving company data
      updateDriverOptimistically(driverId, {
        status: newStatus,
        updated_at: new Date().toISOString(),
        company_id: driver.company_id,
        company_name: driver.company_name,
        companies: driver.companies,
      });
      console.log(`Applied optimistic update for driver ${driverId}`);

      // Actual API call
      const updatedDriver = await updateDrivers(Number(driver.id), {
        status: newStatus,
        updated_at: new Date().toISOString(),
      });
      console.log(`API call completed for driver ${driverId}`, updatedDriver);

      if (!updatedDriver) {
        throw new Error("Failed to update driver status");
      }

      // Apply the changes from the server response to ensure UI is in sync
      // Preserve company data when applying server response
      updateDriverOptimistically(driverId, {
        ...updatedDriver,
        company_id: updatedDriver.company_id || driver.company_id,
        company_name: updatedDriver.company_name || driver.company_name,
        companies: updatedDriver.companies || driver.companies,
      });

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

      // Revert optimistic update while preserving company data
      updateDriverOptimistically(driverId, {
        status: driver.status,
        updated_at: driver.updated_at,
        company_id: driver.company_id,
        company_name: driver.company_name,
        companies: driver.companies,
      });

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
    driver.id,
    driverId,
    driver.status,
    driver.updated_at,
    driver.company_id,
    driver.company_name,
    driver.companies,
    setProcessingDriver,
    toast,
    updateDriverOptimistically,
    updateDrivers,
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
