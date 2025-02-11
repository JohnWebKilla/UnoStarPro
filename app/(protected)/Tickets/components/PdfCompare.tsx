"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Maximize2, FileText } from "lucide-react";

interface PdfCompareProps {
  beforePdf?: string;
  afterPdf?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function PdfCompare({
  beforePdf,
  afterPdf,
  isOpen,
  onClose,
}: PdfCompareProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl w-full h-[90vh]">
        <div className="flex h-full gap-4">
          {/* Before PDF */}
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Before Edit</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
                <Button variant="outline" size="sm">
                  <Maximize2 className="h-4 w-4 mr-1" />
                  Open
                </Button>
              </div>
            </div>
            <div className="flex-1 border rounded-lg overflow-hidden">
              <iframe
                src={beforePdf}
                className="w-full h-full"
                title="Before PDF"
              />
            </div>
          </div>

          {/* After PDF */}
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">After Edit</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
                <Button variant="outline" size="sm">
                  <Maximize2 className="h-4 w-4 mr-1" />
                  Open
                </Button>
              </div>
            </div>
            <div className="flex-1 border rounded-lg overflow-hidden">
              <iframe
                src={afterPdf}
                className="w-full h-full"
                title="After PDF"
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
