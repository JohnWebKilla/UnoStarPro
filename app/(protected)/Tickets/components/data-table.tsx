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
  TableFooter,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useState, useCallback } from "react";
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
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from "date-fns";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  type?: "tickets" | "issues";
}

export function DataTable<TData, TValue>({
  columns,
  data,
  type = "tickets",
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

  const handleRowDoubleClick = useCallback((rowId: string) => {
    setExpandedRows((prev) => {
      const newState = Object.keys(prev).reduce(
        (acc, key) => {
          acc[key] = false;
          return acc;
        },
        {} as Record<string, boolean>
      );
      newState[rowId] = !prev[rowId];
      return newState;
    });
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] border rounded-lg">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-background border-b">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-background">
                <TableHead className="w-[50px]"></TableHead>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="bg-background h-10">
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
        </Table>
      </div>

      {/* Scrollable Body - Add min-height to ensure it takes available space */}
      <div className="flex-1 min-h-0 overflow-auto">
        <Table>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <React.Fragment key={row.id}>
                  <TableRow
                    className="cursor-pointer hover:bg-muted/50"
                    onDoubleClick={() => handleRowDoubleClick(row.id)}
                  >
                    <TableCell
                      className="w-[50px]"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRow(row.id);
                      }}
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
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={columns.length + 1}>
                        {type === "issues" ? (
                          <div className="py-2 px-3 space-y-3">
                            <div className="grid grid-cols-2 gap-3 bg-background p-3 rounded-lg border shadow-sm">
                              <div>
                                <h4 className="font-semibold mb-2 text-sm">
                                  Issue Details
                                </h4>
                                <div className="space-y-2">
                                  <div className="bg-muted rounded-lg p-2">
                                    <h5 className="text-sm font-medium mb-1">
                                      Description:
                                    </h5>
                                    <p className="text-sm text-muted-foreground">
                                      {(row.original as any).description}
                                    </p>
                                  </div>
                                  <div className="bg-muted rounded-lg p-2">
                                    <h5 className="text-sm font-medium mb-1">
                                      System Type:
                                    </h5>
                                    <Badge
                                      variant="secondary"
                                      className="capitalize"
                                    >
                                      {(row.original as any).systemType}
                                    </Badge>
                                  </div>
                                </div>
                              </div>

                              <div>
                                <h4 className="font-semibold mb-2 text-sm">
                                  Reporter Details
                                </h4>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="text-sm">
                                      <p className="font-medium">
                                        {(row.original as any).driver}
                                      </p>
                                      <p className="text-muted-foreground">
                                        {(row.original as any).company}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 hover:bg-green-50 dark:hover:bg-green-900/20"
                                        title="Call Driver"
                                      >
                                        <Phone className="h-3.5 w-3.5 text-green-600 dark:text-green-500" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                        title="Send SMS"
                                      >
                                        <MessageSquare className="h-3.5 w-3.5 text-blue-600 dark:text-blue-500" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Add Solution Section for resolved issues */}
                            {(row.original as any).status === "resolved" && (
                              <div className="bg-background p-3 rounded-lg border shadow-sm">
                                <h4 className="font-semibold mb-2 text-sm">
                                  Solution
                                </h4>
                                <div className="space-y-2">
                                  <div className="bg-muted rounded-lg p-2">
                                    <p className="text-sm text-muted-foreground">
                                      {(row.original as any).solution}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Resolved{" "}
                                      {formatDistanceToNow(
                                        (row.original as any).resolvedAt,
                                        { addSuffix: true }
                                      )}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="bg-background p-3 rounded-lg border shadow-sm">
                              <h4 className="font-semibold mb-2 text-sm">
                                Attachments
                              </h4>
                              <div className="grid grid-cols-2 gap-3">
                                {(row.original as any).files.map(
                                  (file: any, index: number) => (
                                    <div
                                      key={index}
                                      className="bg-muted p-2 rounded-lg flex items-center justify-between"
                                    >
                                      <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-blue-600" />
                                        <div>
                                          <p className="text-sm font-medium">
                                            {file.name}
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            {file.type || "Document"}
                                          </p>
                                        </div>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={() =>
                                          window.open(file.url, "_blank")
                                        }
                                      >
                                        <Download className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  )
                                )}
                              </div>
                            </div>

                            <div className="bg-background p-3 rounded-lg border shadow-sm">
                              <h4 className="font-semibold mb-2 text-sm">
                                Status History
                              </h4>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-2 rounded-full bg-red-500" />
                                  <span className="text-sm">Reported</span>
                                  <span className="text-xs text-muted-foreground">
                                    {format(
                                      (row.original as any).timestamp,
                                      "PPpp"
                                    )}
                                  </span>
                                </div>
                                {(row.original as any).status !== "open" && (
                                  <div className="flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-yellow-500" />
                                    <span className="text-sm">In Progress</span>
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(), "PPpp")}
                                    </span>
                                  </div>
                                )}
                                {(row.original as any).status ===
                                  "resolved" && (
                                  <div className="flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-green-500" />
                                    <span className="text-sm">Resolved</span>
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(), "PPpp")}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="py-2 px-3 space-y-3">
                            <div className="grid grid-cols-2 gap-3 bg-background p-3 rounded-lg border shadow-sm">
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
                                        className="h-7 w-7 p-0 hover:bg-green-50 dark:hover:bg-green-900/20"
                                        title="Call Driver"
                                      >
                                        <Phone className="h-3.5 w-3.5 text-green-600 dark:text-green-500" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                        title="Send SMS"
                                      >
                                        <MessageSquare className="h-3.5 w-3.5 text-blue-600 dark:text-blue-500" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                                        title="Open Chat"
                                      >
                                        <MessageCircle className="h-3.5 w-3.5 text-purple-600 dark:text-purple-500" />
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
                            <div className="space-y-3">
                              <div className="grid grid-cols-3 gap-3">
                                {/* Notes Section */}
                                <div className="col-span-2 bg-background p-3 rounded-lg border shadow-sm">
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

                                {/* Documents Section */}
                                <div className="bg-background p-3 rounded-lg border shadow-sm">
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
                            </div>

                            {/* Horizontal Timeline */}
                            <div className="bg-background p-3 rounded-lg border shadow-sm">
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
                        )}
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

      {/* Fixed Footer with Pagination - Position it at the bottom */}
      <div className="mt-auto border-t bg-background">
        <div className="py-2 px-4">
          <div className="flex items-center justify-end space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from(
                { length: table.getPageCount() },
                (_, i) => i + 1
              ).map((pageNumber) => (
                <Button
                  key={pageNumber}
                  variant={
                    table.getState().pagination.pageIndex === pageNumber - 1
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  onClick={() => table.setPageIndex(pageNumber - 1)}
                >
                  {pageNumber}
                </Button>
              ))}
            </div>
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
