"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
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
import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Phone,
  MessageSquare,
  MessageCircle,
  Star,
  Download,
  FileText,
} from "lucide-react";
import React from "react";
import { cn } from "@/lib/utils";
import { PdfCompare } from "./PdfCompare";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
}

export function DataTable<TData, TValue>({
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [isPdfCompareOpen, setIsPdfCompareOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<any>(null);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
      pagination: {
        pageSize: 10,
        pageIndex: 0,
      },
    },
    onSortingChange: setSorting,
  });

  const toggleRow = (rowId: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [rowId]: !prev[rowId],
    }));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                <TableHead className="w-[50px]"></TableHead>
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
                <React.Fragment key={row.id}>
                  <TableRow className="cursor-pointer hover:bg-muted/50">
                    <TableCell
                      className="w-[50px]"
                      onClick={() => toggleRow(row.id)}
                    >
                      <Button variant="ghost" size="sm" className="p-0 h-auto">
                        {expandedRows[row.id] ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                  {expandedRows[row.id] && (
                    <TableRow>
                      <TableCell colSpan={columns.length + 1}>
                        <div className="p-3 space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h4 className="font-semibold mb-2 text-sm">
                                Driver Details
                              </h4>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="text-base font-medium">
                                    {(row.original as any).driver}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                    >
                                      <Phone className="h-3.5 w-3.5 text-green-600" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                    >
                                      <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                    >
                                      <MessageCircle className="h-3.5 w-3.5 text-purple-600" />
                                    </Button>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <Star
                                      key={star}
                                      className={cn(
                                        "h-3.5 w-3.5",
                                        star <= 4
                                          ? "text-yellow-400 fill-yellow-400"
                                          : "text-gray-300"
                                      )}
                                    />
                                  ))}
                                  <span className="text-xs text-muted-foreground ml-1">
                                    (4.0 rating)
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div>
                              <h4 className="font-semibold mb-2 text-sm">
                                Company Details
                              </h4>
                              <div className="space-y-2">
                                <div className="text-base font-medium">
                                  {(row.original as any).company}
                                </div>
                                <div className="bg-muted rounded-lg p-2 text-xs">
                                  <h5 className="font-medium mb-1">
                                    Performance Notes:
                                  </h5>
                                  <p className="text-muted-foreground">
                                    Good track record with timely deliveries.
                                    Maintains high quality standards.
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Notes and Documents Grid */}
                          <div className="space-y-4">
                            {/* Notes and Documents Grid */}
                            <div className="grid grid-cols-3 gap-4">
                              {/* Notes Section - Spans 2 columns */}
                              <div className="col-span-2">
                                <h4 className="font-semibold mb-2 text-sm">
                                  Notes
                                </h4>
                                <div className="grid grid-cols-3 gap-3">
                                  <div className="bg-background p-3 rounded-lg border">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs">
                                        D
                                      </div>
                                      <p className="font-medium text-sm">
                                        Dispatch Note
                                      </p>
                                    </div>
                                    <div className="pl-8">
                                      <p className="text-xs text-muted-foreground">
                                        {(row.original as any).dispatchNote ||
                                          "No dispatch note"}
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        By {(row.original as any).dispatcher}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="bg-background p-3 rounded-lg border">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="h-6 w-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs">
                                        E
                                      </div>
                                      <p className="font-medium text-sm">
                                        Editor Note
                                      </p>
                                    </div>
                                    <div className="pl-8">
                                      <p className="text-xs text-muted-foreground">
                                        {(row.original as any).editorNote ||
                                          "No editor note"}
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        By {(row.original as any).editor}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="bg-background p-3 rounded-lg border">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="h-6 w-6 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs">
                                        M
                                      </div>
                                      <p className="font-medium text-sm">
                                        Manager Note
                                      </p>
                                    </div>
                                    <div className="pl-8">
                                      <p className="text-xs text-muted-foreground">
                                        {(row.original as any).managerNote ||
                                          "No manager note"}
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        By Manager
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Documents Section - Spans 1 column */}
                              <div>
                                <h4 className="font-semibold mb-2 text-sm">
                                  Documents
                                </h4>
                                <div className="space-y-3">
                                  {/* Before Edit PDF */}
                                  <div className="bg-background p-3 rounded-lg border">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-blue-600" />
                                        <div>
                                          <p className="text-sm font-medium">
                                            Before Edit
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            document_v1.pdf
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex gap-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-7 w-7 p-0"
                                        >
                                          <Download className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-7"
                                          onClick={() => {
                                            setSelectedRow(row.original);
                                            setIsPdfCompareOpen(true);
                                          }}
                                        >
                                          Compare
                                        </Button>
                                      </div>
                                    </div>
                                  </div>

                                  {/* After Edit PDF */}
                                  <div className="bg-background p-3 rounded-lg border">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-green-600" />
                                        <div>
                                          <p className="text-sm font-medium">
                                            After Edit
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            document_v2.pdf
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex gap-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-7 w-7 p-0"
                                        >
                                          <Download className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-7"
                                          onClick={() => {
                                            setSelectedRow(row.original);
                                            setIsPdfCompareOpen(true);
                                          }}
                                        >
                                          Compare
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Horizontal Timeline */}
                            <div className="border-t pt-4">
                              <h4 className="font-semibold mb-3 text-sm">
                                Timeline
                              </h4>
                              <div className="relative">
                                {/* Timeline line */}
                                <div className="absolute top-[15px] left-0 right-0 h-0.5 bg-muted" />

                                {/* Timeline items */}
                                <div className="relative grid grid-cols-5 gap-4">
                                  {/* Created */}
                                  <div className="flex flex-col items-center">
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 relative z-10" />
                                    <p className="text-xs font-medium mt-2">
                                      Created
                                    </p>
                                    <time className="text-[10px] text-muted-foreground">
                                      {new Date(
                                        (row.original as any).timestamp
                                      ).toLocaleString()}
                                    </time>
                                  </div>

                                  {/* In Progress (previously Joined) */}
                                  <div className="flex flex-col items-center">
                                    <div className="w-2.5 h-2.5 rounded-full bg-orange-500 relative z-10" />
                                    <p className="text-xs font-medium mt-2">
                                      In Progress
                                    </p>
                                    <time className="text-[10px] text-muted-foreground">
                                      {new Date(
                                        (row.original as any).joinedAt ||
                                          (row.original as any).timestamp
                                      ).toLocaleString()}
                                    </time>
                                  </div>

                                  {/* Closed */}
                                  <div className="flex flex-col items-center">
                                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 relative z-10" />
                                    <p className="text-xs font-medium mt-2">
                                      Closed
                                    </p>
                                    <time className="text-[10px] text-muted-foreground">
                                      {(row.original as any).closedAt
                                        ? new Date(
                                            (row.original as any).closedAt
                                          ).toLocaleString()
                                        : "Pending"}
                                    </time>
                                  </div>

                                  {/* Notified */}
                                  <div className="flex flex-col items-center">
                                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 relative z-10" />
                                    <p className="text-xs font-medium mt-2">
                                      Notified
                                    </p>
                                    <time className="text-[10px] text-muted-foreground">
                                      {(row.original as any).notifiedAt
                                        ? new Date(
                                            (row.original as any).notifiedAt
                                          ).toLocaleString()
                                        : "Pending"}
                                    </time>
                                  </div>

                                  {/* Confirmed */}
                                  <div className="flex flex-col items-center">
                                    <div className="w-2.5 h-2.5 rounded-full bg-gray-500 relative z-10" />
                                    <p className="text-xs font-medium mt-2">
                                      Confirmed
                                    </p>
                                    <time className="text-[10px] text-muted-foreground">
                                      {(row.original as any).confirmedAt
                                        ? new Date(
                                            (row.original as any).confirmedAt
                                          ).toLocaleString()
                                        : "Pending"}
                                    </time>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
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

      <div className="flex items-center justify-end space-x-2">
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

      {selectedRow && (
        <PdfCompare
          isOpen={isPdfCompareOpen}
          onClose={() => {
            setIsPdfCompareOpen(false);
            setSelectedRow(null);
          }}
          beforePdf={selectedRow.beforePdf}
          afterPdf={selectedRow.afterPdf}
        />
      )}
    </div>
  );
}
