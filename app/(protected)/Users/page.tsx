"use client";

import { useState } from "react";
import { User } from "./lib/types/types";
import { useToast } from "@/components/ui/use-toast";
import { UsersProvider, useUsers } from "./components/providers/UsersProvider";
import { UsersHeader } from "./components/layout/UsersHeader";
import { UsersLayout } from "./components/layout/UsersLayout";
import { UsersFilters } from "./components/filters/UsersFilters";
import { UsersTable } from "./components/table/UsersTable";
import { CompanyManagement } from "./components/features/company-management";
import { Card, CardContent } from "@/components/ui/card";

function UsersContent() {
  const [selectedUser, setSelectedUser] = useState<User | undefined>();
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [userForCompanies, setUserForCompanies] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const { users, loading: isLoading, companies } = useUsers();

  const { toast } = useToast();

  const handleEdit = (user: User) => {
    setSelectedUser(user);
  };

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

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      searchQuery === "" ||
      user.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesStatus =
      statusFilter === "all" || user.status.toLowerCase() === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-4 p-8">
      <UsersHeader />

      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <UsersFilters
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              roleFilter={roleFilter}
              onRoleChange={setRoleFilter}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
            />

            <UsersTable
              data={filteredUsers}
              isLoading={isLoading}
              onEdit={handleEdit}
              onToggleStatus={async () => {}}
              onApprove={async () => {}}
              onManageCompanies={handleManageCompanies}
              companies={companies}
            />
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
}

export default function UsersPage() {
  return (
    <UsersProvider>
      <UsersContent />
    </UsersProvider>
  );
}
