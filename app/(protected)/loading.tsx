"use client";

export default function Loading() {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <img src="/RoboLoad.gif" alt="Loading" className="h-64 w-64" />
      </div>
    </div>
  );
}
