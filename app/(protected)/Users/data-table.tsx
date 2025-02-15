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
import {
  ChevronDown,
  ChevronUp,
  Cake,
  Bell,
  MoreHorizontal,
  Pencil,
  Building,
  Power,
} from "lucide-react";
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
import { getBirthdayStatus } from "./columns"; // Only import getBirthdayStatus
import { User } from "./types"; // Import User from types
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
  meta: {
    onEdit: (user: User) => void;
    onToggleStatus: (user: User) => Promise<void>;
    onApprove: (user: User) => Promise<void>;
    onManageCompanies: (user: User) => void;
    companies: Array<{ id: number; name: string }>;
  };
}

// Add this helper function at the top level
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString();
};

export function DataTable<TData extends User, TValue>({
  columns,
  data,
  meta,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<TData | undefined>();
  const [globalFilter, setGlobalFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Memoize the table instance
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
    },
    meta,
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
      await meta.onEdit?.(selectedUser);
      // Close dialog immediately
      setDialogOpen(false);
      // Clear user after a frame to allow dialog to start closing
      requestAnimationFrame(() => {
        setSelectedUser(undefined);
      });
    } catch (error) {
      console.error("Error handling edit:", error);
    }
  }, [meta.onEdit, selectedUser]);

  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

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

  const renderMobileCard = (user: User) => {
    const isExpanded = expandedRows[user.id];
    const birthdayStatus = user.dob ? getBirthdayStatus(user.dob) : null;
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const handleAction = (action: () => void) => {
      // Close menu first
      setIsMenuOpen(false);
      // Small delay before action to ensure menu is closed
      setTimeout(() => {
        action();
      }, 100);
    };

    return (
      <div key={user.id} className="bg-card rounded-lg shadow-sm mb-4 p-4">
        <div className="flex justify-between items-start">
          <div className="flex items-start space-x-3">
            <Avatar>
              <AvatarImage
                src={user.avatar}
                alt={`${user.first_name} ${user.last_name}`}
              />
              <AvatarFallback>
                {user.first_name?.[0]}
                {user.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-medium">
                {user.first_name} {user.last_name}
              </h3>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant={variantMap[user.status as keyof typeof variantMap]}
                >
                  {user.status}
                </Badge>
                <span className="text-sm text-muted-foreground capitalize">
                  {user.role}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center">
            <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-[160px]"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenuItem
                  onClick={() => handleAction(() => meta.onEdit(user))}
                  className="flex items-center gap-2"
                >
                  <Pencil className="h-4 w-4" />
                  <span>Edit</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    handleAction(() => meta.onManageCompanies(user))
                  }
                  className="flex items-center gap-2"
                >
                  <Building className="h-4 w-4" />
                  <span>Manage Companies</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {user.status === "active" ? (
                  <DropdownMenuItem
                    className="text-destructive flex items-center gap-2"
                    onClick={() =>
                      handleAction(() => meta.onToggleStatus(user))
                    }
                  >
                    <Power className="h-4 w-4" />
                    <span>Deactivate</span>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    className="text-green-600 flex items-center gap-2"
                    onClick={() =>
                      handleAction(() => meta.onToggleStatus(user))
                    }
                  >
                    <Power className="h-4 w-4" />
                    <span>Activate</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Phone</span>
            <span>{user.phone_number || "-"}</span>
          </div>

          {user.dob && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Birthday</span>
              <div className="flex items-center gap-2">
                <span>{formatDate(user.dob)}</span>
                {birthdayStatus === "today" && (
                  <Cake className="h-4 w-4 text-pink-500" />
                )}
                {birthdayStatus === "upcoming" && (
                  <Bell className="h-4 w-4 text-yellow-500 animate-pulse" />
                )}
              </div>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Companies</span>
            <Button
              variant="link"
              className="h-auto p-0 text-blue-500"
              onClick={() => meta.onManageCompanies(user)}
            >
              {user.has_all_access
                ? "All Companies"
                : user.companies?.length
                  ? `${user.companies.length} Companies`
                  : "No Companies"}
            </Button>
          </div>
        </div>
      </div>
    );
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
        <div className="space-y-4 py-4">
          {/* Search and Filters Container */}
          <div className="flex flex-col space-y-4">
            {/* Search Bar */}
            <div className="w-full">
              <Input
                placeholder="Search users..."
                value={globalFilter ?? ""}
                onChange={(event) => setGlobalFilter(event.target.value)}
                className="w-full md:max-w-sm"
              />
            </div>

            {/* Filters Row */}
            <div className="flex flex-col sm:flex-row gap-2">
              {/* Role Filter */}
              <div className="w-full sm:w-auto">
                <Select value={roleFilter} onValueChange={handleRoleChange}>
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue placeholder="Role: All" />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role === "all"
                          ? "All Roles"
                          : role.charAt(0).toUpperCase() + role.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="w-full sm:w-auto">
                <Select value={statusFilter} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue placeholder="Status: All" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status === "all"
                          ? "All Status"
                          : status.charAt(0).toUpperCase() + status.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile View */}
        <div className="md:hidden">
          {tableFiltered
            .getRowModel()
            .rows.map((row) => renderMobileCard(row.original))}
        </div>

        {/* Desktop View */}
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
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
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
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between py-4">
          <span className="text-sm text-muted-foreground">
            {table.getFilteredRowModel().rows.length} users
          </span>
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

        <EditUserDialog
          open={dialogOpen}
          onOpenChange={handleDialogChange}
          user={selectedUser}
          onSuccess={handleSuccess}
        />
      </div>
    </TooltipProvider>
  );
}
