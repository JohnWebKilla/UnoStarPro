import { DataTable } from "./components/data-table";
import { PageHeader } from "./components/page-header";
import { PageTransition } from "@/components/ui/page-transition";
import { getCompaniesAction } from "./server-actions";
import { SummaryCards } from "./summary-cards";
import { CompaniesClientProvider } from "./components/CompaniesClientProvider";
import { CompanyDialogWrapper } from "./components/dialogs/company-dialog-wrapper";
import { Suspense } from "react";
import { TableSkeleton } from "./table-skeleton";
import { Company } from "./types";

// Set a more conservative revalidation period based on data change frequency
export const revalidate = 300; // Revalidate every 5 minutes instead of every 60 seconds

export default async function CompaniesPage() {
  try {
    console.log("CompaniesPage: Starting to fetch companies data");

    // Fetch companies from server action
    const result = await getCompaniesAction();

    console.log(
      `CompaniesPage: Fetched companies from ${result.source}, found ${result.data?.length || 0} companies`
    );

    // Ensure data is always an array of Company objects
    const companies: Company[] = Array.isArray(result.data) ? result.data : [];

    // Create a unique ID for this page render to force reset on navigation
    const pageKey = Date.now().toString();

    console.log(`CompaniesPage: Rendering with ${companies.length} companies`);

    // Use a Debug Panel during development to help troubleshoot
    const DebugPanel =
      process.env.NODE_ENV === "development" ? (
        <div className="p-2 mb-4 border border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs">
          <div className="font-bold mb-1">Debug Info:</div>
          <div>Source: {result.source}</div>
          <div>Companies: {companies.length}</div>
          <div>Cache Key: {pageKey}</div>
          <div>First company: {companies[0]?.name || "None"}</div>
        </div>
      ) : null;

    return (
      <CompaniesClientProvider initialCompanies={companies}>
        {/* Add key to force reset when navigating back to this page */}
        <PageTransition key={pageKey}>
          <div className="space-y-4">
            {DebugPanel}
            <PageHeader />
            <Suspense
              fallback={
                <div className="h-24 w-full animate-pulse bg-muted/20 rounded-lg"></div>
              }
            >
              <SummaryCards />
            </Suspense>
            <Suspense fallback={<TableSkeleton />}>
              <DataTable data={companies} />
            </Suspense>
            <CompanyDialogWrapper />
          </div>
        </PageTransition>
      </CompaniesClientProvider>
    );
  } catch (error) {
    console.error("Error loading companies page:", error);
    return (
      <div className="p-8 space-y-4">
        <div className="bg-destructive/10 border border-destructive p-4 rounded-md">
          <h2 className="text-xl font-semibold mb-2 text-destructive">
            Failed to load companies
          </h2>
          <p className="text-muted-foreground">
            Please try refreshing the page
          </p>
          {process.env.NODE_ENV === "development" && (
            <pre className="mt-4 p-2 bg-background text-xs overflow-auto max-h-60 rounded-md">
              {error instanceof Error
                ? `${error.name}: ${error.message}\n${error.stack}`
                : String(error)}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
