import { LoadingBar } from "@/components/ui/loading-bar";

interface TemplateProps {
  children: React.ReactNode;
}

export function Template({ children }: TemplateProps) {
  return (
    <>
      <LoadingBar />
      {children}
    </>
  );
}
