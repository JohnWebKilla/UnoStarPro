"use client";

export function LoadingOverlay() {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <img src="/Pulsing Star.gif" alt="Loading" className="h-64 w-64" />
        <h3 className="font-medium text-muted-foreground">Loading...</h3>
      </div>
    </div>
  );
}
