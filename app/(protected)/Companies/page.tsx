import { DataTable } from "./components/data-table";
import { PageHeader } from "./components/page-header";
import { PageTransition } from "@/components/ui/page-transition";
import { getCompaniesAction } from "./server-actions";
import { SummaryCards } from "./summary-cards";
import { CompaniesClientProvider } from "./components/CompaniesClientProvider";
import { CompanyDialogWrapper } from "./components/dialogs/company-dialog-wrapper";

// Set revalidation period for Incremental Static Regeneration
export const revalidate = 60; // Revalidate every 60 seconds

export default async function CompaniesPage() {
  // Fetch companies from server action
  const { data: companies } = await getCompaniesAction();

  return (
    <CompaniesClientProvider initialCompanies={companies}>
      <PageTransition>
        <div className="space-y-4">
          <PageHeader />
          <SummaryCards />
          <DataTable data={companies} />
          <CompanyDialogWrapper />
        </div>
      </PageTransition>
    </CompaniesClientProvider>
  );
}
