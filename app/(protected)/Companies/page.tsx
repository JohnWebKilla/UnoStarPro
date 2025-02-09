"use client";
import React from "react";
import { DataTable } from "./components/data-table";
import { columns } from "./components/columns";
import { CompaniesSearch } from "./components/SearchBar";

// Sample data for demonstration
const data: any[] = [
  // ... sample company data ...
];

function Companies() {
  return (
    <>
      <div className="w-full px-4 mt-4">
        <CompaniesSearch />
      </div>
      <div className="w-full px-4 mt-4">
        <DataTable columns={columns} data={data} />
      </div>
    </>
  );
}

export default Companies;
