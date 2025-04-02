"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

export function CompanyDialog({
  open,
  onOpenChange,
  userId,
}: CompanyDialogProps) {
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchCompanies();
      fetchUserCompanies();
    }
  }, [open, userId]);

  const fetchCompanies = async () => {
    try {
      const response = await fetch("/api/companies");
      const data = await response.json();
      setCompanies(data);
    } catch (error) {
      console.error("Error fetching companies:", error);
    }
  };

  const fetchUserCompanies = async () => {
    try {
      const response = await fetch(`/api/users/${userId}/companies`);
      const data = await response.json();
      setSelectedCompanies(data.associated_companies || []);
    } catch (error) {
      console.error("Error fetching user companies:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/users/${userId}/companies`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companies: selectedCompanies }),
      });

      if (!response.ok) throw new Error("Failed to update companies");

      toast({
        title: "Success",
        description: "Companies updated successfully",
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update companies",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Manage Companies</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-4">
            {companies.map((company) => (
              <div key={company.id} className="flex items-center space-x-2">
                <Checkbox
                  id={company.id}
                  checked={selectedCompanies.includes(company.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedCompanies([...selectedCompanies, company.id]);
                    } else {
                      setSelectedCompanies(
                        selectedCompanies.filter((id) => id !== company.id)
                      );
                    }
                  }}
                />
                <label
                  htmlFor={company.id}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {company.name}
                </label>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
