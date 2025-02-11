"use client";

export function LoadingOverlay() {
  return (
    <div className="fixed inset-0 bg-background/60 backdrop-blur-md z-50 flex items-center justify-center">
      <img src="/RoboLoad.gif" alt="Loading" className="h-48 w-48" />
    </div>
  );
}
