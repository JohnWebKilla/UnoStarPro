"use client";

export function LoadingOverlay() {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <img src="/Pulsing Star.gif" alt="Loading" className="h-96 w-96" />
      </div>
    </div>
  );
}
