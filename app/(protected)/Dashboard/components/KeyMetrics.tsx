import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TicketMetrics } from "../types";

interface KeyMetricsProps {
  metrics: TicketMetrics;
  isLoading: boolean;
}

export function KeyMetrics({ metrics, isLoading }: KeyMetricsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
      {/* Total Tickets */}
      <Card className="shadow-sm bg-background/50 backdrop-blur-sm">
        <CardHeader className="pb-1 pt-3 px-3">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-sm">Total Tickets</CardTitle>
              <CardDescription className="text-xs">This month</CardDescription>
            </div>
            <span
              className={`text-xs font-medium ${
                metrics.ticketTrend >= 0
                  ? "text-green-500 dark:text-green-400"
                  : "text-red-500 dark:text-red-400"
              }`}
            >
              {metrics.ticketTrend >= 0 ? "↑" : "↓"}{" "}
              {Math.abs(metrics.ticketTrend)}%
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-1 px-3 pb-3">
          {isLoading ? (
            <div className="h-6 animate-pulse bg-muted rounded" />
          ) : (
            <div className="flex items-baseline gap-1">
              <p className="text-xl font-bold">{metrics.totalTickets}</p>
              <p className="text-xs text-muted-foreground">
                ({metrics.closedTickets} closed ·{" "}
                {Math.round(
                  (metrics.closedTickets / metrics.totalTickets) * 100
                )}
                %)
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Response Times */}
      <Card className="shadow-sm bg-background/50 backdrop-blur-sm">
        <CardHeader className="pb-1 pt-3 px-3">
          <CardTitle className="text-sm">Response Times</CardTitle>
          <CardDescription className="text-xs">Average</CardDescription>
        </CardHeader>
        <CardContent className="pt-1 px-3 pb-3">
          {isLoading ? (
            <div className="h-6 animate-pulse bg-muted rounded" />
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-bold">{metrics.avgResponseTime}m</p>
                <p className="text-xs text-muted-foreground">First response</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold">{metrics.avgCloseTime}m</p>
                <p className="text-xs text-muted-foreground">Time to close</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Satisfaction */}
      <Card className="shadow-sm bg-background/50 backdrop-blur-sm">
        <CardHeader className="pb-1 pt-3 px-3">
          <CardTitle className="text-sm">Customer Satisfaction</CardTitle>
          <CardDescription className="text-xs">
            Based on ratings
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-1 px-3 pb-3">
          {isLoading ? (
            <div className="h-6 animate-pulse bg-muted rounded" />
          ) : (
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <p className="text-xl font-bold">
                  {metrics.customerSatisfaction}%
                </p>
                <p className="text-xs text-muted-foreground">
                  satisfaction rate
                </p>
              </div>
              <div className="w-full bg-muted rounded-full h-1">
                <div
                  className="bg-green-500 rounded-full h-1 transition-all duration-500"
                  style={{ width: `${metrics.customerSatisfaction}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Health */}
      <Card className="shadow-sm bg-background/50 backdrop-blur-sm">
        <CardHeader className="pb-1 pt-3 px-3">
          <CardTitle className="text-sm">System Health</CardTitle>
          <CardDescription className="text-xs">Active issues</CardDescription>
        </CardHeader>
        <CardContent className="pt-1 px-3 pb-3">
          {isLoading ? (
            <div className="h-6 animate-pulse bg-muted rounded" />
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    metrics.systemIssues === 0
                      ? "bg-green-500"
                      : metrics.systemIssues < 5
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  }`}
                />
                <p className="text-xl font-bold">{metrics.systemIssues}</p>
                <p className="text-xs text-muted-foreground">open issues</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {metrics.systemIssues === 0
                  ? "All systems operational"
                  : metrics.systemIssues < 5
                    ? "Minor issues detected"
                    : "Critical issues detected"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
