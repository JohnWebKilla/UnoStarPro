"use server";

import { createClient } from "@/utils/supabase/server";
import { NotificationMessage, Translation, LanguageCode } from "../types";

export interface NotificationRecord {
  id: string;
  title: string;
  content: string;
  type: "info" | "warning" | "success" | "error";
  display_type: "banner" | "dialog";
  image_url?: string;
  translate_to?: LanguageCode[];
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
  default_language?: LanguageCode;
  version: number;
}

export interface TranslationRecord {
  id: string;
  notification_id: string;
  language: LanguageCode;
  title: string;
  content: string;
  is_auto_translated: boolean;
  version: number;
  created_at?: string;
  updated_at?: string;
}

async function createTranslations(
  supabase: any,
  notificationId: string,
  translations: Translation[],
  version: number,
  isAutoTranslated: boolean = false
): Promise<TranslationRecord[]> {
  const { data, error } = await supabase
    .from("notification_translations")
    .insert(
      translations.map((t) => ({
        notification_id: notificationId,
        language: t.language,
        title: t.title,
        content: t.content,
        is_auto_translated: isAutoTranslated,
        version: version,
      }))
    )
    .select();

  if (error) {
    console.error("Error creating translations:", error);
    throw error;
  }

  return data;
}

async function getTranslations(
  supabase: any,
  notificationId: string,
  version?: number
): Promise<TranslationRecord[]> {
  let query = supabase
    .from("notification_translations")
    .select("*")
    .eq("notification_id", notificationId);

  if (version !== undefined) {
    query = query.eq("version", version);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching translations:", error);
    return [];
  }

  return data || [];
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

    // Create notification
    const { data: notificationData, error: notificationError } = await supabase
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
        default_language: notification.defaultLanguage || "en",
        version: 1, // Initial version
      })
      .select()
      .single();

    if (notificationError) {
      console.error("Error creating notification:", notificationError);
      return null;
    }

    // Create translations if provided
    if (notification.translations && notification.translations.length > 0) {
      // Split translations into manual and auto-translated
      const manualTranslations = notification.translations.filter(
        (t) => !t.isAutoTranslated
      );
      const autoTranslations = notification.translations.filter(
        (t) => t.isAutoTranslated
      );

      // Create manual translations
      if (manualTranslations.length > 0) {
        await createTranslations(
          supabase,
          notificationData.id,
          manualTranslations,
          1,
          false
        );
      }

      // Create auto-translated translations
      if (autoTranslations.length > 0) {
        await createTranslations(
          supabase,
          notificationData.id,
          autoTranslations,
          1,
          true
        );
      }
    }

    return notificationData;
  } catch (error) {
    console.error("Error creating notification:", error);
    return null;
  }
}

export async function updateNotification(
  id: string,
  updates: Partial<NotificationMessage>
): Promise<NotificationRecord | null> {
  try {
    const supabase = await createClient();

    // Get current version
    const { data: currentNotification, error: fetchError } = await supabase
      .from("notifications")
      .select("version")
      .eq("id", id)
      .single();

    if (fetchError) {
      console.error("Error fetching current notification:", fetchError);
      return null;
    }

    const newVersion = (currentNotification?.version || 0) + 1;

    // Update notification with new version
    const { data: notificationData, error: notificationError } = await supabase
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
        default_language: updates.defaultLanguage,
        version: newVersion,
      })
      .eq("id", id)
      .select()
      .single();

    if (notificationError) {
      console.error("Error updating notification:", notificationError);
      return null;
    }

    // Update translations if provided
    if (updates.translations && updates.translations.length > 0) {
      // Split translations into manual and auto-translated
      const manualTranslations = updates.translations.filter(
        (t) => !t.isAutoTranslated
      );
      const autoTranslations = updates.translations.filter(
        (t) => t.isAutoTranslated
      );

      // Create manual translations with new version
      if (manualTranslations.length > 0) {
        await createTranslations(
          supabase,
          id,
          manualTranslations,
          newVersion,
          false
        );
      }

      // Create auto-translated translations with new version
      if (autoTranslations.length > 0) {
        await createTranslations(
          supabase,
          id,
          autoTranslations,
          newVersion,
          true
        );
      }
    }

    return notificationData;
  } catch (error) {
    console.error("Error updating notification:", error);
    return null;
  }
}

export async function getActiveNotifications(
  version?: number
): Promise<(NotificationRecord & { translations?: TranslationRecord[] })[]> {
  try {
    const supabase = await createClient();
    const now = new Date().toISOString();

    let query = supabase
      .from("notifications")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (version !== undefined) {
      query = query.eq("version", version);
    }

    const { data: notifications, error: notificationsError } = await query;

    if (notificationsError) {
      console.error("Error fetching notifications:", notificationsError);
      return [];
    }

    // Get translations for all notifications
    const notificationsWithTranslations = await Promise.all(
      notifications.map(async (notification) => {
        const translations = await getTranslations(
          supabase,
          notification.id,
          notification.version
        );
        return {
          ...notification,
          translations,
        };
      })
    );

    return notificationsWithTranslations;
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return [];
  }
}

export async function deleteNotification(id: string): Promise<boolean> {
  try {
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

    // Check if user has permission to delete
    if (!isAdmin && existingData.created_by !== user?.id) {
      console.error(
        "Permission denied: User is not admin or creator of the notification"
      );
      return false;
    }

    // Delete translations first
    const { error: translationsError } = await supabase
      .from("notification_translations")
      .delete()
      .eq("notification_id", id);

    if (translationsError) {
      console.error("Error deleting translations:", translationsError);
      return false;
    }

    // Delete notification
    const { error: deleteError } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id)
      .eq("active", true);

    if (deleteError) {
      console.error("Error during deletion:", {
        message: deleteError.message,
        details: deleteError.details,
        code: deleteError.code,
        hint: deleteError.hint,
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error deleting notification:", error);
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
