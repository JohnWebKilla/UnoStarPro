export interface TicketMetrics {
  totalTickets: number;
  closedTickets: number;
  badRatings: number;
  systemIssues: number;
  newDrivers: number;
  deactivatedDrivers: number;
  avgResponseTime: number;
  ticketTrend: number;
  customerSatisfaction: number;
  avgCloseTime: number;
  newCompanies: number;
  deactivatedCompanies: number;
}

export interface MonthlyTickets {
  month: string;
  closedTickets: number;
  trend: number;
}

export interface UserPerformance {
  userName: string;
  email: string;
  avatar?: string;
  closedTickets: number;
  ticketsTrend: number;
  avgCloseTime: number;
  badRatingTickets: {
    ticketId: string;
    rating: "good" | "bad";
  }[];
  onlineStatus: "online" | "busy" | "offline";
}

export interface DriverRating {
  driverName: string;
  companyName: string;
  rating: number;
  comment: string;
  timestamp: string;
  ticketId: string;
}

export interface CompanyMetrics {
  companyName: string;
  activeDrivers: number;
  avgRating: number;
  ratingDistribution: {
    "5": number;
    "4": number;
    "3": number;
    "2": number;
    "1": number;
  };
}

// ... other interfaces
