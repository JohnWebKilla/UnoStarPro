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
  X,
  Search,
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
import { UserDialog } from "./user-dialog";
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
  lastUpdatedUserId?: string | null;
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
  lastUpdatedUserId = null,
  meta,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<TData | undefined>();
  const [globalFilter, setGlobalFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Create filtered data based on role and status
  const filteredData = useMemo(() => {
    return data.filter((item: User) => {
      const matchesRole = roleFilter === "all" || item.role === roleFilter;
      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;

      // Apply global filter to search across multiple fields
      const searchTerm = globalFilter.toLowerCase().trim();

      // Skip search if no search term
      if (!searchTerm) return matchesRole && matchesStatus;

      // Helper function to safely check if a field includes the search term
      const includes = (field: string | null | undefined) =>
        field?.toLowerCase().includes(searchTerm) || false;

      // Check all relevant fields
      const matchesSearch =
        includes(item.first_name) ||
        includes(item.last_name) ||
        includes(item.email) ||
        includes(item.role) ||
        includes(item.status) ||
        includes(item.phone_number) ||
        // Also search for full name
        `${item.first_name || ""} ${item.last_name || ""}`
          .toLowerCase()
          .includes(searchTerm);

      return matchesRole && matchesStatus && matchesSearch;
    });
  }, [data, roleFilter, statusFilter, globalFilter]);

  // Use the filtered data for the table
  const table = useReactTable({
    data: filteredData,
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
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
    meta,
  });

  // Add cleanup effect
  useEffect(() => {
    return () => {
      // Cleanup on unmount
      setSelectedUser(undefined);
      setDialogOpen(false);
      setExpandedRows([]);
      setOpenMenuId(null);
    };
  }, []);

  // Simplify the handlers to be synchronous
  const handleDialogChange = useCallback(
    (open: boolean) => {
      if (!open) {
        // Only close the dialog if it's currently open
        if (dialogOpen) {
          setDialogOpen(false);
          // Clear selection after dialog is fully closed
          setTimeout(() => {
            setSelectedUser(undefined);
          }, 300);
        }
      } else {
        setDialogOpen(true);
      }
    },
    [dialogOpen]
  );

  const handleEdit = useCallback((user: User) => {
    // Set the selected user first, then open the dialog
    setSelectedUser(user as TData);
    setTimeout(() => {
      setDialogOpen(true);
    }, 0);
  }, []);

  const handleSuccess = useCallback(async () => {
    if (!selectedUser) return;

    try {
      console.log("DataTable handling edit success for user:", selectedUser.id);

      // Close dialog immediately
      setDialogOpen(false);

      // Pass the selected user directly to the parent component's onEdit function
      meta.onEdit?.(selectedUser);

      // Clear user after dialog is closed
      setTimeout(() => {
        setSelectedUser(undefined);
      }, 300);
    } catch (error) {
      console.error("Error handling edit:", error);
    }
  }, [meta.onEdit, selectedUser]);

  const toggleRow = (rowId: string) => {
    setExpandedRows((prev) =>
      prev.includes(rowId)
        ? prev.filter((id) => id !== rowId)
        : [...prev, rowId]
    );
  };

  const renderMobileCard = (user: User) => {
    const isExpanded = expandedRows.includes(user.id);
    const birthdayStatus = user.dob ? getBirthdayStatus(user.dob) : null;

    const handleAction = (action: () => void) => {
      action();
      setExpandedRows((prev) => prev.filter((id) => id !== user.id));
    };

    // Map of shift names
    const shiftNames: Record<string, string> = {
      "1": "Shift 1 (08:00 - 16:00)",
      "2": "Shift 2 (16:00 - 00:00)",
      "3": "Shift 3 (00:00 - 08:00)",
    };

    // Map of department icons
    const departmentIcons: Record<string, string> = {
      Editor: "✏️",
      Manager: "👔",
      Dispatcher: "📡",
      Safety: "🛡️",
    };

    // Format off days
    const formatOffDays = (offDays: string[] | undefined) => {
      if (!offDays || !Array.isArray(offDays) || offDays.length === 0) {
        return "-";
      }
      return offDays
        .map((day) => day.charAt(0).toUpperCase() + day.slice(1))
        .join(", ");
    };

    return (
      <div
        key={user.id}
        className={`p-4 border-b last:border-b-0 ${isHighlighted(user.id) ? "bg-blue-50 dark:bg-blue-900/20 transition-colors duration-500" : ""}`}
      >
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
              <div className="font-medium">
                {user.first_name} {user.last_name}
              </div>
              <div className="text-sm text-muted-foreground">{user.email}</div>
              <div className="flex items-center space-x-2 mt-1">
                <Badge
                  variant={user.status === "active" ? "default" : "secondary"}
                >
                  {user.status === "active" ? "Active" : "Inactive"}
                </Badge>
                <Badge variant="outline">{user.role}</Badge>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleRow(user.id)}
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </Button>
        </div>

        {isExpanded && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-sm font-medium">Role</div>
                <div className="text-sm">{user.role}</div>
              </div>
              <div>
                <div className="text-sm font-medium">Status</div>
                <div className="text-sm">{user.status}</div>
              </div>
              {user.department && (
                <div>
                  <div className="text-sm font-medium">Department</div>
                  <div className="text-sm flex items-center">
                    {departmentIcons[user.department] && (
                      <span className="mr-1">
                        {departmentIcons[user.department]}
                      </span>
                    )}
                    {user.department}
                  </div>
                </div>
              )}
              {user.working_shift && (
                <div>
                  <div className="text-sm font-medium">Working Shift</div>
                  <div className="text-sm">
                    {shiftNames[user.working_shift] || user.working_shift}
                  </div>
                </div>
              )}
              {user.off_days && (
                <div>
                  <div className="text-sm font-medium">Off Days</div>
                  <div className="text-sm">{formatOffDays(user.off_days)}</div>
                </div>
              )}
              {user.phone_number && (
                <div>
                  <div className="text-sm font-medium">Phone</div>
                  <div className="text-sm">{user.phone_number}</div>
                </div>
              )}
              {user.dob && (
                <div>
                  <div className="text-sm font-medium">Birthday</div>
                  <div className="text-sm flex items-center">
                    {formatDate(user.dob)}
                    {birthdayStatus === "today" && (
                      <Cake className="ml-1 h-4 w-4 text-yellow-500" />
                    )}
                    {birthdayStatus === "upcoming" && (
                      <Bell className="ml-1 h-4 w-4 text-blue-500" />
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleEdit(user)}
              >
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAction(() => meta.onManageCompanies(user))}
              >
                <Building className="h-4 w-4 mr-1" />
                Companies
              </Button>
              <Button
                size="sm"
                variant={user.status === "active" ? "destructive" : "default"}
                onClick={() => handleAction(() => meta.onToggleStatus(user))}
              >
                <Power className="h-4 w-4 mr-1" />
                {user.status === "active" ? "Deactivate" : "Activate"}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Filter options
  const roleOptions = ["all", "admin", "manager", "user", "driver", "customer"];
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

  // Add this function to determine if a row should be highlighted
  const isHighlighted = (userId: string) => {
    return lastUpdatedUserId === userId;
  };

  return (
    <div>
      {/* Filters Section */}
      <div className="flex flex-col space-y-4 py-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              className="pl-8 pr-8 max-w-sm"
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
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="driver">Driver</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
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
                  className={
                    isHighlighted(row.original.id)
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
            : `Showing ${filteredData.length} of ${data.length} users`}
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

      {/* Edit User Dialog - Replace with UserDialog */}
      {selectedUser && (
        <UserDialog
          key={`edit-${selectedUser.id}`}
          open={dialogOpen}
          onOpenChange={handleDialogChange}
          user={selectedUser}
          onSuccess={handleSuccess}
          companies={meta.companies}
        />
      )}
    </div>
  );
}
