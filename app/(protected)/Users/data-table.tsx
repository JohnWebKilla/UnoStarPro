"use client";

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
import { useState, useMemo, useCallback, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronUp, Cake, Bell } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getBirthdayStatus, User } from "./columns"; // Move the helper function to a shared location
import { TooltipProvider } from "@/components/ui/tooltip";
import { EditUserDialog } from "./edit-user-dialog";

const variantMap = {
  active: "default",
  pending: "outline",
  inactive: "destructive",
} as const;

interface DataTableProps<TData extends User, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  onEdit?: (user: User) => void;
  onToggleStatus?: (user: User) => Promise<void>;
  onApprove?: (user: User) => Promise<void>;
  onManageCompanies?: (user: User) => void;
}

export function DataTable<TData extends User, TValue>({
  columns,
  data,
  onEdit,
  onToggleStatus,
  onApprove,
  onManageCompanies,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<TData | undefined>();

  // Memoize the table instance
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
    meta: {
      setSelectedUser: (user: User) => setSelectedUser(user as TData),
      setDialogOpen,
    },
  });

  // Add cleanup effect
  useEffect(() => {
    return () => {
      // Cleanup on unmount
      setSelectedUser(undefined);
      setDialogOpen(false);
    };
  }, []);

  // Simplify the handlers to be synchronous
  const handleDialogChange = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      // Clear selection after dialog is fully closed
      const timeout = setTimeout(() => {
        setSelectedUser(undefined);
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, []);

  const handleSuccess = useCallback(async () => {
    if (!selectedUser) return;

    try {
      await onEdit?.(selectedUser);
      // Close dialog immediately
      setDialogOpen(false);
      // Clear user after a frame to allow dialog to start closing
      requestAnimationFrame(() => {
        setSelectedUser(undefined);
      });
    } catch (error) {
      console.error("Error handling edit:", error);
    }
  }, [onEdit, selectedUser]);

  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Create filtered data based on role and status
  const filteredData = useMemo(() => {
    return data.filter((item: User) => {
      const matchesRole = roleFilter === "all" || item.role === roleFilter;
      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;
      return matchesRole && matchesStatus;
    });
  }, [data, roleFilter, statusFilter]);

  const tableFiltered = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
  });

  const toggleRow = (rowId: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [rowId]: !prev[rowId],
    }));
  };

  const renderMobileCard = (row: any) => {
    const isExpanded = expandedRows[row.id];

    try {
      const cells = row.getVisibleCells();
      const userData = row.original;

      return (
        <div key={row.id} className="bg-card rounded-lg shadow-sm mb-2 p-4">
          <div className="flex justify-between items-center">
            <div
              className="flex items-center space-x-3 flex-1 cursor-pointer"
              onClick={() => toggleRow(row.id)}
            >
              {/* Avatar section */}
              <div className="flex-shrink-0">
                {userData.avatar && (
                  <Avatar>
                    <AvatarImage
                      src={userData.avatar}
                      alt={userData.first_name}
                    />
                    <AvatarFallback>
                      {userData.first_name?.[0]}
                      {userData.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>

              {/* User info section */}
              <div>
                <div className="font-medium">
                  {userData.first_name} {userData.last_name}
                </div>
                <div className="text-sm text-muted-foreground">
                  {userData.email}
                </div>
                <div className="text-sm text-muted-foreground">
                  {userData.role}
                </div>
              </div>
            </div>

            {/* Actions Menu */}
            <div className="flex items-center space-x-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setSelectedUser(userData)}>
                    Edit
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <button
                onClick={() => toggleRow(row.id)}
                className="focus:outline-none"
              >
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          {/* Expanded details */}
          {isExpanded && (
            <div className="mt-4 space-y-2">
              {userData.email && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Email</span>
                  <span className="text-sm">{userData.email}</span>
                </div>
              )}
              {userData.phone_number && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Phone</span>
                  <span className="text-sm">{userData.phone_number}</span>
                </div>
              )}
              {userData.status && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span className="text-sm">
                    <Badge
                      variant={
                        variantMap[userData.status as keyof typeof variantMap]
                      }
                    >
                      {userData.status}
                    </Badge>
                  </span>
                </div>
              )}
              {userData.created_at && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Joined</span>
                  <span className="text-sm">
                    {new Date(userData.created_at).toLocaleDateString()}
                  </span>
                </div>
              )}
              {userData.dob && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Date of Birth
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">
                      {new Date(userData.dob).toLocaleDateString()}
                    </span>
                    {getBirthdayStatus(userData.dob) === "today" && (
                      <Tooltip>
                        <TooltipTrigger>
                          <Cake className="h-4 w-4 text-pink-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Birthday Today! 🎉</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {getBirthdayStatus(userData.dob) === "upcoming" && (
                      <Tooltip>
                        <TooltipTrigger>
                          <Bell className="h-4 w-4 text-yellow-500 animate-pulse" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Upcoming Birthday! 🎈</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      );
    } catch (error) {
      console.error("Error rendering mobile card:", error);
      return null;
    }
  };

  // Filter options
  const roleOptions = ["all", "admin", "driver", "customer"];
  const statusOptions = ["all", "active", "pending", "inactive"];

  const handleRoleChange = (value: string) => {
    setRoleFilter(value);
    tableFiltered.setGlobalFilter(""); // Reset global filter when changing role
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    tableFiltered.setGlobalFilter(""); // Reset global filter when changing status
  };

  return (
    <TooltipProvider>
      <div>
        {/* Filters Section */}
        <div className="space-y-4 md:space-y-0 md:flex md:items-center md:justify-between py-4">
          <div className="flex flex-col md:flex-row gap-4">
            <Input
              placeholder="Search..."
              value={globalFilter ?? ""}
              onChange={(event) => setGlobalFilter(event.target.value)}
              className="w-full md:w-[250px]"
            />
            <div className="flex gap-2">
              <Select value={roleFilter} onValueChange={handleRoleChange}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Select Role" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Mobile Cards View */}
        <div className="md:hidden">
          {tableFiltered.getRowModel().rows.map((row) => renderMobileCard(row))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block rounded-md border">
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
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
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
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-end space-x-2 py-4">
          <div className="flex-1 text-sm text-muted-foreground">
            {table.getFilteredRowModel().rows.length} user(s) total
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

        <EditUserDialog
          open={dialogOpen}
          onOpenChange={handleDialogChange}
          user={selectedUser}
          onSuccess={async (updatedUser) => {
            await onEdit?.(updatedUser);
            handleDialogChange(false);
          }}
        />
      </div>
    </TooltipProvider>
  );
}
