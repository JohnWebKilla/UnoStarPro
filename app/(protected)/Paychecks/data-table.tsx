"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  getFilteredRowModel,
  ColumnFiltersState,
  Row,
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
import { Search, X, Filter } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PayrollTransaction,
  MonthlyPayrollSummary,
  getOverallStatus,
} from "./types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading: boolean;
  skeletonRowCount?: number;
  lastUpdatedUserId?: string | null;
  onViewTransactions?: (userId: string) => void;
  emptyMessage?: string;
}

export function DataTable<TData extends MonthlyPayrollSummary, TValue>({
  columns,
  data,
  isLoading = false,
  skeletonRowCount = 5,
  lastUpdatedUserId = null,
  onViewTransactions,
  emptyMessage,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [shiftFilter, setShiftFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  // Extract unique departments and shifts from data
  const departments = Array.from(
    new Set(
      data
        .map((item) => (item as MonthlyPayrollSummary).department || "")
        .filter((dept) => dept !== "")
    )
  );

  const shifts = Array.from(
    new Set(
      data
        .map((item) => {
          const schedule = (item as MonthlyPayrollSummary).schedule;
          return schedule ? schedule.working_shift : "";
        })
        .filter((shift) => shift !== "")
    )
  );

  // Filter the data before passing it to the table
  const filteredData = useMemo(() => {
    return data.filter((summary) => {
      // Apply type filter
      if (typeFilter !== "all") {
        if (
          (typeFilter === "payment" && summary.base_payment <= 0) ||
          (typeFilter === "advance" && summary.advances <= 0) ||
          (typeFilter === "penalty" && summary.penalties <= 0) ||
          (typeFilter === "bonus" && summary.bonuses <= 0)
        ) {
          return false;
        }
      }

      // Apply status filter
      if (statusFilter !== "all") {
        const status = getOverallStatus(summary);
        if (status !== statusFilter) {
          return false;
        }
      }

      // Apply department filter
      if (
        departmentFilter !== "all" &&
        summary.department !== departmentFilter
      ) {
        return false;
      }

      // Apply shift filter
      if (shiftFilter !== "all") {
        if (
          !summary.schedule ||
          summary.schedule.working_shift !== shiftFilter
        ) {
          return false;
        }
      }

      // Apply global search filter
      if (globalFilter && globalFilter.length > 0) {
        const searchTerm = globalFilter.toLowerCase();
        const fullName =
          `${summary.first_name} ${summary.last_name}`.toLowerCase();
        const email = summary.email.toLowerCase();
        const department = summary.department?.toLowerCase() || "";

        // Convert amounts to strings for searching
        const amountStr = [
          summary.base_payment,
          summary.advances,
          summary.penalties,
          summary.bonuses,
          summary.total_amount,
          summary.paid_amount,
        ]
          .map((amount) => amount.toString())
          .join(" ");

        return (
          fullName.includes(searchTerm) ||
          email.includes(searchTerm) ||
          amountStr.includes(searchTerm) ||
          department.includes(searchTerm)
        );
      }

      return true;
    });
  }, [
    data,
    typeFilter,
    statusFilter,
    departmentFilter,
    shiftFilter,
    globalFilter,
  ]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
    meta: {
      onViewTransactions,
    },
  });

  // Count active filters for the filter button badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (typeFilter !== "all") count++;
    if (statusFilter !== "all") count++;
    if (departmentFilter !== "all") count++;
    if (shiftFilter !== "all") count++;
    if (globalFilter && globalFilter.length > 0) count++;
    return count;
  }, [typeFilter, statusFilter, departmentFilter, shiftFilter, globalFilter]);

  // Helper function to determine if a row should be highlighted
  const isHighlighted = (userId: string) => {
    return lastUpdatedUserId === userId;
  };

  // Generate skeleton rows
  const renderSkeletonRows = () => {
    return Array(skeletonRowCount)
      .fill(0)
      .map((_, index) => (
        <TableRow key={`skeleton-${index}`}>
          {columns.map((column, colIndex) => (
            <TableCell key={`skeleton-cell-${index}-${colIndex}`}>
              <Skeleton className="h-6 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ));
  };

  // Reset all filters
  const resetFilters = () => {
    setGlobalFilter("");
    setTypeFilter("all");
    setStatusFilter("all");
    setDepartmentFilter("all");
    setShiftFilter("all");
  };

  return (
    <div className="space-y-4">
      {/* Filters Section */}
      <div className="border rounded-md p-4">
        <div className="flex flex-col space-y-4">
          {/* Search and Filter Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, amount..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-8 pr-8"
                disabled={isLoading}
              />
              {globalFilter && (
                <button
                  onClick={() => setGlobalFilter("")}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Type Filter */}
            <div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Transaction Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="advance">Advance</SelectItem>
                  <SelectItem value="penalty">Penalty</SelectItem>
                  <SelectItem value="bonus">Bonus</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="partially_paid">Partially Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Department Filter */}
            <div>
              <Select
                value={departmentFilter}
                onValueChange={setDepartmentFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Shift Filter or Reset Button */}
            {activeFilterCount > 0 ? (
              <Button
                variant="outline"
                className="flex items-center justify-center"
                onClick={() => {
                  setTypeFilter("all");
                  setStatusFilter("all");
                  setDepartmentFilter("all");
                  setShiftFilter("all");
                  setGlobalFilter("");
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Reset Filters
                <Badge
                  variant="secondary"
                  className="ml-2 rounded-full px-1 py-0 text-xs"
                >
                  {activeFilterCount}
                </Badge>
              </Button>
            ) : (
              <div>
                <Select value={shiftFilter} onValueChange={setShiftFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Shift" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Shifts</SelectItem>
                    {shifts.map((shift) => (
                      <SelectItem key={shift} value={shift}>
                        {shift}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              renderSkeletonRows()
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={
                    isHighlighted(
                      (row.original as MonthlyPayrollSummary).user_id
                    )
                      ? "bg-blue-50 dark:bg-blue-900/20 transition-colors duration-500"
                      : ""
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
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
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  {emptyMessage || "No payroll data found."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between py-4">
        <span className="text-sm text-muted-foreground">
          {isLoading
            ? "Loading..."
            : `Showing ${table.getFilteredRowModel().rows.length} of ${data.length} transactions`}
        </span>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage() || isLoading}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage() || isLoading}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
