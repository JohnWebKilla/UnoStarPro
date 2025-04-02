import { User } from "../../lib/types/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { columns } from "../../config/columns";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import { UserTableSkeleton } from "./UserTableSkeleton";
import { UserTableRow } from "./UserTableRow";

interface UsersTableProps {
  data: User[];
  isLoading?: boolean;
  onEdit: (user: User) => void;
  onToggleStatus: (user: User) => Promise<void>;
  onApprove: (user: User) => Promise<void>;
  onManageCompanies: (user: User) => void;
  companies: Array<{ id: number; name: string }>;
}

export function UsersTable({
  data,
  isLoading,
  onEdit,
  onToggleStatus,
  onApprove,
  onManageCompanies,
  companies,
}: UsersTableProps) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      onEdit,
      onToggleStatus,
      onApprove,
      onManageCompanies,
      companies,
    },
  });

  if (isLoading) {
    return <UserTableSkeleton />;
  }

  return (
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
          {table.getRowModel().rows?.length ? (
            table
              .getRowModel()
              .rows.map((row) => <UserTableRow key={row.id} row={row} />)
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No users found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
