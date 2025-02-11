import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { MonthlyTickets } from "../types";

interface MonthlyTrendProps {
  monthlyTickets: MonthlyTickets[];
  isLoading: boolean;
}

export function MonthlyTrend({ monthlyTickets, isLoading }: MonthlyTrendProps) {
  return (
    <Card className="shadow-sm bg-background/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Monthly Tickets Trend</CardTitle>
        <CardDescription className="text-xs">
          Closed tickets per month
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[250px] animate-pulse bg-muted rounded" />
        ) : (
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTickets}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as MonthlyTickets;
                      return (
                        <div className="bg-background p-2 rounded shadow-lg border text-xs">
                          <p className="font-bold">{data.month}</p>
                          <div className="flex items-center gap-1.5">
                            <p className="text-blue-600">
                              {data.closedTickets} tickets
                            </p>
                            <span
                              className={`text-xs font-medium ${
                                data.trend > 0
                                  ? "text-green-500"
                                  : data.trend < 0
                                    ? "text-red-500"
                                    : "text-gray-500"
                              }`}
                            >
                              {data.trend > 0
                                ? "↑"
                                : data.trend < 0
                                  ? "↓"
                                  : "–"}{" "}
                              {Math.abs(data.trend)}%
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="closedTickets"
                  fill="hsl(var(--primary))"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
