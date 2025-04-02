import { ReactNode } from "react";

interface UsersLayoutProps {
  header: ReactNode;
  filters: ReactNode;
  content: ReactNode;
}

export function UsersLayout({ header, filters, content }: UsersLayoutProps) {
  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-6">
        {header}
        {filters}
      </div>
      <div className="rounded-lg border bg-card">{content}</div>
    </div>
  );
}
