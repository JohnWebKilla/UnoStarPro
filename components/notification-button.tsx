import React from "react";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/app/(protected)/Banners/components/NotificationProvider";
import { Badge } from "@/components/ui/badge";
import { NotificationMessage } from "@/app/(protected)/Banners/types";

export const NotificationButton = () => {
  const { settings, activeNotifications } = useNotifications();
  const router = useRouter();

  const activeBannerCount =
    activeNotifications?.filter(
      (notification: NotificationMessage) =>
        notification.displayType === "banner" &&
        notification.active &&
        (!notification.showFrom ||
          new Date(notification.showFrom) <= new Date()) &&
        (!notification.showUntil ||
          new Date(notification.showUntil) >= new Date())
    ).length || 0;

  return (
    <div
      className="cursor-pointer relative"
      onClick={() => router.push("/Banners")}
    >
      <Bell className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
      {activeBannerCount > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-2 -right-2 h-4 min-w-4 px-1 flex items-center justify-center text-[10px] font-medium"
        >
          {activeBannerCount}
        </Badge>
      )}
    </div>
  );
};
