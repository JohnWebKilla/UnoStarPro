"use server";

import {
  createNotification,
  getActiveNotifications,
  updateNotification,
  deleteNotification,
  deactivateNotification,
} from "./services/notifications";
import { NotificationMessage } from "./types";
import { revalidatePath } from "next/cache";

export async function createNotificationAction(
  notification: Omit<NotificationMessage, "id">
) {
  try {
    const result = await createNotification(notification);
    revalidatePath("/Banners");
    return { data: result, error: null };
  } catch (error) {
    console.error("Error creating notification:", error);
    return { data: null, error: "Failed to create notification" };
  }
}

export async function getActiveNotificationsAction() {
  try {
    const notifications = await getActiveNotifications();
    return { data: notifications, error: null };
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return { data: [], error: "Failed to fetch notifications" };
  }
}

export async function updateNotificationAction(
  id: string,
  updates: Partial<NotificationMessage>
) {
  try {
    const result = await updateNotification(id, updates);
    revalidatePath("/Banners");
    return { data: result, error: null };
  } catch (error) {
    console.error("Error updating notification:", error);
    return { data: null, error: "Failed to update notification" };
  }
}

export async function deleteNotificationAction(id: string) {
  try {
    if (!id) {
      return {
        success: false,
        error: "No notification ID provided",
      };
    }

    const result = await deleteNotification(id);

    if (!result) {
      return {
        success: false,
        error:
          "Failed to delete notification. The notification may not exist or you may not have permission to delete it.",
      };
    }

    // Revalidate both paths to ensure proper cache invalidation
    revalidatePath("/Banners");
    revalidatePath("/banners");
    return { success: true, error: null };
  } catch (error) {
    console.error("Error in deleteNotificationAction:", error);
    return {
      success: false,
      error: "An unexpected error occurred while deleting the notification",
    };
  }
}

export async function deactivateNotificationAction(id: string) {
  try {
    const success = await deactivateNotification(id);
    revalidatePath("/Banners");
    return { success, error: null };
  } catch (error) {
    console.error("Error deactivating notification:", error);
    return { success: false, error: "Failed to deactivate notification" };
  }
}
