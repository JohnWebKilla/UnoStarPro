"use client";

import { useState } from "react";
import { User } from "./lib/types/types";
import { useToast } from "@/components/ui/use-toast";
import { UsersProvider, useUsers } from "./components/providers/UsersProvider";
import { UsersHeader } from "./components/layout/UsersHeader";
import { CompanyManagement } from "./components/features/company-management";
import { DataTable } from "./components/table/data-table";
import { columns } from "./components/table/columns";
import { PageTransition } from "@/components/ui/page-transition";
import { UserDialog } from "./components/dialogs/user-dialog";

function UsersContent() {
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [userForCompanies, setUserForCompanies] = useState<User | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [userForEdit, setUserForEdit] = useState<User | null>(null);
  const { users, loading: isLoading, companies, updateUser } = useUsers();
  const { toast } = useToast();

  const handleManageCompanies = (user: User) => {
    setUserForCompanies(user);
    setCompanyDialogOpen(true);
  };

  const handleCompanyDialogClose = (open: boolean) => {
    setCompanyDialogOpen(open);
    if (!open) {
      setUserForCompanies(null);
    }
  };

  const handleEditDialogClose = (open: boolean) => {
    setEditDialogOpen(open);
    if (!open) {
      setUserForEdit(null);
    }
  };

  const handleEditSuccess = async (updatedUser?: User) => {
    try {
      if (!updatedUser) return;

      // Remove properties that shouldn't be updated
      const { created_at, companies, id, ...updateData } = updatedUser;

      console.log("Attempting to update user:", {
        id: updatedUser.id,
        updateData,
      });

      const result = await updateUser(updatedUser.id, updateData);
      console.log("Update successful:", result);

      toast({
        title: "Success",
        description: "User updated successfully",
      });
      setEditDialogOpen(false);
      setUserForEdit(null);
    } catch (error) {
      console.error("Error in handleEditSuccess:", {
        error,
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });

      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update user. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleActivateSelected = async (ids: string[]) => {
    try {
      await Promise.all(
        ids.map((id) =>
          updateUser(id, {
            status: "active",
          })
        )
      );
      toast({
        title: "Success",
        description: `Successfully activated ${ids.length} user(s)`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to activate selected users",
        variant: "destructive",
      });
    }
  };

  const handleDeactivateSelected = async (ids: string[]) => {
    try {
      await Promise.all(
        ids.map((id) =>
          updateUser(id, {
            status: "inactive",
          })
        )
      );
      toast({
        title: "Success",
        description: `Successfully deactivated ${ids.length} user(s)`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to deactivate selected users",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <UsersHeader />
      <DataTable
        columns={columns}
        data={users}
        loadingRows={
          isLoading ? Object.fromEntries(users.map((_, i) => [i, true])) : {}
        }
        meta={{
          onEdit: (user: User) => {
            setUserForEdit(user);
            setEditDialogOpen(true);
          },
          onManageCompanies: handleManageCompanies,
          onToggleStatus: async (user: User) => {
            try {
              await updateUser(user.id, {
                status: user.status === "active" ? "inactive" : "active",
              });
              toast({
                title: "Success",
                description: "User status updated successfully",
              });
            } catch (error) {
              toast({
                title: "Error",
                description: "Failed to update user status",
                variant: "destructive",
              });
            }
          },
          onApprove: async (user: User) => {
            // Handle approve
          },
          companies,
        }}
        onActivateSelected={handleActivateSelected}
        onDeactivateSelected={handleDeactivateSelected}
      />

      {userForCompanies && (
        <CompanyManagement
          open={companyDialogOpen}
          onOpenChange={handleCompanyDialogClose}
          userId={userForCompanies.id}
          userRole={userForCompanies.role}
          currentCompanyIds={userForCompanies.companies?.map((c) => c.id) || []}
          hasAllAccess={userForCompanies.has_all_access}
          companies={companies}
          userName={`${userForCompanies.first_name} ${userForCompanies.last_name}`}
          onSuccess={async () => {
            setCompanyDialogOpen(false);
            setUserForCompanies(null);
          }}
        />
      )}

      {userForEdit && (
        <UserDialog
          key={`edit-${userForEdit.id}`}
          open={editDialogOpen}
          onOpenChange={handleEditDialogClose}
          user={userForEdit}
          onSuccess={handleEditSuccess}
          companies={companies}
        />
      )}
    </div>
  );
}

export default function UsersPage() {
  return (
    <UsersProvider>
      <PageTransition>
        <UsersContent />
      </PageTransition>
    </UsersProvider>
  );
}
