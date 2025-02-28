"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { updateTransactionAction } from "../actions/payroll";

type TransactionType = "payment" | "advance" | "penalty" | "bonus";
type PaymentStatus = "pending" | "paid" | "unpaid" | "charged" | "deducted";

interface Transaction {
  id: number;
  user_id: string;
  amount: number;
  transaction_date: string;
  status: PaymentStatus;
  transaction_type: TransactionType;
  description?: string;
  created_by: string;
  created_at: string;
  updated_by?: string;
  updated_at?: string;
  user: {
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  created_by_user?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  updated_by_user?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface PaymentSummary {
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  userName: string;
  deductions: number;
  baseAmount: number;
  bonusAmount: number;
  advanceAmount: number;
  penaltyAmount: number;
}

interface SummaryCardProps {
  label: string;
  value: string;
  description?: string;
  valueColor?: string;
}

interface TransactionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransactionUpdated?: () => void;
  userId?: string;
}

function SummaryCard({
  label,
  value,
  description,
  valueColor,
}: SummaryCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold mt-1 ${valueColor || ""}`}>
        {value}
      </div>
      {description && (
        <div className="text-sm text-muted-foreground mt-1">{description}</div>
      )}
    </div>
  );
}

export function TransactionsDialog({
  open,
  onOpenChange,
  onTransactionUpdated,
  userId,
}: TransactionsDialogProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const supabase = createClient();
  const { toast } = useToast();

  useEffect(() => {
    // Reset states when dialog opens/closes
    if (!open) {
      setTransactions([]);
      setSummary(null);
      setIsLoading(false);
      setUpdatingId(null);
    } else {
      setIsLoading(true);
      fetchTransactions();
    }
  }, [open]);

  const calculateSummary = (transactions: Transaction[]) => {
    if (!transactions.length) return null;

    const user = transactions[0].user;
    const userName = user
      ? `${user.first_name} ${user.last_name}`
      : "Unknown User";

    const summary = {
      baseAmount: 0,
      bonusAmount: 0,
      advanceAmount: 0,
      penaltyAmount: 0,
      totalAmount: 0,
      paidAmount: 0,
      pendingAmount: 0,
      deductions: 0,
      userName,
    };

    // Calculate amounts by type
    transactions.forEach((t) => {
      const amount = t.amount;

      switch (t.transaction_type) {
        case "payment":
          summary.baseAmount += amount;
          if (t.status === "paid") {
            summary.paidAmount += amount;
          } else if (t.status === "pending") {
            summary.pendingAmount += amount;
          }
          break;

        case "bonus":
          summary.bonusAmount += amount;
          if (t.status === "paid") {
            summary.paidAmount += amount;
          } else if (t.status === "pending") {
            summary.pendingAmount += amount;
          }
          break;

        case "advance":
          if (t.status === "paid") {
            summary.advanceAmount += amount;
            summary.deductions += amount;
            summary.paidAmount -= amount;
          } else if (t.status === "pending") {
            summary.pendingAmount += amount;
          }
          break;

        case "penalty":
          if (t.status === "charged") {
            summary.penaltyAmount += amount;
            summary.deductions += amount;
            // Subtract penalty from paid amount if it's charged
            summary.paidAmount -= amount;
          } else if (t.status === "pending") {
            summary.pendingAmount += amount;
          }
          break;
      }
    });

    // Calculate final total: base + bonus - (advances + charged penalties)
    summary.totalAmount =
      summary.baseAmount +
      summary.bonusAmount -
      summary.advanceAmount -
      summary.penaltyAmount;

    // Ensure paid amount doesn't exceed total amount
    summary.paidAmount = Math.min(
      Math.max(0, summary.paidAmount),
      summary.totalAmount
    );
    summary.pendingAmount = Math.max(0, summary.pendingAmount);

    return summary;
  };

  const fetchTransactions = async () => {
    try {
      setIsLoading(true);

      // First get the transactions
      let query = supabase
        .from("payroll_transactions")
        .select(
          `
          *,
          user:users!payroll_transactions_user_id_fkey(
            id,
            first_name,
            last_name,
            email
          ),
          created_by_user:users!payroll_transactions_created_by_fkey(
            id,
            first_name,
            last_name,
            email
          ),
          updated_by_user:users!payroll_transactions_updated_by_fkey(
            id,
            first_name,
            last_name,
            email
          )
        `
        )
        .order("transaction_date", { ascending: false });

      if (userId) {
        query = query.eq("user_id", userId);
      }

      const { data: transactionData, error: transactionError } = await query;

      if (transactionError) {
        console.error("Transaction fetch error:", {
          error: transactionError,
          message: transactionError.message,
          details: transactionError.details,
          hint: transactionError.hint,
          code: transactionError.code,
          userId,
        });
        throw transactionError;
      }

      const formattedData = (transactionData || []).map((transaction) => ({
        ...transaction,
        user: transaction.user || {
          first_name: "Unknown",
          last_name: "User",
          email: transaction.user_id,
        },
        created_by_user: transaction.created_by_user || {
          first_name: "Unknown",
          last_name: "Admin",
          email: transaction.created_by,
        },
        updated_by_user: transaction.updated_by_user,
      }));

      setTransactions(formattedData);
      const calculatedSummary = calculateSummary(formattedData);
      setSummary(calculatedSummary);
    } catch (error) {
      console.error("Fetch error:", {
        error,
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        userId,
        timestamp: new Date().toISOString(),
      });

      toast({
        title: "Error",
        description: "Failed to load transactions",
        variant: "destructive",
      });

      setTransactions([]);
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  };

  const logError = (
    action: string,
    error: any,
    transaction: Transaction,
    details?: Record<string, any>
  ) => {
    console.error(`Transaction Action Error: ${action}`, {
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      transactionId: transaction.id,
      transactionType: transaction.transaction_type,
      userId: transaction.user_id,
      amount: transaction.amount,
      status: transaction.status,
      timestamp: new Date().toISOString(),
      ...details,
    });
  };

  const handleStatusUpdate = async (
    transaction: Transaction,
    newStatus: PaymentStatus
  ) => {
    try {
      setUpdatingId(transaction.id);

      // Create an optimistic version of the updated transaction
      const optimisticTransaction: Transaction = {
        ...transaction,
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      // Optimistically update the UI
      setTransactions((prevTransactions) =>
        prevTransactions.map((t) =>
          t.id === transaction.id ? optimisticTransaction : t
        )
      );

      // Calculate new summary based on optimistic data
      const updatedTransactions = transactions.map((t) =>
        t.id === transaction.id ? optimisticTransaction : t
      );
      setSummary(calculateSummary(updatedTransactions));

      // Call the server action to update the transaction
      const result = await updateTransactionAction(transaction.id, {
        status: newStatus,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to update transaction");
      }

      // Update with the actual server response
      if (result.data) {
        const serverTransaction = result.data as unknown as Transaction;
        setTransactions((prevTransactions) =>
          prevTransactions.map((t) =>
            t.id === transaction.id ? serverTransaction : t
          )
        );
      }

      // Notify parent component
      onTransactionUpdated?.();

      toast({
        title: "Success",
        description: `Transaction marked as ${newStatus}`,
      });
    } catch (error) {
      // Revert optimistic update on error
      await fetchTransactions();

      logError("status_update", error, transaction, {
        newStatus,
        finalError: true,
      });

      let errorMessage = "Failed to update transaction status";
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const getActionButton = (transaction: Transaction) => {
    if (updatingId === transaction.id) {
      return (
        <Button variant="outline" size="sm" disabled>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Updating...
        </Button>
      );
    }

    if (transaction.transaction_type === "penalty") {
      if (transaction.status === "pending") {
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleStatusUpdate(transaction, "charged")}
          >
            Mark as Charged
          </Button>
        );
      }
      if (transaction.status === "charged") {
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleStatusUpdate(transaction, "pending")}
          >
            Mark as Not Charged
          </Button>
        );
      }
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <MoreHorizontal className="h-4 w-4 mr-2" />
            Actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {transaction.status !== "paid" && (
            <DropdownMenuItem
              onClick={() => handleStatusUpdate(transaction, "paid")}
            >
              Mark as Paid
            </DropdownMenuItem>
          )}
          {transaction.status !== "pending" && (
            <DropdownMenuItem
              onClick={() => handleStatusUpdate(transaction, "pending")}
            >
              Mark as Pending
            </DropdownMenuItem>
          )}
          {transaction.status !== "unpaid" && (
            <DropdownMenuItem
              onClick={() => handleStatusUpdate(transaction, "unpaid")}
            >
              Mark as Unpaid
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const getStatusBadgeClass = (
    status: PaymentStatus,
    type: TransactionType
  ) => {
    if (type === "penalty") {
      switch (status) {
        case "charged":
          return "bg-purple-100 text-purple-800";
        case "pending":
          return "bg-yellow-100 text-yellow-800";
        default:
          return "bg-red-100 text-red-800";
      }
    }

    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-red-100 text-red-800";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex justify-between items-center">
            <span>Payroll Transactions</span>
          </DialogTitle>
        </DialogHeader>

        {summary && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <SummaryCard
              label="Employee"
              value={summary.userName}
              description={`Base: $${summary.baseAmount.toFixed(2)}`}
            />
            <SummaryCard
              label="Total Due"
              value={`$${summary.totalAmount.toFixed(2)}`}
              description={`Base + Bonus - Deductions`}
            />
            <SummaryCard
              label="Already Paid"
              value={`$${summary.paidAmount.toFixed(2)}`}
              valueColor="text-green-600"
              description={
                summary.bonusAmount > 0
                  ? `Includes $${summary.bonusAmount.toFixed(2)} bonus`
                  : undefined
              }
            />
            <SummaryCard
              label="Pending"
              value={`$${summary.pendingAmount.toFixed(2)}`}
              description={
                summary.deductions > 0
                  ? `Deductions: $${summary.deductions.toFixed(2)}`
                  : undefined
              }
              valueColor="text-yellow-600"
            />
          </div>
        )}

        <div className="relative overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Created By</TableHead>
                  <TableHead className="w-[100px]">Type</TableHead>
                  <TableHead className="w-[120px]">Amount</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[200px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {transaction.created_by_user?.first_name}{" "}
                          {transaction.created_by_user?.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(
                            new Date(transaction.created_at),
                            "MMM d, yyyy h:mm a"
                          )}
                        </div>
                        {transaction.updated_by && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Last updated by{" "}
                            {transaction.updated_by_user?.first_name}{" "}
                            {transaction.updated_by_user?.last_name} on{" "}
                            {format(
                              new Date(transaction.updated_at!),
                              "MMM d, yyyy h:mm a"
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          transaction.transaction_type === "payment"
                            ? "bg-blue-100 text-blue-800"
                            : transaction.transaction_type === "advance"
                              ? "bg-yellow-100 text-yellow-800"
                              : transaction.transaction_type === "penalty"
                                ? "bg-red-100 text-red-800"
                                : "bg-green-100 text-green-800"
                        }`}
                      >
                        {transaction.transaction_type.charAt(0).toUpperCase() +
                          transaction.transaction_type.slice(1)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div
                        className={`font-medium ${
                          transaction.transaction_type === "penalty"
                            ? "text-red-600"
                            : transaction.transaction_type === "advance"
                              ? "text-yellow-600"
                              : transaction.transaction_type === "bonus"
                                ? "text-green-600"
                                : ""
                        }`}
                      >
                        ${transaction.amount.toFixed(2)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(
                          transaction.status,
                          transaction.transaction_type
                        )}`}
                      >
                        {transaction.status.charAt(0).toUpperCase() +
                          transaction.status.slice(1)}
                      </span>
                    </TableCell>
                    <TableCell>{getActionButton(transaction)}</TableCell>
                  </TableRow>
                ))}
                {!isLoading && transactions.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No transactions found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {isLoading && (
            <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
