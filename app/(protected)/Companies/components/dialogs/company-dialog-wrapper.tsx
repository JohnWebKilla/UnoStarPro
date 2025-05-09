"use client";

import { useState, useEffect } from "react";
import { useCompanies } from "../CompaniesClientProvider";
import { Company } from "../../types";
import { CompanySideDialog } from "./company-side-dialog";

export function CompanyDialogWrapper() {
  const {
    selectedCompany,
    setSelectedCompany,
    handleUpdateCompany,
    refreshCompanies,
  } = useCompanies();
  const [isOpen, setIsOpen] = useState(false);

  // Update open state when selectedCompany changes
  useEffect(() => {
    setIsOpen(!!selectedCompany);
  }, [selectedCompany]);

  // Handle dialog close
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setSelectedCompany(null);
    }
  };

  // Handle company update
  const handleUpdate = async (companyId: number, data: any) => {
    await handleUpdateCompany(companyId, data);
    refreshCompanies();
  };

  // Handle company delete
  const handleDelete = async (companyId: number) => {
    // Implement delete functionality if needed
    await fetch(`/api/companies/${companyId}`, {
      method: "DELETE",
    });
    setIsOpen(false);
    setSelectedCompany(null);
    refreshCompanies();
  };

  return (
    <CompanySideDialog
      company={selectedCompany as any}
      open={isOpen}
      onOpenChange={handleOpenChange}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
    />
  );
}
