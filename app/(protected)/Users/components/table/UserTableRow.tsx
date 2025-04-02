import { Row } from "@tanstack/react-table";
import { TableCell, TableRow } from "@/components/ui/table";
import { User } from "../../types";
import { flexRender } from "@tanstack/react-table";

interface UserTableRowProps {
  row: Row<User>;
}

export function UserTableRow({ row }: UserTableRowProps) {
  return (
    <TableRow
      key={row.id}
      data-state={row.getIsSelected() && "selected"}
      className="group hover:bg-muted/50"
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
}
