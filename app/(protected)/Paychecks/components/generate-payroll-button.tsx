"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { generatePayrollAction } from "../actions/payroll";
import { useState } from "react";
import { Loader2 } from "lucide-react";

interface GeneratePayrollButtonProps {
  onSuccess?: () => void;
}

export function GeneratePayrollButton({
  onSuccess,
}: GeneratePayrollButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const { success, error } = await generatePayrollAction();
      if (success) {
        toast({
          title: "Success",
          description: "Payroll generated successfully",
        });
        onSuccess?.();
      } else {
        throw new Error(error || "Failed to generate payroll");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate payroll",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button onClick={handleGenerate} disabled={isGenerating}>
      {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Generate Payroll
    </Button>
  );
}
