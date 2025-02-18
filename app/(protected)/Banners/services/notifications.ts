"use server";

import { createClient } from "@/utils/supabase/server";
import { NotificationMessage } from "../types";

export interface NotificationRecord {
  id: string;
  title: string;
  content: string;
  type: "info" | "warning" | "success" | "error";
  display_type: "banner" | "dialog";
  image_url?: string;
  translate_to?: string[];
  auto_show?: boolean;
  show_from?: string;
  show_until?: string;
  dismissible?: boolean;
  position?: "top" | "bottom";
  duration?: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  active?: boolean;
}

export async function createNotification(
  notification: Omit<NotificationMessage, "id">
): Promise<NotificationRecord | null> {
  try {
    const supabase = await createClient();

    // Get current user's ID
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("Error getting user:", userError);
      return null;
    }

    const { data, error } = await supabase
      .from("notifications")
      .insert({
        title: notification.title,
        content: notification.content,
        type: notification.type,
        display_type: notification.displayType,
        image_url: notification.image,
        translate_to: notification.translateTo,
        auto_show: notification.autoShow,
        show_from: notification.showFrom?.toISOString(),
        show_until: notification.showUntil?.toISOString(),
        dismissible: notification.dismissible,
        position: notification.position,
        duration: notification.duration,
        active: true,
        created_by: user?.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating notification:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error creating notification:", error);
    return null;
  }
}

export async function getActiveNotifications(): Promise<NotificationRecord[]> {
  try {
    const supabase = await createClient();
    const now = new Date().toISOString();

    console.log("Fetching notifications with current time:", now);

    // Get all notifications
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching notifications:", error);
      return [];
    }

    console.log("All active notifications:", data);

    return data || [];
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return [];
  }
}

export async function updateNotification(
  id: string,
  updates: Partial<NotificationMessage>
): Promise<NotificationRecord | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("notifications")
      .update({
        title: updates.title,
        content: updates.content,
        type: updates.type,
        display_type: updates.displayType,
        image_url: updates.image,
        translate_to: updates.translateTo,
        auto_show: updates.autoShow,
        show_from: updates.showFrom?.toISOString(),
        show_until: updates.showUntil?.toISOString(),
        dismissible: updates.dismissible,
        position: updates.position,
        duration: updates.duration,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating notification:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error updating notification:", error);
    return null;
  }
}

export async function deleteNotification(id: string): Promise<boolean> {
  try {
    console.log("Starting deletion process for notification ID:", id);
    const supabase = await createClient();

    // Get current user's ID and role
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError) {
      console.error("Error getting user:", userError);
      return false;
    }

    // Get user's role from public.users table
    const { data: userData, error: roleError } = await supabase
      .from("users")
      .select("role")
      .eq("id", user?.id)
      .single();

    if (roleError) {
      console.error("Error getting user role:", roleError);
      return false;
    }

    const isAdmin = userData?.role === "admin";
    console.log("User role check:", {
      userId: user?.id,
      role: userData?.role,
      isAdmin,
    });

    // First check if the notification exists and get its current state
    const { data: existingData, error: checkError } = await supabase
      .from("notifications")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (checkError) {
      console.error("Error checking notification:", checkError);
      return false;
    }

    if (!existingData) {
      console.log("Notification not found:", id);
      return false;
    }

    console.log("Found notification to delete:", existingData);

    // Check if user has permission to delete
    if (!isAdmin && existingData.created_by !== user?.id) {
      console.error(
        "Permission denied: User is not admin or creator of the notification"
      );
      return false;
    }

    // Attempt to delete with detailed response
    const {
      data: deleteData,
      error: deleteError,
      status,
      statusText,
    } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id)
      .eq("active", true);

    console.log("Delete operation response:", {
      status,
      statusText,
      data: deleteData,
    });

    if (deleteError) {
      console.error("Error during deletion:", {
        message: deleteError.message,
        details: deleteError.details,
        code: deleteError.code,
        hint: deleteError.hint,
        status: status,
      });
      return false;
    }

    // Final verification
    const { data: verifyData, error: verifyError } = await supabase
      .from("notifications")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (verifyError) {
      console.error("Error verifying deletion:", verifyError);
      return false;
    }

    const wasDeleted = !verifyData;
    console.log(
      wasDeleted
        ? "Successfully deleted notification"
        : "Deletion failed - notification still exists. This might be a permissions issue."
    );

    return wasDeleted;
  } catch (error) {
    console.error("Unexpected error in deleteNotification:", error);
    return false;
  }
}

export async function deactivateNotification(id: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ active: false })
      .eq("id", id);

    if (error) {
      console.error("Error deactivating notification:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error deactivating notification:", error);
    return false;
  }
}
