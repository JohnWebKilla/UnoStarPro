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
import { Skeleton } from "@/components/ui/skeleton";

const variantMap = {
  active: "default",
  pending: "outline",
  inactive: "destructive",
} as const;

interface DataTableProps<TData extends User, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  skeletonRowCount?: number;
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
  isLoading = false,
  skeletonRowCount = 5,
  meta,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<TData | undefined>();
  const [globalFilter, setGlobalFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  // Add this state to track open menus at the component level
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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

    const handleAction = (action: () => void) => {
      // Close menu first
      setOpenMenuId(null);
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
            <DropdownMenu
              open={openMenuId === user.id}
              onOpenChange={(open) => setOpenMenuId(open ? user.id : null)}
            >
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
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    handleAction(() => meta.onManageCompanies(user))
                  }
                >
                  <Building className="mr-2 h-4 w-4" />
                  Companies
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleAction(() => meta.onToggleStatus(user))}
                >
                  <Power className="mr-2 h-4 w-4" />
                  {user.status === "active" ? "Deactivate" : "Activate"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="sm"
              className="ml-2"
              onClick={() => toggleRow(user.id)}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium mb-2">
                  Contact Information
                </h4>
                <div className="space-y-2">
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Email:
                    </span>
                    <p className="text-sm">{user.email}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Phone:
                    </span>
                    <p className="text-sm">
                      {user.phone_number || "Not provided"}
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Account Details</h4>
                <div className="space-y-2">
                  <div>
                    <span className="text-xs text-muted-foreground">Role:</span>
                    <p className="text-sm capitalize">{user.role}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Status:
                    </span>
                    <p className="text-sm capitalize">{user.status}</p>
                  </div>
                  {user.dob && (
                    <div>
                      <span className="text-xs text-muted-foreground">
                        Birthday:
                      </span>
                      <p className="text-sm flex items-center">
                        {formatDate(user.dob)}
                        {birthdayStatus && (
                          <span className="ml-2">
                            {birthdayStatus === "today" ? (
                              <Cake className="h-4 w-4 text-pink-500" />
                            ) : birthdayStatus === "upcoming" ? (
                              <Bell className="h-4 w-4 text-blue-500" />
                            ) : null}
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {user.companies && user.companies.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">
                  Associated Companies
                </h4>
                <div className="flex flex-wrap gap-2">
                  {user.companies.map((company) => (
                    <Badge key={company.id} variant="outline">
                      {company.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex justify-end space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => meta.onEdit(user)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button
                size="sm"
                variant={user.status === "active" ? "destructive" : "default"}
                onClick={() => meta.onToggleStatus(user)}
              >
                <Power className="mr-2 h-4 w-4" />
                {user.status === "active" ? "Deactivate" : "Activate"}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Filter options
  const roleOptions = ["all", "admin", "driver", "customer"];
  const statusOptions = ["all", "active", "pending", "inactive"];

  const handleRoleChange = (value: string) => {
    setRoleFilter(value);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
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

  return (
    <div>
      {/* Filters Section */}
      <div className="flex flex-col space-y-4 py-4">
        <div className="flex flex-col md:flex-row gap-4">
          <Input
            placeholder="Search users..."
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="max-w-sm"
            disabled={isLoading}
          />
          <div className="flex gap-2">
            <Select
              value={roleFilter}
              onValueChange={handleRoleChange}
              disabled={isLoading}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="employee">Employee</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={handleStatusChange}
              disabled={isLoading}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
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
            {isLoading ? (
              renderSkeletonRows()
            ) : table.getRowModel().rows?.length ? (
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

      {/* Mobile View */}
      <div className="md:hidden space-y-4">
        {isLoading ? (
          // Mobile skeleton loading
          [...Array(skeletonRowCount)].map((_, i) => (
            <div key={i} className="bg-card rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div>
                    <Skeleton className="h-4 w-[150px] mb-2" />
                    <Skeleton className="h-3 w-[100px]" />
                  </div>
                </div>
                <Skeleton className="h-4 w-4" />
              </div>
            </div>
          ))
        ) : filteredData.length > 0 ? (
          filteredData.map((user) => renderMobileCard(user as User))
        ) : (
          <div className="text-center p-4">No results found.</div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between py-4">
        <span className="text-sm text-muted-foreground">
          {isLoading
            ? "Loading..."
            : `${table.getFilteredRowModel().rows.length} users`}
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

      {/* Edit User Dialog */}
      {selectedUser && (
        <EditUserDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          user={selectedUser}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
