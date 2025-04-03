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
} from "lucide-react";
import { useState } from "react";
import { Driver } from "../types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { useDrivers } from "./DriversProvider";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  loadingRows?: Record<number, boolean>;
  meta?: any;
  error?: string;
  onActivateSelected?: (ids: number[]) => Promise<void>;
  onDeactivateSelected?: (ids: number[]) => Promise<void>;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  loadingRows = {},
  meta,
  error,
  onActivateSelected,
  onDeactivateSelected,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const { updateDrivers } = useDrivers();

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
    initialState: {
      pagination: {
        pageSize: 5,
      },
    },
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
      const selectedRows = table.getFilteredSelectedRowModel().rows;
      const status = action === "activate" ? "active" : "inactive";

      await Promise.all(
        selectedRows.map((row) =>
          updateDrivers((row.original as any).id, { status })
        )
      );

      setRowSelection({});
    } catch (error) {
      console.error(`Error ${action}ing drivers:`, error);
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const hasSelectedRows = selectedRows.length > 0;
  const allSelectedActive =
    hasSelectedRows &&
    selectedRows.every((row) => (row.original as Driver).status === "active");
  const allSelectedInactive =
    hasSelectedRows &&
    selectedRows.every((row) => (row.original as Driver).status === "inactive");

  return (
    <div className="w-full space-y-4">
      {error && (
        <div className="bg-destructive/15 text-destructive px-4 py-2 rounded-md">
          {error}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <Input
            placeholder="Filter drivers..."
            value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("name")?.setFilterValue(event.target.value)
            }
            className="h-8 w-[150px] lg:w-[250px]"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                View
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[150px]">
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
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-2">
          {hasSelectedRows && (
            <>
              {!allSelectedActive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction("activate")}
                  disabled={isProcessing}
                  className="text-green-600 border-green-600 hover:bg-green-50 dark:text-green-400 dark:border-green-400 dark:hover:bg-green-900/20"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Activate Selected
                </Button>
              )}
              {!allSelectedInactive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction("deactivate")}
                  disabled={isProcessing}
                  className="text-red-600 border-red-600 hover:bg-red-50 dark:text-red-400 dark:border-red-400 dark:hover:bg-red-900/20"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Deactivate Selected
                </Button>
              )}
            </>
          )}
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                <TableHead className="w-12 px-6 py-3">
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
                </TableHead>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      className="px-6 py-3 font-medium text-left"
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
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={cn(
                    "cursor-pointer hover:bg-muted/50 relative",
                    loadingRows[row.index] && "bg-muted/30"
                  )}
                >
                  <TableCell className="px-6 py-3">
                    <Checkbox
                      checked={row.getIsSelected()}
                      onCheckedChange={(value) => row.toggleSelected(!!value)}
                      aria-label="Select row"
                      className="translate-y-[2px]"
                    />
                  </TableCell>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-6 py-3">
                      {loadingRows[row.index] ? (
                        <LoadingCell type={cell.column.id} />
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
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {selectedRows.length} of {table.getFilteredRowModel().rows.length}{" "}
          row(s) selected.
        </div>
        <div className="space-x-2">
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
  );
}

function LoadingCell({ type }: { type: string }) {
  switch (type) {
    case "name":
      return (
        <div className="flex flex-col gap-1">
          <Skeleton className="h-4 w-[120px]" />
          <Skeleton className="h-3 w-[80px]" />
        </div>
      );
    case "status":
      return <Skeleton className="h-6 w-[80px]" />;
    case "subscription":
      return <Skeleton className="h-6 w-[100px]" />;
    case "documents":
      return <Skeleton className="h-8 w-[80px]" />;
    default:
      return <Skeleton className="h-4 w-[80px]" />;
  }
}
