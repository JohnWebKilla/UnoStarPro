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
  CreditCard,
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
import { Company, CompanyMeta } from "./types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  loadingRows?: Record<number, boolean>;
  meta?: CompanyMeta;
  error?: string;
  onUpdateCompanies?: (
    ids: number[],
    status: "active" | "inactive"
  ) => Promise<void>;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  loadingRows = {},
  meta,
  error,
  onUpdateCompanies,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);

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
    if (!onUpdateCompanies) return;

    try {
      setIsProcessing(true);
      const selectedRows = table.getFilteredSelectedRowModel().rows;
      const selectedIds = selectedRows.map((row) => (row.original as any).id);
      const status = action === "activate" ? "active" : "inactive";

      await onUpdateCompanies(selectedIds, status);
      setRowSelection({});
    } catch (error) {
      console.error(`Error ${action}ing companies:`, error);
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const hasSelectedRows = selectedRows.length > 0;
  const allSelectedActive =
    hasSelectedRows &&
    selectedRows.every((row) => (row.original as Company).status === "active");
  const allSelectedInactive =
    hasSelectedRows &&
    selectedRows.every(
      (row) => (row.original as Company).status === "inactive"
    );

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
            placeholder="Filter companies..."
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
                  />
                </TableHead>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      className="px-6 py-3 font-medium"
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
                    loadingRows[row.index] && "bg-muted/30",
                    row.getIsSelected() && "bg-muted/50"
                  )}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (
                      target.closest(".row-actions-menu") ||
                      target.closest("[data-dropdown-menu]") ||
                      target.closest('input[type="checkbox"]') ||
                      target.closest(".checkbox-wrapper")
                    ) {
                      e.stopPropagation();
                      return;
                    }

                    if (!loadingRows[row.index]) {
                      meta?.onRowClick?.(row.original as Company);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    const shouldEdit = window.confirm("Edit this company?");
                    if (shouldEdit) {
                      meta?.onEdit?.(row.original as Company);
                    }
                  }}
                  id={`table-row-${row.id}`}
                >
                  <TableCell className="w-12 px-6 py-3">
                    <div className="checkbox-wrapper">
                      <Checkbox
                        checked={row.getIsSelected()}
                        onCheckedChange={(value) => row.toggleSelected(!!value)}
                        aria-label="Select row"
                      />
                    </div>
                  </TableCell>
                  {loadingRows[row.index] && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[1px] z-10">
                      <div className="flex items-center space-x-2 bg-primary/10 px-3 py-1.5 rounded-full">
                        <Skeleton className="h-4 w-4 rounded-full animate-pulse bg-primary/30" />
                        <span className="text-xs font-medium">
                          Loading billing data...
                        </span>
                      </div>
                    </div>
                  )}
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-6 py-3">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
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
      <div className="flex items-center justify-between space-x-2">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
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
  );
}

function LoadingCell({ type }: { type: string }) {
  switch (type) {
    case "name":
      return (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-[140px]" />
          <Skeleton className="h-3 w-[100px]" />
        </div>
      );
    case "contact_name":
      return (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-[120px]" />
          <Skeleton className="h-3 w-[150px]" />
          <Skeleton className="h-3 w-[80px]" />
        </div>
      );
    case "subscription_amount":
      return (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-[80px]" />
          <Skeleton className="h-3 w-[120px]" />
        </div>
      );
    case "status":
      return <Skeleton className="h-6 w-[60px]" />;
    case "stripe_status":
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1">
            <Skeleton className="h-6 w-[80px]" />
            <Skeleton className="h-4 w-4" />
          </div>
          <Skeleton className="h-3 w-[100px]" />
        </div>
      );
    default:
      return <Skeleton className="h-4 w-[100px]" />;
  }
}
