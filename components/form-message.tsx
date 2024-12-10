import { AlertCircle, CheckCircle, Info } from "lucide-react";

export type Message =
  | { success: string }
  | { error: string }
  | { message: string };

export function FormMessage({ message }: { message: Message }) {
  if (!message) return null;

  let icon, bgColor, textColor, borderColor;

  if ("success" in message) {
    icon = <CheckCircle className="h-5 w-5" />;
    bgColor = "bg-green-100 dark:bg-green-900";
    textColor = "text-green-800 dark:text-green-100";
    borderColor = "border-green-400 dark:border-green-600";
  } else if ("error" in message) {
    icon = <AlertCircle className="h-5 w-5" />;
    bgColor = "bg-red-100 dark:bg-red-900";
    textColor = "text-red-800 dark:text-red-100";
    borderColor = "border-red-400 dark:border-red-600";
  } else {
    icon = <Info className="h-5 w-5" />;
    bgColor = "bg-blue-100 dark:bg-blue-900";
    textColor = "text-blue-800 dark:text-blue-100";
    borderColor = "border-blue-400 dark:border-blue-600";
  }

  const content =
    "success" in message
      ? message.success
      : "error" in message
        ? message.error
        : message.message;

  return (
    <div
      className={`flex items-center p-4 mb-4 text-sm rounded-lg ${bgColor} ${textColor} ${borderColor} border`}
      role="alert"
    >
      <div className="mr-3">{icon}</div>
      <div>{content}</div>
    </div>
  );
}
