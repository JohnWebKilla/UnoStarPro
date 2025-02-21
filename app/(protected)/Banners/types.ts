import { StaticImageData } from "next/image";

export type BannerType = "info" | "warning" | "success" | "error";
export type DisplayType = "banner" | "dialog";
export type LanguageCode = "en" | "uz" | "ru";

export interface Translation {
  id?: string;
  notificationId?: string;
  title: string;
  content: string;
  language: LanguageCode;
  isAutoTranslated?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface NotificationMessage {
  id: string;
  title: string;
  content: string;
  type: BannerType;
  displayType: DisplayType;
  image?: string | StaticImageData;
  translations?: Translation[];
  translateTo?: LanguageCode[];
  autoShow?: boolean;
  showFrom?: Date;
  showUntil?: Date;
  dismissible?: boolean;
  position?: "top" | "bottom";
  duration?: number; // in milliseconds, for auto-dismiss
  active?: boolean;
  defaultLanguage?: LanguageCode;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
}

export interface NotificationSettings {
  enabled: boolean;
  defaultPosition: "top" | "bottom";
  defaultDuration: number;
  defaultDismissible: boolean;
  autoTranslate: boolean;
  supportedLanguages: LanguageCode[];
  defaultLanguage: LanguageCode;
}
