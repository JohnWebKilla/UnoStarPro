"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { format, startOfMonth, endOfMonth, subMonths, subDays } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

// Add these interfaces at the top
interface HistoricalTrend {
  period: string;
  metrics: {
    tickets: number;
    satisfaction: number;
    responseTime: number;
    efficiency: number;
    firstContactResolution: number;
    escalationRate: number;
  };
  goals: {
    tickets: number;
    satisfaction: number;
    responseTime: number;
    firstContactResolution: number;
    escalationRate: number;
  };
}

interface LeaderboardEntry {
  user_id: string;
  userName: string;
  score: number;
  trend: "up" | "down" | "stable";
  previousRank: number;
  currentRank: number;
  metrics: {
    tickets: number;
    satisfaction: number;
    responseTime: number;
    firstContactResolution: number;
    escalationRate: number;
  };
}

// Add mock data constants outside the component
const mockData = [
  {
    id: 1,
    user_id: "1",
    metric_type: "tickets_closed",
    metric_value: 95,
    metric_date: format(new Date(), "yyyy-MM-dd"),
    user: {
      first_name: "John",
      last_name: "Ganiev",
    },
  },
  // Add more mock data as needed
];

const mockHistoricalTrends: HistoricalTrend[] = Array.from(
  { length: 6 },
  (_, i) => ({
    period: format(subMonths(new Date(), 5 - i), "MMM yyyy"),
    metrics: {
      tickets: Math.floor(Math.random() * 50) + 30,
      satisfaction: Math.floor(Math.random() * 15) + 80,
      responseTime: Math.floor(Math.random() * 20) + 10,
      efficiency: Math.floor(Math.random() * 25) + 70,
      firstContactResolution: Math.floor(Math.random() * 20) + 75,
      escalationRate: Math.floor(Math.random() * 10) + 5,
    },
    goals: {
      tickets: 50,
      satisfaction: 95,
      responseTime: 15,
      firstContactResolution: 85,
      escalationRate: 10,
    },
  })
);

const mockLeaderboardData: LeaderboardEntry[] = [
  {
    user_id: "1",
    userName: "John Ganiev",
    score: 95,
    trend: "up",
    previousRank: 2,
    currentRank: 1,
    metrics: {
      tickets: 127,
      satisfaction: 98,
      responseTime: 12,
      firstContactResolution: 85,
      escalationRate: 5,
    },
  },
  // Add more mock entries as needed
];

// Update the fetch functions to return proper types
const fetchHistoricalTrends = async (): Promise<HistoricalTrend[]> => {
  // In the future, replace with actual API call
  return mockHistoricalTrends;
};

const fetchLeaderboardData = async (): Promise<LeaderboardEntry[]> => {
  // In the future, replace with actual API call
  return mockLeaderboardData;
};

interface PerformanceData {
  rated_person: string;
  total_tickets: number;
  good_ratings: number;
  bad_ratings: number;
  satisfaction_rate: number;
  bonus_amount: number;
}

interface ShiftPerformanceData {
  shift_id: number;
  shift_name: string;
  user_id: string;
  user_name: string;
  total_tickets: number;
  good_ratings: number;
  bad_ratings: number;
  satisfaction_rate: number;
  total_bonus: number;
  shift_rank: number;
}

interface HistoricalShiftData {
  date: string;
  shift_id: number;
  shift_name: string;
  user_id: string;
  user_name: string;
  total_tickets: number;
  good_ratings: number;
  bad_ratings: number;
  satisfaction_rate: number;
  daily_shift_rank: number;
}

// Add these colors after the interfaces
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];
const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export function PerformanceMetrics() {
  const [selectedShift, setSelectedShift] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<string>("7");
  const [shiftPerformance, setShiftPerformance] = useState<
    ShiftPerformanceData[]
  >([]);
  const [historicalData, setHistoricalData] = useState<HistoricalShiftData[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchPerformanceData();
  }, [selectedShift, timeRange]);

  const fetchPerformanceData = async () => {
    try {
      setIsLoading(true);

      // Fetch shift-based performance analytics
      const { data: shiftData, error: shiftError } = await supabase
        .from("shift_performance_analytics")
        .select("*");

      if (shiftError) throw shiftError;

      // Fetch historical performance data
      const { data: historyData, error: historyError } = await supabase
        .from("historical_shift_performance")
        .select("*")
        .gte(
          "date",
          format(subDays(new Date(), parseInt(timeRange)), "yyyy-MM-dd")
        );

      if (historyError) throw historyError;

      setShiftPerformance(shiftData || []);
      setHistoricalData(historyData || []);
    } catch (error: any) {
      console.error("Error fetching performance data:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredShiftData =
    selectedShift === "all"
      ? shiftPerformance
      : shiftPerformance.filter((d) => d.shift_name === selectedShift);

  const aggregatedHistoricalData = historicalData.reduce(
    (acc, curr) => {
      const key = `${curr.date}_${curr.shift_name}`;
      if (!acc[key]) {
        acc[key] = {
          date: curr.date,
          shift_name: curr.shift_name,
          total_tickets: 0,
          satisfaction_rate: 0,
          user_count: 0,
        };
      }
      acc[key].total_tickets += curr.total_tickets;
      acc[key].satisfaction_rate += curr.satisfaction_rate;
      acc[key].user_count += 1;
      return acc;
    },
    {} as Record<string, any>
  );

  const chartData = Object.values(aggregatedHistoricalData).map((d) => ({
    ...d,
    satisfaction_rate: d.satisfaction_rate / d.user_count,
  }));

  const exportData = () => {
    const csvContent = [
      [
        "Shift",
        "Team Member",
        "Total Tickets",
        "Satisfaction Rate",
        "Good Ratings",
        "Bad Ratings",
        "Bonus Amount",
        "Rank",
      ],
      ...filteredShiftData.map((data) => [
        data.shift_name,
        data.user_name,
        data.total_tickets,
        data.satisfaction_rate,
        data.good_ratings,
        data.bad_ratings,
        data.total_bonus,
        data.shift_rank,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `performance_metrics_${selectedShift}_${timeRange}days.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const prepareChartData = () => {
    // Prepare data for pie chart
    const shiftDistribution = filteredShiftData.reduce(
      (acc, curr) => {
        if (!acc[curr.shift_name]) {
          acc[curr.shift_name] = 0;
        }
        acc[curr.shift_name] += curr.total_tickets;
        return acc;
      },
      {} as Record<string, number>
    );

    const pieData = Object.entries(shiftDistribution).map(([name, value]) => ({
      name,
      value,
    }));

    // Prepare data for radar chart
    const radarData = filteredShiftData.map((data) => ({
      subject: data.user_name,
      "Satisfaction Rate": data.satisfaction_rate,
      Tickets: data.total_tickets,
      "Good Ratings": data.good_ratings,
      "Performance Bonus": data.total_bonus,
    }));

    return { pieData, radarData };
  };

  const { pieData, radarData } = prepareChartData();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        Loading performance metrics...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex gap-4">
          <Select value={selectedShift} onValueChange={setSelectedShift}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select shift" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Shifts</SelectItem>
              <SelectItem value="Shift 1">Shift 1 (08:00-16:00)</SelectItem>
              <SelectItem value="Shift 2">Shift 2 (16:00-00:00)</SelectItem>
              <SelectItem value="Shift 3">Shift 3 (00:00-08:00)</SelectItem>
            </SelectContent>
          </Select>

          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={exportData} className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export Data
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="charts">Performance Charts</TabsTrigger>
          <TabsTrigger value="comparison">Shift Comparison</TabsTrigger>
          <TabsTrigger value="details">Detailed Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {filteredShiftData.map((shift) => (
              <Card key={`${shift.shift_id}_${shift.user_id}`}>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    {shift.user_name} - {shift.shift_name}
                  </CardTitle>
                  <CardDescription>
                    {shift.shift_rank <= 3 ? (
                      <span className="font-semibold text-green-600">
                        Rank #{shift.shift_rank} - ${shift.total_bonus} Bonus
                      </span>
                    ) : (
                      `Rank #${shift.shift_rank}`
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Satisfaction</span>
                      <span className="font-bold">
                        {shift.satisfaction_rate}%
                      </span>
                    </div>
                    <Progress value={shift.satisfaction_rate} className="h-2" />
                    <div className="flex justify-between text-sm">
                      <span>Total Tickets: {shift.total_tickets}</span>
                      <span>Good Ratings: {shift.good_ratings}</span>
                    </div>
                    {shift.shift_rank <= 3 && (
                      <div className="pt-2 border-t">
                        <div className="flex justify-between font-medium">
                          <span>Leaderboard Bonus:</span>
                          <span className="text-green-600 font-bold">
                            ${shift.total_bonus}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="charts">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Performance Trends</CardTitle>
                <CardDescription>
                  Historical performance data over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="satisfaction_rate"
                        stroke="#8884d8"
                        name="Satisfaction Rate (%)"
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="total_tickets"
                        stroke="#82ca9d"
                        name="Total Tickets"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ticket Distribution</CardTitle>
                <CardDescription>
                  Distribution of tickets across shifts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={renderCustomizedLabel}
                        outerRadius={150}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="comparison">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics Comparison</CardTitle>
                <CardDescription>
                  Radar chart comparing key metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart
                      cx="50%"
                      cy="50%"
                      outerRadius="80%"
                      data={radarData}
                    >
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" />
                      <PolarRadiusAxis />
                      <Radar
                        name="Satisfaction Rate"
                        dataKey="Satisfaction Rate"
                        stroke="#8884d8"
                        fill="#8884d8"
                        fillOpacity={0.6}
                      />
                      <Radar
                        name="Tickets"
                        dataKey="Tickets"
                        stroke="#82ca9d"
                        fill="#82ca9d"
                        fillOpacity={0.6}
                      />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Shift Performance Breakdown</CardTitle>
                <CardDescription>
                  Comparing metrics across shifts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filteredShiftData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="user_name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="satisfaction_rate"
                        name="Satisfaction Rate"
                        fill="#8884d8"
                      />
                      <Bar
                        dataKey="total_tickets"
                        name="Total Tickets"
                        fill="#82ca9d"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Performance Analysis</CardTitle>
              <CardDescription>
                Comprehensive breakdown by shift and team member
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shift</TableHead>
                    <TableHead>Team Member</TableHead>
                    <TableHead>Total Tickets</TableHead>
                    <TableHead>Satisfaction Rate</TableHead>
                    <TableHead>Good/Bad Ratings</TableHead>
                    <TableHead>Rank</TableHead>
                    <TableHead>Bonus</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredShiftData.map((data) => (
                    <TableRow key={`${data.shift_id}_${data.user_id}`}>
                      <TableCell>{data.shift_name}</TableCell>
                      <TableCell className="font-medium">
                        {data.user_name}
                      </TableCell>
                      <TableCell>{data.total_tickets}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={data.satisfaction_rate}
                            className="w-[60px]"
                          />
                          <span>{data.satisfaction_rate}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-green-600">
                          {data.good_ratings}
                        </span>
                        {" / "}
                        <span className="text-red-600">{data.bad_ratings}</span>
                      </TableCell>
                      <TableCell>
                        {data.shift_rank <= 3 ? (
                          <span className="font-medium text-green-600">
                            #{data.shift_rank}
                          </span>
                        ) : (
                          `#${data.shift_rank}`
                        )}
                      </TableCell>
                      <TableCell>
                        {data.total_bonus > 0 ? (
                          <span className="font-medium text-green-600">
                            ${data.total_bonus}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  description: string;
}

function MetricCard({ title, value, description }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}
