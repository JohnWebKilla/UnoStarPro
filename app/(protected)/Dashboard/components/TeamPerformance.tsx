import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import { UserPerformance } from "../types";
import { CheckCircle2, XCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare } from "lucide-react";

interface TeamPerformanceProps {
  userPerformance: UserPerformance[];
  isLoading: boolean;
  onTicketClick: (ticketId: string) => void;
}

interface ManagerComment {
  managerId: string;
  managerName: string;
  managerAvatar: string;
  comment: string;
  timestamp: string;
}

type BadRatingTicket = {
  ticketId: string;
  rating: "good" | "bad";
};

interface TicketDetails extends BadRatingTicket {
  managerComment?: ManagerComment;
  status: "pending" | "reviewed";
}

// Mock manager comments (in real app, this would come from API)
const mockTicketDetails: Record<string, TicketDetails> = {
  "TKT-2024-001": {
    ticketId: "TKT-2024-001",
    rating: "bad",
    status: "reviewed",
    managerComment: {
      managerId: "MGR-001",
      managerName: "Sarah Wilson",
      managerAvatar: "/avatars/sarah.jpg",
      comment:
        "Agent needs to improve response time. Follow-up training scheduled.",
      timestamp: "2024-02-08 14:30",
    },
  },
  "TKT-2024-002": {
    ticketId: "TKT-2024-002",
    rating: "bad",
    status: "reviewed",
    managerComment: {
      managerId: "MGR-002",
      managerName: "David Chen",
      managerAvatar: "/avatars/david.jpg",
      comment:
        "Valid customer complaint. Agent has been coached on proper procedures.",
      timestamp: "2024-02-09 09:15",
    },
  },
  "TKT-2024-003": {
    ticketId: "TKT-2024-003",
    rating: "bad",
    status: "pending",
  },
};

export function TeamPerformance({
  userPerformance,
  isLoading,
  onTicketClick,
}: TeamPerformanceProps) {
  const [selectedUser, setSelectedUser] = useState<UserPerformance | null>(
    null
  );
  const [showRatingsDialog, setShowRatingsDialog] = useState(false);

  const getBadTicketsCount = (user: UserPerformance | null) => {
    if (!user) return 0;
    return user.badRatingTickets.filter((t) => t.rating === "bad").length;
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  return (
    <>
      <Card className="shadow-sm bg-background/50 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Support Team Performance</CardTitle>
          <CardDescription className="text-xs">
            Real-time agent metrics
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[280px] overflow-auto">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-6 animate-pulse bg-muted rounded" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background/90 backdrop-blur-sm">
                  <tr className="border-b">
                    <th className="text-left py-1">Agent</th>
                    <th className="text-left py-1">Closed Tickets</th>
                    <th className="text-left py-1">Avg Close Time</th>
                    <th className="text-left py-1">Bad Tickets</th>
                    <th className="text-left py-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {userPerformance.map((user, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-1">
                        <div>
                          <p className="font-medium">{user.userName}</p>
                          <p className="text-xs text-muted-foreground">
                            {user.email}
                          </p>
                        </div>
                      </td>
                      <td className="py-1">
                        <div className="flex items-baseline gap-1.5">
                          <span>{user.closedTickets}</span>
                          <span
                            className={`text-xs ${
                              user.ticketsTrend > 0
                                ? "text-green-500"
                                : user.ticketsTrend < 0
                                  ? "text-red-500"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {user.ticketsTrend > 0 ? "↑" : "↓"}{" "}
                            {Math.abs(user.ticketsTrend)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-1">
                        <div className="flex items-baseline gap-1.5">
                          <span>{user.avgCloseTime}m</span>
                          <span className="text-xs text-muted-foreground">
                            avg
                          </span>
                        </div>
                      </td>
                      <td className="py-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-6 px-2 text-xs ${
                            getBadTicketsCount(user) > 0
                              ? "text-destructive hover:bg-destructive/10"
                              : "text-muted-foreground"
                          }`}
                          onClick={() => {
                            setSelectedUser(user);
                            setShowRatingsDialog(true);
                          }}
                        >
                          {getBadTicketsCount(user)}
                        </Button>
                      </td>
                      <td className="py-1">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs
                            ${
                              user.onlineStatus === "online"
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : user.onlineStatus === "busy"
                                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                            }`}
                        >
                          {user.onlineStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showRatingsDialog} onOpenChange={setShowRatingsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage
                  src={selectedUser?.avatar}
                  alt={selectedUser?.userName}
                />
                <AvatarFallback>
                  {selectedUser?.userName
                    ? getInitials(selectedUser.userName)
                    : "??"}
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle>{selectedUser?.userName}</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {selectedUser?.email}
                </p>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {selectedUser?.badRatingTickets
              .filter((ticket) => ticket.rating === "bad")
              .map((ticket) => {
                const details = mockTicketDetails[ticket.ticketId];
                return (
                  <div
                    key={ticket.ticketId}
                    className="space-y-3 p-4 rounded-lg border bg-muted/50"
                  >
                    <div className="flex items-center justify-between">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs hover:bg-primary/10 text-primary"
                        onClick={() => onTicketClick(ticket.ticketId)}
                      >
                        {ticket.ticketId}
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {details?.status === "pending"
                          ? "Pending Review"
                          : "Reviewed"}
                      </span>
                    </div>

                    {details?.managerComment && (
                      <div className="pl-4 border-l-2 border-muted">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage
                              src={details.managerComment.managerAvatar}
                              alt={details.managerComment.managerName}
                            />
                            <AvatarFallback>
                              {getInitials(details.managerComment.managerName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">
                                {details.managerComment.managerName}
                              </p>
                              <span className="text-xs text-muted-foreground">
                                {details.managerComment.timestamp}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {details.managerComment.comment}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            {selectedUser && getBadTicketsCount(selectedUser) === 0 && (
              <p className="text-center text-muted-foreground">
                No bad tickets found
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
