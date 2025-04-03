"use client";

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
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
  VisibilityState,
  TableOptions,
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
  Settings2,
  SlidersHorizontal,
  CheckCircle,
  XCircle,
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
  DropdownMenuCheckboxItem,
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
  TooltipProvider,
} from "@/components/ui/tooltip";
import { getBirthdayStatus } from "../../config/columns";
import { User } from "../../lib/types/types";
import { UserDialog } from "../dialogs/user-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

const variantMap = {
  active: "default",
  pending: "outline",
  inactive: "destructive",
} as const;

interface DataTableProps {
  columns: ColumnDef<User, any>[];
  data: User[];
  loadingRows?: Record<number, boolean>;
  meta?: any;
  error?: string;
  onActivateSelected?: (ids: string[]) => Promise<void>;
  onDeactivateSelected?: (ids: string[]) => Promise<void>;
}

// Add this helper function at the top level
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString();
};

export function DataTable({
  columns,
  data,
  loadingRows = {},
  meta,
  error,
  onActivateSelected,
  onDeactivateSelected,
}: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | undefined>();
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
    setSelectedUser(user);
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
      meta.onEdit(selectedUser);

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
                alt={`${user.first_name || ""} ${user.last_name || ""}`}
              />
              <AvatarFallback>
                {user.first_name?.[0]}
                {user.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">
                {user.first_name || ""} {user.last_name || ""}
              </div>
              <div className="text-sm text-muted-foreground">
                {user.email || ""}
              </div>
              <div className="flex items-center space-x-2 mt-1">
                <Badge
                  variant={user.status === "active" ? "default" : "secondary"}
                >
                  {user.status === "active" ? "Active" : "Inactive"}
                </Badge>
                <Badge variant="outline">{user.role || ""}</Badge>
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
                <div className="text-sm">{user.role || ""}</div>
              </div>
              <div>
                <div className="text-sm font-medium">Status</div>
                <div className="text-sm">{user.status || ""}</div>
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
                    {shiftNames[user.working_shift] || user.working_shift || ""}
                  </div>
                </div>
              )}
              {user.off_days && (
                <div>
                  <div className="text-sm font-medium">Off Days</div>
                  <div className="text-sm">
                    {formatOffDays(user.off_days) || ""}
                  </div>
                </div>
              )}
              {user.phone_number && (
                <div>
                  <div className="text-sm font-medium">Phone</div>
                  <div className="text-sm">{user.phone_number || ""}</div>
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
    return Array(5)
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
    return userId === "highlightedUserId";
  };

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const hasSelectedRows = selectedRows.length > 0;
  const allSelectedActive =
    hasSelectedRows &&
    selectedRows.every((row) => row.original.status === "active");
  const allSelectedInactive =
    hasSelectedRows &&
    selectedRows.every((row) => row.original.status === "inactive");

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
            placeholder="Filter users..."
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
                    typeof column.accessorFn !== "undefined" ||
                    column.id === "name" ||
                    column.id === "companies"
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
                      {column.id === "name"
                        ? "Name"
                        : column.id.charAt(0).toUpperCase() +
                          column.id.slice(1).replace(/_/g, " ")}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-2">
          {hasSelectedRows && (
            <>
              {!allSelectedActive && onActivateSelected && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const ids = selectedRows.map((row) => row.original.id);
                    onActivateSelected(ids);
                  }}
                  disabled={isProcessing}
                  className="text-green-600 border-green-600 hover:bg-green-50 dark:text-green-400 dark:border-green-400 dark:hover:bg-green-900/20"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Activate Selected
                </Button>
              )}
              {!allSelectedInactive && onDeactivateSelected && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const ids = selectedRows.map((row) => row.original.id);
                    onDeactivateSelected(ids);
                  }}
                  disabled={isProcessing}
                  className="text-rose-600 border-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:border-rose-400 dark:hover:bg-rose-900/20"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Deactivate Selected
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
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
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {loadingRows[row.index] ? (
                        <Skeleton className="h-6 w-20" />
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
      <div className="flex items-center justify-end space-x-2">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
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
