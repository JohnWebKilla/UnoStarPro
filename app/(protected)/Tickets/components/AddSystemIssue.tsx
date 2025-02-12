"use client";

import { AlertTriangle, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, useRef } from "react";

interface SystemIssue {
  company: string;
  driver: string;
  systemType: "android" | "ios" | "web";
  description: string;
  files: File[];
}

interface AddSystemIssueProps {
  onAddIssue: (issue: SystemIssue) => void;
  companies: { id: string; name: string }[];
  drivers: { id: string; name: string; companyId: string }[];
}

export function AddSystemIssue({
  onAddIssue,
  companies,
  drivers,
}: AddSystemIssueProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedDriver, setSelectedDriver] = useState("");
  const [systemType, setSystemType] = useState<"android" | "ios" | "web">(
    "android"
  );
  const [description, setDescription] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredDrivers = drivers.filter(
    (driver) => !selectedCompany || driver.companyId === selectedCompany
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...filesArray]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (selectedCompany && selectedDriver && systemType && description.trim()) {
      onAddIssue({
        company: selectedCompany,
        driver: selectedDriver,
        systemType,
        description: description.trim(),
        files: selectedFiles,
      });

      // Reset form
      setSelectedCompany("");
      setSelectedDriver("");
      setSystemType("android");
      setDescription("");
      setSelectedFiles([]);
      setIsOpen(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <AlertTriangle className="mr-2 h-4 w-4" />
          System Issue
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Report System Issue</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Company Selection */}
          <div className="grid gap-2">
            <Label htmlFor="company">Company</Label>
            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
              <SelectTrigger id="company">
                <SelectValue placeholder="Select company" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Driver Selection */}
          <div className="grid gap-2">
            <Label htmlFor="driver">Driver</Label>
            <Select
              value={selectedDriver}
              onValueChange={setSelectedDriver}
              disabled={!selectedCompany}
            >
              <SelectTrigger id="driver">
                <SelectValue
                  placeholder={
                    selectedCompany ? "Select driver" : "Select company first"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {filteredDrivers.map((driver) => (
                  <SelectItem key={driver.id} value={driver.id}>
                    {driver.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* System Type Selection */}
          <div className="grid gap-2">
            <Label htmlFor="systemType">System Type</Label>
            <Select
              value={systemType}
              onValueChange={(value: "android" | "ios" | "web") =>
                setSystemType(value)
              }
            >
              <SelectTrigger id="systemType">
                <SelectValue placeholder="Select system type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="android">Android</SelectItem>
                <SelectItem value="ios">iOS</SelectItem>
                <SelectItem value="web">Web</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="description">Issue Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue you're experiencing..."
              className="min-h-[100px]"
            />
          </div>

          {/* File Upload */}
          <div className="grid gap-2">
            <Label>Attachments</Label>
            <div className="space-y-2">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                multiple
                onChange={handleFileSelect}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Files
              </Button>

              {/* Selected Files List */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-muted p-2 rounded-md"
                    >
                      <span className="text-sm truncate">{file.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !selectedCompany || !selectedDriver || !description.trim()
            }
          >
            Submit Issue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
