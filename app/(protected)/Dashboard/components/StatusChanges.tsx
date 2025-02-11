import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TicketMetrics } from "../types";

interface StatusChangesProps {
  metrics: TicketMetrics;
  isLoading: boolean;
}

export function StatusChanges({ metrics, isLoading }: StatusChangesProps) {
  return (
    <Card className="shadow-sm bg-background/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Status Changes</CardTitle>
        <CardDescription className="text-xs">
          Drivers and companies this month
        </CardDescription>
      </CardHeader>
      <CardContent className="h-[250px]">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-20" />
                <div className="space-y-1">
                  <div className="h-2 bg-muted rounded" />
                  <div className="h-2 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Drivers Section */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Drivers
              </p>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-sm text-green-600">New</p>
                    <p className="text-sm font-bold">+{metrics.newDrivers}</p>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1">
                    <div
                      className="bg-green-500 rounded-full h-1 transition-all duration-300"
                      style={{ width: `${(metrics.newDrivers / 50) * 100}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-sm text-red-600">Deactivated</p>
                    <p className="text-sm font-bold">
                      -{metrics.deactivatedDrivers}
                    </p>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1">
                    <div
                      className="bg-red-500 rounded-full h-1 transition-all duration-300"
                      style={{
                        width: `${(metrics.deactivatedDrivers / 50) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Companies Section */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Companies
              </p>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-sm text-green-600">New</p>
                    <p className="text-sm font-bold">+{metrics.newCompanies}</p>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1">
                    <div
                      className="bg-green-500 rounded-full h-1 transition-all duration-300"
                      style={{ width: `${(metrics.newCompanies / 10) * 100}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-sm text-red-600">Deactivated</p>
                    <p className="text-sm font-bold">
                      -{metrics.deactivatedCompanies}
                    </p>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1">
                    <div
                      className="bg-red-500 rounded-full h-1 transition-all duration-300"
                      style={{
                        width: `${(metrics.deactivatedCompanies / 10) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Net Change Summary */}
            <div className="pt-2 border-t">
              <div className="flex justify-between items-center">
                <div className="text-xs">
                  <p className="text-muted-foreground">Net Change</p>
                  <p className="font-medium">
                    Drivers:{" "}
                    <span
                      className={
                        metrics.newDrivers - metrics.deactivatedDrivers >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }
                    >
                      {metrics.newDrivers - metrics.deactivatedDrivers >= 0
                        ? "+"
                        : ""}
                      {metrics.newDrivers - metrics.deactivatedDrivers}
                    </span>
                  </p>
                </div>
                <div className="text-xs text-right">
                  <p className="text-muted-foreground">Companies</p>
                  <p className="font-medium">
                    <span
                      className={
                        metrics.newCompanies - metrics.deactivatedCompanies >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }
                    >
                      {metrics.newCompanies - metrics.deactivatedCompanies >= 0
                        ? "+"
                        : ""}
                      {metrics.newCompanies - metrics.deactivatedCompanies}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
