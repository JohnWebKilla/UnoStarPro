import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DriverRating } from "../types";

interface BadRatingsProps {
  recentBadRatings: DriverRating[];
  isLoading: boolean;
  onTicketClick: (ticketId: string) => void;
}

export function BadRatings({
  recentBadRatings,
  isLoading,
  onTicketClick,
}: BadRatingsProps) {
  return (
    <Card className="shadow-sm bg-background/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Recent Bad Ratings</CardTitle>
        <CardDescription className="text-xs">
          Drivers with ratings below 3 stars
        </CardDescription>
      </CardHeader>
      <CardContent className="h-[280px] overflow-auto">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse bg-muted rounded" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {recentBadRatings.map((rating, index) => (
              <div
                key={index}
                className="flex items-start gap-2 p-2 rounded-lg bg-background/50 border hover:bg-background/80 transition-colors"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-50 dark:bg-red-900 flex items-center justify-center">
                  <span className="text-red-600 dark:text-red-400 font-semibold">
                    {rating.rating}★
                  </span>
                </div>
                <div className="flex-grow min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm truncate">
                        {rating.driverName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {rating.companyName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs hover:bg-primary/10 text-primary"
                        onClick={() => onTicketClick(rating.ticketId)}
                      >
                        {rating.ticketId}
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {rating.timestamp}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {rating.comment}
                  </p>
                </div>
              </div>
            ))}
            {recentBadRatings.length === 0 && (
              <div className="text-center py-4 text-muted-foreground">
                <p>No bad ratings reported</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
