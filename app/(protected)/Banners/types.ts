import { StaticImageData } from "next/image";

export type BannerType = "info" | "warning" | "success" | "error";
export type DisplayType = "banner" | "dialog";

export interface NotificationMessage {
  id: string;
  title: string;
  content: string;
  type: BannerType;
  displayType: DisplayType;
  image?: string | StaticImageData;
  translateTo?: string[];
  autoShow?: boolean;
  showFrom?: Date;
  showUntil?: Date;
  dismissible?: boolean;
  position?: "top" | "bottom";
  duration?: number; // in milliseconds, for auto-dismiss
  active?: boolean;
}

export interface NotificationSettings {
  enabled: boolean;
  defaultPosition: "top" | "bottom";
  defaultDuration: number;
  defaultDismissible: boolean;
  autoTranslate: boolean;
  supportedLanguages: string[];
}
