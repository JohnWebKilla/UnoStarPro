"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { NotificationMessage, NotificationSettings } from "../types";
import { NotificationDialog } from "./NotificationDialog";
import { useToast } from "@/components/ui/use-toast";
import {
  createNotificationAction,
  getActiveNotificationsAction,
  deleteNotificationAction,
} from "../actions";
import { createClient } from "@/utils/supabase/client";
import { NotificationRecord } from "../services/notifications";
import {
  RealtimePostgresChangesPayload,
  RealtimeChannel,
} from "@supabase/supabase-js";
import { useSidebar } from "@/contexts/SidebarContext";
import { cn } from "@/lib/utils";

interface NotificationContextType {
  showNotification: (message: NotificationMessage) => void;
  hideNotification: (id: string) => void;
  updateSettings: (settings: NotificationSettings) => void;
  settings: NotificationSettings;
  activeNotifications: NotificationMessage[];
  dismissedNotifications: string[];
  setDismissedNotifications: React.Dispatch<React.SetStateAction<string[]>>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

const ROTATION_INTERVAL = 5000; // 5 seconds per banner

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider"
    );
  }
  return context;
};

interface NotificationProviderProps {
  children: React.ReactNode;
  initialSettings?: Partial<NotificationSettings>;
}

export const NotificationProvider = ({
  children,
  initialSettings,
}: NotificationProviderProps) => {
  const [activeNotifications, setActiveNotifications] = useState<
    NotificationMessage[]
  >([]);
  const [dismissedNotifications, setDismissedNotifications] = useState<
    string[]
  >([]);
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: true,
    defaultPosition: "top",
    defaultDuration: 5000,
    defaultDismissible: true,
    autoTranslate: true,
    supportedLanguages: ["en", "uz", "ru"],
    defaultLanguage:
      initialSettings?.defaultLanguage &&
      ["en", "uz", "ru"].includes(initialSettings.defaultLanguage)
        ? initialSettings.defaultLanguage
        : "en",
  });
  const { toast } = useToast();

  const transformNotification = (
    n: NotificationRecord
  ): NotificationMessage => ({
    id: n.id,
    title: n.title,
    content: n.content,
    type: n.type,
    displayType: n.display_type,
    image: n.display_type === "dialog" ? n.image_url : undefined,
    translateTo: n.translate_to,
    autoShow: n.auto_show,
    showFrom: n.show_from ? new Date(n.show_from) : undefined,
    showUntil: n.show_until ? new Date(n.show_until) : undefined,
    dismissible: n.dismissible ?? true,
    position: n.position as "top" | "bottom" | undefined,
    duration: n.duration,
    active: n.active,
  });

  const loadActiveNotifications = async () => {
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

      setActiveNotifications(notifications.map(transformNotification));
    } catch (error) {
      console.error("Error loading notifications:", error);
      toast({
        title: "Error",
        description: "Failed to load notifications",
        variant: "destructive",
      });
    }
  };

  // Set up real-time subscription
  useEffect(() => {
    let subscription: RealtimeChannel;

    const setupSubscription = async () => {
      const supabaseClient = createClient();

      subscription = supabaseClient
        .channel("notifications-channel")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
          },
          async (
            payload: RealtimePostgresChangesPayload<NotificationRecord>
          ) => {
            console.log("Real-time notification update:", payload);

            // Handle different types of changes
            if (payload.eventType === "INSERT") {
              const newNotification = payload.new;
              setActiveNotifications((prev) => [
                transformNotification(newNotification),
                ...prev,
              ]);
            } else if (payload.eventType === "DELETE") {
              setActiveNotifications((prev) =>
                prev.filter((n) => n.id !== payload.old.id)
              );
            } else if (payload.eventType === "UPDATE") {
              const updatedNotification = payload.new;
              setActiveNotifications((prev) =>
                prev.map((n) =>
                  n.id === updatedNotification.id
                    ? transformNotification(updatedNotification)
                    : n
                )
              );
            }
          }
        )
        .subscribe();
    };

    setupSubscription();

    // Initial load
    loadActiveNotifications();

    return () => {
      // Cleanup subscription on unmount
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [dismissedNotifications]); // Add dismissedNotifications as dependency

  const showNotification = async (message: NotificationMessage) => {
    if (!settings.enabled) return;

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
      await loadActiveNotifications();
    } catch (error) {
      console.error("Error creating notification:", error);
      toast({
        title: "Error",
        description: "Failed to create notification",
        variant: "destructive",
      });
    }
  };

  const hideNotification = async (id: string) => {
    try {
      // Only update local state
      setDismissedNotifications((prev) => [...prev, id]);

      // No need to modify activeNotifications since the filter in the render
      // will handle hiding it based on dismissedNotifications
    } catch (error) {
      console.error("Error hiding notification:", error);
    }
  };

  const updateSettings = (newSettings: NotificationSettings) => {
    setSettings(newSettings);
  };

  return (
    <NotificationContext.Provider
      value={{
        showNotification,
        hideNotification,
        updateSettings,
        settings,
        activeNotifications,
        dismissedNotifications,
        setDismissedNotifications,
      }}
    >
      <div className="h-screen flex flex-col overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 overflow-hidden">{children}</div>

        {/* Dialogs */}
        {settings.enabled &&
          activeNotifications
            .filter(
              (notification) =>
                notification.displayType === "dialog" &&
                notification.active &&
                (!notification.showFrom ||
                  new Date(notification.showFrom) <= new Date()) &&
                (!notification.showUntil ||
                  new Date(notification.showUntil) >= new Date()) &&
                !dismissedNotifications.includes(notification.id)
            )
            .map((notification) => (
              <NotificationDialog
                key={notification.id}
                message={notification}
                onDismiss={hideNotification}
              />
            ))}
      </div>
    </NotificationContext.Provider>
  );
};
