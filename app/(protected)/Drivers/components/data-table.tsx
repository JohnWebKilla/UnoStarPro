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
} from "lucide-react";
import { useState } from "react";
import { Driver, DRIVER_STATUS_OPTIONS, DRIVER_TEAM_OPTIONS } from "../types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { useDrivers } from "./DriversProvider";
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

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  loadingRows?: Record<number, boolean>;
  loading?: boolean;
  meta?: any;
  error?: string;
  onActivateSelected?: (ids: number[]) => Promise<void>;
  onDeactivateSelected?: (ids: number[]) => Promise<void>;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  loadingRows = {},
  loading = false,
  meta,
  error,
  onActivateSelected,
  onDeactivateSelected,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "created_at", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const { updateDrivers, syncWithServer } = useDrivers();
  const router = useRouter();

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    enableMultiRowSelection: true,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    meta,
  });

  const handleBulkAction = async (action: "activate" | "deactivate") => {
    try {
      setIsProcessing(true);
      const selectedRows = table.getSelectedRowModel().rows;
      const status = action === "activate" ? "active" : "inactive";

      // Get all selected row IDs and convert them to numbers
      const selectedIds = selectedRows.map((row) =>
        Number((row.original as Driver).id)
      );

      // If onActivateSelected/onDeactivateSelected props are provided, use them
      if (action === "activate" && onActivateSelected) {
        await onActivateSelected(selectedIds);
      } else if (action === "deactivate" && onDeactivateSelected) {
        await onDeactivateSelected(selectedIds);
      } else {
        // Wait for all updates to complete before proceeding
        await Promise.all(
          selectedIds.map(async (id) => {
            try {
              await updateDrivers(id, { status });
            } catch (error) {
              console.error(`Error updating driver ${id}:`, error);
              throw error;
            }
          })
        );

        // Sync with server to get fresh data
        await syncWithServer();

        // Show success message
        toast({
          title: "Success",
          description: `Successfully ${action}d ${selectedIds.length} driver(s)`,
        });

        // Force a page refresh to ensure all data is up to date
        router.refresh();
      }

      // Clear selection after successful update
      setRowSelection({});
    } catch (error) {
      console.error(`Error ${action}ing drivers:`, error);
      toast({
        title: "Error",
        description: `Failed to ${action} some drivers. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectAllRows = React.useCallback(() => {
    const allRows = table.getFilteredRowModel().rows;
    const allRowIds = allRows.reduce(
      (acc, row) => {
        acc[row.id] = true;
        return acc;
      },
      {} as Record<string, boolean>
    );
    setRowSelection(allRowIds);
  }, [table]);

  const handleSelectCurrentPage = React.useCallback(() => {
    const pageRows = table.getRowModel().rows;
    const pageRowIds = pageRows.reduce(
      (acc, row) => {
        acc[row.id] = true;
        return acc;
      },
      {} as Record<string, boolean>
    );
    setRowSelection(pageRowIds);
  }, [table]);

  const handleClearSelection = React.useCallback(() => {
    setRowSelection({});
  }, []);

  const selectedRowCount = React.useMemo(
    () => Object.keys(rowSelection).length,
    [rowSelection]
  );

  const totalRows = React.useMemo(
    () => table.getFilteredRowModel().rows.length,
    [table]
  );

  const hasSelectedRows = selectedRowCount > 0;

  const allSelectedActive = React.useMemo(
    () =>
      hasSelectedRows &&
      Object.keys(rowSelection).every(
        (id) => (table.getRow(id).original as Driver).status === "active"
      ),
    [hasSelectedRows, rowSelection, table]
  );

  const allSelectedInactive = React.useMemo(
    () =>
      hasSelectedRows &&
      Object.keys(rowSelection).every(
        (id) => (table.getRow(id).original as Driver).status === "inactive"
      ),
    [hasSelectedRows, rowSelection, table]
  );

  const exportToCSV = React.useCallback(() => {
    const selectedRows =
      Object.keys(rowSelection).length > 0
        ? table.getSelectedRowModel().rows
        : table.getFilteredRowModel().rows;

    const headers = columns
      .filter((col: any) => col.accessorKey && col.getCanHide?.())
      .map((col: any) => col.accessorKey);

    const csvContent = [
      headers.join(","),
      ...selectedRows.map((row) =>
        headers
          .map((header) => JSON.stringify((row.original as any)[header] || ""))
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `drivers_export_${new Date().toISOString()}.csv`;
    link.click();
  }, [columns, rowSelection, table]);

  return (
    <div className="w-full space-y-4">
      {error && (
        <div className="bg-destructive/15 text-destructive px-4 py-2 rounded-md">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search drivers..."
              value={
                (table.getColumn("name")?.getFilterValue() as string) ?? ""
              }
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

      {showAdvancedFilters && (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          <Select
            value={
              (table.getColumn("status")?.getFilterValue() as string) ?? ""
            }
            onValueChange={(value) =>
              table.getColumn("status")?.setFilterValue(value)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All statuses</SelectItem>
              {DRIVER_STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status.toLowerCase()}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={(table.getColumn("type")?.getFilterValue() as string) ?? ""}
            onValueChange={(value) =>
              table.getColumn("type")?.setFilterValue(value)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All types</SelectItem>
              {DRIVER_TEAM_OPTIONS.map((type) => (
                <SelectItem key={type} value={type.toLowerCase()}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="rounded-md border">
        <div className="relative">
          <div className="overflow-hidden">
            <Table>
              <TableHeader className="bg-background">
                <TableRow>
                  <TableHead className="w-[40px] p-0 bg-background">
                    <div className="h-8 flex items-center justify-center">
                      <Checkbox
                        checked={
                          table.getIsAllPageRowsSelected() ||
                          (table.getIsSomePageRowsSelected() && "indeterminate")
                        }
                        onCheckedChange={(value) =>
                          table.toggleAllPageRowsSelected(!!value)
                        }
                        aria-label="Select all"
                        className="translate-y-[2px]"
                      />
                    </div>
                  </TableHead>
                  {table.getAllColumns().map((column) => {
                    if (!column.getIsVisible()) return null;
                    return (
                      <TableHead
                        key={column.id}
                        className={cn(
                          "h-8 bg-background py-1.5",
                          column.id === "actions" && "w-[100px]",
                          column.id === "name" && "w-[200px]",
                          column.id === "phone" && "w-[150px]",
                          column.id === "created_at" && "w-[120px]",
                          column.id === "type" && "w-[100px]",
                          column.id === "status" && "w-[100px]",
                          column.id === "documents" && "w-[100px]",
                          column.id === "stripe_status" && "w-[120px]",
                          column.id === "subscription_amount" && "w-[120px]",
                          column.id === "subscription" && "w-[120px]"
                        )}
                      >
                        {column.id === "actions" ? null : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-3 h-8"
                            onClick={() =>
                              column.toggleSorting(
                                column.getIsSorted() === "asc"
                              )
                            }
                          >
                            {column.id.charAt(0).toUpperCase() +
                              column.id.slice(1).replace(/_/g, " ")}
                            {column.getIsSorted() && (
                              <ChevronDown
                                className={cn(
                                  "ml-1 h-4 w-4",
                                  column.getIsSorted() === "desc" &&
                                    "rotate-180"
                                )}
                              />
                            )}
                          </Button>
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
            </Table>
          </div>
          <div
            className="overflow-auto scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent"
            style={{
              scrollbarGutter: "stable",
              maxHeight: "calc(100vh - 400px)",
              minHeight: "300px",
            }}
          >
            <Table>
              <TableBody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, index) => (
                    <LoadingRow key={index} />
                  ))
                ) : table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className={cn(
                        "group hover:bg-muted/50",
                        row.getIsSelected() && "bg-muted"
                      )}
                    >
                      <TableCell className="p-0 w-[40px]">
                        <div className="h-8 flex items-center justify-center">
                          <Checkbox
                            checked={row.getIsSelected()}
                            onCheckedChange={(value) =>
                              row.toggleSelected(!!value)
                            }
                            aria-label="Select row"
                            className="translate-y-[2px]"
                          />
                        </div>
                      </TableCell>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            "py-1.5",
                            cell.column.id === "actions" && "w-[100px]",
                            cell.column.id === "name" && "w-[200px]",
                            cell.column.id === "phone" && "w-[150px]",
                            cell.column.id === "created_at" && "w-[120px]",
                            cell.column.id === "type" && "w-[100px]",
                            cell.column.id === "status" && "w-[100px]",
                            cell.column.id === "documents" && "w-[100px]",
                            cell.column.id === "stripe_status" && "w-[120px]",
                            cell.column.id === "subscription_amount" &&
                              "w-[120px]",
                            cell.column.id === "subscription" && "w-[120px]",
                            loadingRows[row.index] && "animate-pulse"
                          )}
                        >
                          {loadingRows[row.index] ? (
                            <LoadingCell type={cell.column.id} />
                          ) : cell.column.id === "status" ? (
                            <StatusBadge status={cell.getValue() as string} />
                          ) : cell.column.id === "actions" ? (
                            <QuickActions row={row} />
                          ) : (
                            flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )
                          )}
                        </TableCell>
                      ))}
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
        </div>
      </div>

      <div className="flex items-center justify-between space-x-2 py-4">
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
      <TableCell>
        <Skeleton className="h-4 w-4" />
      </TableCell>
      <TableCell>
        <LoadingCell type="name" />
      </TableCell>
      <TableCell>
        <LoadingCell type="phone" />
      </TableCell>
      <TableCell>
        <LoadingCell type="truck" />
      </TableCell>
      <TableCell>
        <LoadingCell type="type" />
      </TableCell>
      <TableCell>
        <LoadingCell type="status" />
      </TableCell>
      <TableCell>
        <LoadingCell type="documents" />
      </TableCell>
      <TableCell>
        <LoadingCell type="subscription" />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      </TableCell>
    </TableRow>
  );
}

const StatusBadge = ({ status }: { status: string }) => {
  const statusStyles = {
    active:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    inactive:
      "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
    terminated: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    pending:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    connected:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    disconnected:
      "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  };

  return (
    <Badge
      variant="secondary"
      className={cn(
        "capitalize",
        statusStyles[status as keyof typeof statusStyles] ||
          "bg-gray-100 text-gray-800"
      )}
    >
      {status}
    </Badge>
  );
};

const QuickActions = ({ row }: { row: any }) => {
  const { updateDrivers } = useDrivers();
  const [isLoading, setIsLoading] = useState(false);

  const handleStatusToggle = async () => {
    try {
      setIsLoading(true);
      const currentStatus = row.original.status;
      const newStatus = currentStatus === "active" ? "inactive" : "active";
      await updateDrivers(row.original.id, { status: newStatus });
    } catch (error) {
      console.error("Error updating driver status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleStatusToggle}
              disabled={isLoading}
            >
              {row.original.status === "active" ? (
                <XCircle className="h-4 w-4 text-destructive" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-600" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {row.original.status === "active" ? "Deactivate" : "Activate"}{" "}
            driver
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link href={`/Drivers/${row.original.id}`}>
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
              <Link href={`/Drivers/${row.original.id}/edit`}>
                <Edit className="h-4 w-4" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit driver</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};
