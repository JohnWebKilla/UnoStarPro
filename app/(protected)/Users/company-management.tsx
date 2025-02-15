"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { updateUserCompanyAccess } from "./actions";
import { UserRole } from "./types";
import { Building, Info } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CompanyManagementProps {
  userId: string;
  userRole: UserRole;
  currentCompanyIds?: number[];
  hasAllAccess: boolean;
  companies: Array<{ id: number; name: string }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName?: string;
  onSuccess?: (selectedCompanyIds: number[], isAllAccess: boolean) => void;
}

export function CompanyManagement({
  userId,
  userRole,
  currentCompanyIds = [],
  hasAllAccess,
  companies = [],
  open,
  onOpenChange,
  userName = "User",
  onSuccess,
}: CompanyManagementProps) {
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<number[]>([]);
  const [isAllAccess, setIsAllAccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Always keep local state in sync with props
  useEffect(() => {
    setSelectedCompanyIds([...currentCompanyIds]);
    setIsAllAccess(hasAllAccess);
  }, [currentCompanyIds, hasAllAccess]);

  const handleCompanyToggle = (companyId: number) => {
    if (isSubmitting) return;
    setSelectedCompanyIds((prev) =>
      prev.includes(companyId)
        ? prev.filter((id) => id !== companyId)
        : [...prev, companyId]
    );
  };

  const handleSubmit = async () => {
    if (!userId) {
      toast({
        title: "Error",
        description: "User ID is required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    // Call onSuccess immediately with the new data
    onSuccess?.(selectedCompanyIds, isAllAccess);

    try {
      const result = await updateUserCompanyAccess(
        userId,
        isAllAccess ? null : selectedCompanyIds,
        isAllAccess
      );

      if (result.error) {
        throw new Error(result.error);
      }

      toast({
        title: "Success",
        description: "Company access updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => !isSubmitting && onOpenChange(open)}
    >
      <DialogContent className="sm:max-w-[500px] w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Manage Company Access
          </DialogTitle>
          <DialogDescription>
            Configure company access for {userName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Access Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Current Access
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm">
                <Info className="h-4 w-4 text-blue-500" />
                {hasAllAccess ? (
                  <span className="font-medium text-green-600">
                    Has access to all companies
                  </span>
                ) : currentCompanyIds && currentCompanyIds.length > 0 ? (
                  <div className="space-y-1">
                    <span>Currently assigned to:</span>
                    <div className="flex flex-wrap gap-2">
                      {companies
                        .filter((company) =>
                          currentCompanyIds.includes(company.id)
                        )
                        .map((company) => (
                          <Badge key={company.id} variant="secondary">
                            {company.name}
                          </Badge>
                        ))}
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground">
                    No company access configured
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Company Selection */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-base">Configure Access</Label>
              {userRole === "admin" && (
                <Badge variant="outline" className="font-normal">
                  Admin User
                </Badge>
              )}
            </div>

            {userRole === "admin" && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="all-access"
                  checked={isAllAccess}
                  onCheckedChange={(checked) => {
                    setIsAllAccess(!!checked);
                    if (checked) {
                      setSelectedCompanyIds([]);
                    }
                  }}
                />
                <label
                  htmlFor="all-access"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Grant access to all companies
                </label>
              </div>
            )}

            {!isAllAccess && (
              <ScrollArea className="h-[200px] rounded-md border p-4">
                <div className="space-y-4">
                  {companies.map((company) => (
                    <div
                      key={company.id}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        id={`company-${company.id}`}
                        checked={selectedCompanyIds.includes(company.id)}
                        onCheckedChange={() => handleCompanyToggle(company.id)}
                      />
                      <label
                        htmlFor={`company-${company.id}`}
                        className="text-sm font-medium leading-none"
                      >
                        {company.name}
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {!isAllAccess && selectedCompanyIds.length > 0 && (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Info className="h-4 w-4" />
                {selectedCompanyIds.length} companies selected
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                isSubmitting ||
                (!isAllAccess && selectedCompanyIds.length === 0)
              }
              className="min-w-[100px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
