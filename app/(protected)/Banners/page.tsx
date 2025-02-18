"use client";

import React, { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil } from "lucide-react";
import { NotificationMessage } from "./types";
import { CreateNotificationDialog } from "./components/CreateNotificationDialog";
import { EditNotificationDialog } from "./components/EditNotificationDialog";
import { DeleteConfirmationDialog } from "./components/DeleteConfirmationDialog";
import { useToast } from "@/components/ui/use-toast";
import {
  createNotificationAction,
  getActiveNotificationsAction,
  deleteNotificationAction,
  updateNotificationAction,
} from "./actions";

export default function NotificationsPage() {
  const [messages, setMessages] = React.useState<NotificationMessage[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [selectedNotification, setSelectedNotification] =
    useState<NotificationMessage | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const { toast } = useToast();

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const { data: notifications, error } =
        await getActiveNotificationsAction();
      if (error) {
        toast({
          title: "Error",
          description: "Failed to load notifications",
          variant: "destructive",
        });
        return;
      }

      setMessages(
        notifications.map((n) => ({
          id: n.id,
          title: n.title,
          content: n.content,
          type: n.type,
          displayType: n.display_type,
          image: n.image_url,
          translateTo: n.translate_to,
          autoShow: n.auto_show,
          showFrom: n.show_from ? new Date(n.show_from) : undefined,
          showUntil: n.show_until ? new Date(n.show_until) : undefined,
          dismissible: n.dismissible,
          position: n.position as "top" | "bottom" | undefined,
          duration: n.duration,
          active: n.active,
        }))
      );
    } catch (error) {
      console.error("Error loading notifications:", error);
      toast({
        title: "Error",
        description: "Failed to load notifications",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleCreateNotification = async (message: NotificationMessage) => {
    try {
      const { data, error } = await createNotificationAction(message);
      if (error) {
        toast({
          title: "Error",
          description: "Failed to create notification",
          variant: "destructive",
        });
        return;
      }
      await loadNotifications();
      setIsCreateDialogOpen(false);
      toast({
        title: "Success",
        description: "Notification created successfully",
      });
    } catch (error) {
      console.error("Error creating notification:", error);
      toast({
        title: "Error",
        description: "Failed to create notification",
        variant: "destructive",
      });
    }
  };

  const handleEditNotification = async (
    id: string,
    updates: Partial<NotificationMessage>
  ) => {
    try {
      const { data, error } = await updateNotificationAction(id, updates);
      if (error) {
        toast({
          title: "Error",
          description: "Failed to update notification",
          variant: "destructive",
        });
        return;
      }
      await loadNotifications();
      setIsEditDialogOpen(false);
      setSelectedNotification(null);
      toast({
        title: "Success",
        description: "Notification updated successfully",
      });
    } catch (error) {
      console.error("Error updating notification:", error);
      toast({
        title: "Error",
        description: "Failed to update notification",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = (notification: NotificationMessage) => {
    setSelectedNotification(notification);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedNotification) {
      toast({
        title: "Error",
        description: "No notification selected for deletion",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setIsDeleteDialogOpen(false);

    // Optimistically remove the notification from the UI
    const notificationToDelete = selectedNotification;
    setMessages((prevMessages) =>
      prevMessages.filter((msg) => msg.id !== notificationToDelete.id)
    );

    try {
      // Perform deletion in the background
      const { success, error } = await deleteNotificationAction(
        notificationToDelete.id
      );

      if (error) {
        // If deletion fails, revert the UI and show error
        setMessages((prevMessages) => [...prevMessages, notificationToDelete]);
        console.error("Delete action error:", error);
        toast({
          title: "Error",
          description: error,
          variant: "destructive",
        });
      } else if (success) {
        toast({
          title: "Success",
          description: "Notification deleted successfully",
        });
      }
    } catch (error) {
      // If there's an error, revert the UI changes
      setMessages((prevMessages) => [...prevMessages, notificationToDelete]);
      console.error("Error in handleDeleteConfirm:", error);
      toast({
        title: "Error",
        description:
          "An unexpected error occurred while deleting the notification",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setSelectedNotification(null);
    }
  };

  const handleEditClick = (notification: NotificationMessage) => {
    setSelectedNotification(notification);
    setIsEditDialogOpen(true);
  };

  return (
    <div className="py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">
            Manage your application notifications and banners
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Notification
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Notifications</CardTitle>
          <CardDescription>
            List of all notifications (both active and scheduled)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Display As</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Show From</TableHead>
                  <TableHead>Show Until</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.map((message) => (
                  <TableRow key={message.id}>
                    <TableCell>{message.title}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {message.content}
                    </TableCell>
                    <TableCell className="capitalize">{message.type}</TableCell>
                    <TableCell className="capitalize">
                      {message.displayType}
                    </TableCell>
                    <TableCell>
                      {message.autoShow ? "Auto Show" : "Manual"}
                      {message.active
                        ? message.showFrom &&
                          new Date(message.showFrom) > new Date()
                          ? " (Scheduled)"
                          : " (Active)"
                        : " (Inactive)"}
                    </TableCell>
                    <TableCell>
                      {message.showFrom
                        ? new Date(message.showFrom).toLocaleString()
                        : "No start date"}
                    </TableCell>
                    <TableCell>
                      {message.showUntil
                        ? new Date(message.showUntil).toLocaleString()
                        : "No end date"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditClick(message)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteClick(message)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateNotificationDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={handleCreateNotification}
      />

      {selectedNotification && (
        <>
          <EditNotificationDialog
            notification={selectedNotification}
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            onSubmit={handleEditNotification}
          />
          <DeleteConfirmationDialog
            open={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
            onConfirm={handleDeleteConfirm}
            title={selectedNotification.title}
          />
        </>
      )}
    </div>
  );
}
