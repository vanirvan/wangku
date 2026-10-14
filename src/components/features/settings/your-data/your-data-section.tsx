"use client";

import { Download, FileSpreadsheet, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";

export function YourDataSection() {
  // dummy handlers; wire to CSV parser and stream generator when transactions feature ships
  const handleImport = () => {
    alert("Import CSV coming soon.");
  };

  const handleExport = () => {
    alert("Export CSV coming soon.");
  };

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="font-semibold text-lg">Your Data</h2>
        <p className="text-muted-foreground text-sm">
          Import and export your transaction records.
        </p>
      </div>

      <div className="mt-2 divide-y border-border/40">
        {/* Import CSV */}
        <div className="flex flex-col justify-between gap-4 py-3 sm:flex-row sm:items-center">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="size-4 text-muted-foreground" />
              <p className="font-medium text-sm">Import Transactions</p>
            </div>
            <p className="text-muted-foreground text-xs">
              Upload a CSV file containing your bank or wallet statements.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleImport}>
            <Upload className="size-3.5" />
            <span>Import CSV</span>
          </Button>
        </div>

        {/* Export CSV */}
        <div className="flex flex-col justify-between gap-4 py-3 sm:flex-row sm:items-center">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="size-4 text-muted-foreground" />
              <p className="font-medium text-sm">Export Transactions</p>
            </div>
            <p className="text-muted-foreground text-xs">
              Download your complete transaction history as a CSV file.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="size-3.5" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>
    </section>
  );
}
