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
} from "lucide-react";
import { useState, ReactNode } from "react";
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
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search drivers..."
            value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("name")?.setFilterValue(event.target.value)
            }
            className="pl-8 h-10"
          />
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              >
                <Filter className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle advanced filters</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <DropdownMenu>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <SlidersHorizontal className="h-4 w-4" />
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
            <div className="text-sm text-muted-foreground">
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
                    className="h-10 w-10"
                  >
                    <FileDown className="h-4 w-4" />
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
    <div className="flex items-center justify-end space-x-2 py-4">
      <div className="flex-1 text-sm text-muted-foreground">
        {table.getFilteredRowModel().rows.length} driver(s) total.
      </div>
      <div className="flex items-center space-x-6 lg:space-x-8">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium">Rows per page</p>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
          >
            <SelectTrigger className="h-8 w-[70px]">
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
        <div className="flex w-[100px] items-center justify-center text-sm font-medium">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount()}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">Go to first page</span>
            <ChevronDown className="h-4 w-4 rotate-90" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">Go to previous page</span>
            <ChevronDown className="h-4 w-4 rotate-90" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">Go to next page</span>
            <ChevronDown className="h-4 w-4 -rotate-90" />
          </Button>
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">Go to last page</span>
            <ChevronDown className="h-4 w-4 -rotate-90" />
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
  onRowClick?: (row: Row<TData>) => void;
}

export function DataTable<TData>({
  columns,
  data,
  error,
  onActivateSelected,
  onDeactivateSelected,
  rowSelection = {},
  onRowSelectionChange,
  onRowClick,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingRows, setLoadingRows] = useState<Record<string, boolean>>({});
  const { processingDrivers, handleRowClick, updateDriverOptimistically } =
    useDrivers();

  const table = useReactTable({
    data: data || [], // Ensure data is never undefined
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onRowSelectionChange,
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
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
    const selectedIds = selectedRows
      .map((row) => {
        const driver = row.original as Driver;
        return driver?.id ? Number(driver.id) : null;
      })
      .filter((id): id is number => id !== null);

    if (action === "activate" && onActivateSelected) {
      await onActivateSelected(selectedIds);
    } else if (action === "deactivate" && onDeactivateSelected) {
      await onDeactivateSelected(selectedIds);
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

  // Function to handle row click with loading state
  const handleRowClickWithLoading = React.useCallback(
    (row: Row<TData>, e: React.MouseEvent) => {
      if (typeof onRowClick === "function") {
        // Apply visual feedback immediately
        const target = e.currentTarget;
        target.classList.add("row-clicked");

        // Set row as loading
        setLoadingRows((prev) => ({ ...prev, [row.id]: true }));

        // Call the actual click handler
        onRowClick(row);
      }
    },
    [onRowClick]
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
        isProcessing={isProcessing}
        handleBulkAction={handleBulkAction}
        exportToCSV={exportToCSV}
        showAdvancedFilters={showAdvancedFilters}
        setShowAdvancedFilters={setShowAdvancedFilters}
      />

      {showAdvancedFilters && (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          <Select
            value={
              (table.getColumn("status")?.getFilterValue() as string) ?? "all"
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
              <SelectItem value="all">All statuses</SelectItem>
              {DRIVER_STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status.toLowerCase()}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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
              <SelectItem value="all">All types</SelectItem>
              {DRIVER_TEAM_OPTIONS.map((type) => (
                <SelectItem key={type} value={type.toLowerCase()}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="drivers-table-container rounded-md border">
        <Table className="drivers-table">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30px]">
                <Checkbox
                  checked={table.getIsAllPageRowsSelected()}
                  onCheckedChange={(value) =>
                    table.toggleAllPageRowsSelected(!!value)
                  }
                  aria-label="Select all"
                  className="translate-y-[2px]"
                />
              </TableHead>
              {table.getAllColumns().map((column) => {
                if (!column.getCanHide()) return null;
                return (
                  <TableHead key={column.id}>
                    {column.id.charAt(0).toUpperCase() +
                      column.id.slice(1).replace(/_/g, " ")}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  data-loading={loadingRows[row.id] ? "true" : undefined}
                  onClick={(e) => handleRowClickWithLoading(row, e)}
                  className={cn(
                    "transition-colors cursor-pointer hover:bg-muted/50",
                    row.getIsSelected() && "bg-muted/50",
                    loadingRows[row.id] && "opacity-70"
                  )}
                >
                  <TableCell className="w-[30px]">
                    <Checkbox
                      checked={row.getIsSelected()}
                      onCheckedChange={(value) => row.toggleSelected(!!value)}
                      aria-label="Select row"
                      className="translate-y-[2px]"
                    />
                  </TableCell>
                  {row.getVisibleCells().map((cell) => {
                    const columnId = cell.column.id;
                    const driver = row.original as Driver;
                    return (
                      <TableCell key={cell.id} data-column={columnId}>
                        {columnId === "status" ? (
                          <StatusBadge
                            status={cell.getValue() as string}
                            isProcessing={processingDrivers[driver.id]}
                          />
                        ) : columnId === "actions" ? (
                          <QuickActions
                            row={row as Row<Driver>}
                            processingDrivers={processingDrivers}
                            setProcessingDriver={(id, processing) => {
                              setIsProcessing(processing);
                            }}
                            updateDriverOptimistically={
                              updateDriverOptimistically
                            }
                            updateDrivers={async (id, data) => {
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
                          />
                        ) : (
                          <div className="truncate">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </div>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="flex items-center space-x-6 lg:space-x-8">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">Rows per page</p>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => {
                table.setPageSize(Number(value));
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue
                  placeholder={table.getState().pagination.pageSize}
                />
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
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface LoadingCellProps {
  type: string;
}

function LoadingCell({ type }: LoadingCellProps) {
  const getSkeletonWidth = () => {
    switch (type) {
      case "name":
        return "w-[150px]";
      case "phone":
        return "w-[120px]";
      case "status":
        return "w-[80px]";
      case "type":
        return "w-[60px]";
      default:
        return "w-[100px]";
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <Skeleton className={cn("h-4", getSkeletonWidth())} />
    </div>
  );
}

function LoadingRow() {
  return (
    <TableRow>
      <TableCell className="w-[40px] p-0">
        <div className="h-8 flex items-center justify-center">
          <Skeleton className="h-4 w-4" />
        </div>
      </TableCell>
      <TableCell data-column="name">
        <LoadingCell type="name" />
      </TableCell>
      <TableCell data-column="phone">
        <LoadingCell type="phone" />
      </TableCell>
      <TableCell data-column="created_at">
        <LoadingCell type="created_at" />
      </TableCell>
      <TableCell data-column="type">
        <LoadingCell type="type" />
      </TableCell>
      <TableCell data-column="status">
        <LoadingCell type="status" />
      </TableCell>
      <TableCell data-column="documents">
        <LoadingCell type="documents" />
      </TableCell>
      <TableCell data-column="stripe_status">
        <LoadingCell type="stripe_status" />
      </TableCell>
      <TableCell data-column="subscription">
        <LoadingCell type="subscription" />
      </TableCell>
      <TableCell data-column="actions">
        <div className="action-buttons">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      </TableCell>
    </TableRow>
  );
}

interface StatusBadgeProps {
  status: string;
  isProcessing?: boolean;
}

const StatusBadge = React.memo(
  ({ status, isProcessing }: StatusBadgeProps): JSX.Element => {
    const getStatusColor = React.useMemo(
      () => (status: string) => {
        switch (status.toLowerCase()) {
          case "active":
            return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
          case "inactive":
            return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
          default:
            return "bg-gray-100 text-gray-800";
        }
      },
      []
    );

    return (
      <div className="flex items-center gap-2">
        <Badge className={cn("capitalize", getStatusColor(status))}>
          {status}
        </Badge>
        {isProcessing && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
    );
  }
);

StatusBadge.displayName = "StatusBadge";

interface QuickActionsProps {
  row: Row<Driver>;
  processingDrivers: Record<string, boolean>;
  setProcessingDriver: (id: string, processing: boolean) => void;
  updateDriverOptimistically: (id: string, updates: Partial<Driver>) => void;
  updateDrivers: (id: number, data: Partial<Driver>) => Promise<Driver>;
}

const QuickActions = React.memo(
  ({
    row,
    processingDrivers,
    setProcessingDriver,
    updateDriverOptimistically,
    updateDrivers,
  }: QuickActionsProps): JSX.Element => {
    const driver = row.original;
    const isProcessing = processingDrivers[driver.id];

    const handleStatusToggle = React.useCallback(async () => {
      const newStatus = driver.status === "active" ? "inactive" : "active";
      try {
        setProcessingDriver(driver.id.toString(), true);
        updateDriverOptimistically(driver.id.toString(), { status: newStatus });
        await updateDrivers(Number(driver.id), { status: newStatus });
      } catch (error) {
        console.error("Error updating driver status:", error);
        updateDriverOptimistically(driver.id.toString(), {
          status: driver.status,
        });
        toast({
          title: "Error",
          description: "Failed to update driver status. Please try again.",
          variant: "destructive",
        });
      } finally {
        setProcessingDriver(driver.id.toString(), false);
      }
    }, [
      driver,
      setProcessingDriver,
      updateDriverOptimistically,
      updateDrivers,
    ]);

    return (
      <div className="flex items-center justify-end gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleStatusToggle}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : driver.status === "active" ? (
                  <XCircle className="h-4 w-4 text-destructive" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {driver.status === "active" ? "Deactivate" : "Activate"} driver
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                <Link href={`/Drivers/${driver.id}`}>
                  <Eye className="h-4 w-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>View driver details</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                <Link href={`/Drivers/${driver.id}/edit`}>
                  <Edit className="h-4 w-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit driver</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }
);

QuickActions.displayName = "QuickActions";
