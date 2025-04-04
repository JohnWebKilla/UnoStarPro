"use client";

import { useState, useEffect } from "react";
import { calculateMonthlyPayroll } from "../../actions/payroll";
import { PayrollSummary } from "../../types/payroll";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PayrollTabProps {
  userId: string;
}

export function PayrollTab({ userId }: PayrollTabProps) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [payrollData, setPayrollData] = useState<PayrollSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPayrollData();
  }, [selectedMonth, selectedYear]);

  const loadPayrollData = async () => {
    setLoading(true);
    const { summary, error } = await calculateMonthlyPayroll(
      userId,
      selectedMonth,
      selectedYear
    );
    if (summary) {
      setPayrollData(summary);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <Select
          value={selectedMonth.toString()}
          onValueChange={(value) => setSelectedMonth(parseInt(value))}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select month" />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => (
              <SelectItem key={i + 1} value={(i + 1).toString()}>
                {new Date(2000, i).toLocaleString("default", { month: "long" })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedYear.toString()}
          onValueChange={(value) => setSelectedYear(parseInt(value))}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select year" />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 5 }, (_, i) => {
              const year = new Date().getFullYear() - i;
              return (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {payrollData && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Base Salary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">${payrollData.base_salary}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p>
                  Tickets Closed:{" "}
                  {payrollData.performance_metrics.tickets_closed}
                </p>
                <p>
                  Shifts Completed:{" "}
                  {payrollData.performance_metrics.shifts_completed}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Adjustments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p>Advances: ${payrollData.advances}</p>
                <p>Penalties: ${payrollData.penalties}</p>
                <p>Bonuses: ${payrollData.bonuses}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2 lg:col-span-3">
            <CardHeader>
              <CardTitle>Net Payable</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">
                ${payrollData.net_payable}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
