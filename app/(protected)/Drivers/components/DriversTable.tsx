"use client";

import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  AlertTriangle,
  MoreVertical,
  Loader2,
  Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditDriverDialog } from "./EditDriverDialog";
import { DeleteDriverDialog } from "./DeleteDriverDialog";
import { useDrivers } from "./DriversProvider";

interface Document {
  id: number;
  expiration_date: string;
}

interface Driver {
  id: number;
  name: string;
  phone_number: string;
  truck_number: string;
  solo_or_team: string;
  status: string;
  driver_licenses: Document[];
  medical_cards: Document[];
  mvr_files: Document[];
}

export function DriversTable() {
  const { drivers, loading, error, refreshDrivers } = useDrivers();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const hasExpiringDocuments = (driver: Driver) => {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const checkExpiration = (docs: Document[]) => {
      return docs.some((doc) => {
        const expirationDate = new Date(doc.expiration_date);
        return expirationDate <= thirtyDaysFromNow;
      });
    };

    return (
      checkExpiration(driver.driver_licenses) ||
      checkExpiration(driver.medical_cards) ||
      checkExpiration(driver.mvr_files)
    );
  };

  const filteredDrivers = drivers.filter((driver) => {
    const matchesSearch =
      driver.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.phone_number.includes(searchTerm) ||
      driver.truck_number.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && driver.status === "Active") ||
      (statusFilter === "inactive" && driver.status !== "Active");

    return matchesSearch && matchesStatus;
  });

  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="text-red-600 text-lg">Error: {error}</div>
        <Button onClick={refreshDrivers} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search drivers..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Status Filter</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setStatusFilter("all")}>
              All
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter("active")}>
              Active
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter("inactive")}>
              Inactive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Drivers List</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Truck #</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDrivers.map((driver) => (
                <TableRow key={driver.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{driver.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {driver.phone_number}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{driver.truck_number}</TableCell>
                  <TableCell>
                    {driver.solo_or_team.charAt(0).toUpperCase() +
                      driver.solo_or_team.slice(1)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        driver.status === "Active" ? "success" : "secondary"
                      }
                    >
                      {driver.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <EditDriverDialog
                        driver={driver}
                        onDriverUpdated={refreshDrivers}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-blue-600"
                        onClick={() =>
                          window.open(
                            `/drivers/${driver.id}/documents`,
                            "_blank"
                          )
                        }
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      {hasExpiringDocuments(driver) && (
                        <Button variant="ghost" size="sm">
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        </Button>
                      )}
                      <DeleteDriverDialog
                        driverId={driver.id}
                        driverName={driver.name}
                        onDriverDeleted={refreshDrivers}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem
                            onClick={() =>
                              window.open(
                                `/drivers/${driver.id}/documents`,
                                "_blank"
                              )
                            }
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            <span>View Documents</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <span className="flex items-center">
                              <FileText className="h-4 w-4 mr-2" />
                              Download Profile
                            </span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
