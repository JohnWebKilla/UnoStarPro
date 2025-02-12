"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from "react";
import { Ticket } from "../page";

interface AddTicketProps {
  onAddTicket: (ticket: Ticket) => void;
}

export function AddTicket({ onAddTicket }: AddTicketProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleAddTicket = () => {
    // Here you would typically have a form to create a new ticket
    // For now, we'll just create a mock ticket
    const newTicket: Ticket = {
      id: Math.floor(Math.random() * 1000),
      timestamp: new Date(),
      company: "New Company",
      driver: "New Driver",
      services: "New Service",
      dispatcher: "New Dispatcher",
      dispatchNote: "New dispatch note",
      editor: "New Editor",
      editorNote: "New editor note",
      managerNote: "New manager note",
      duration: "0m",
      status: "Created",
    };

    onAddTicket(newTicket);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Add Ticket
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Ticket</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {/* Add your form fields here */}
          <p className="text-sm text-muted-foreground">
            Ticket creation form will go here...
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleAddTicket}>Add Ticket</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
