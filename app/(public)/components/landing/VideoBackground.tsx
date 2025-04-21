"use client";
import React, { useState } from "react";
import Image from "next/image";

const VideoBackground = () => {
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
      {/* Fallback image while video loads */}
      {!isVideoLoaded && (
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900 to-blue-800 animate-pulse" />
      )}

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/40 z-10" />

      {/* Video background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        onLoadedData={() => setIsVideoLoaded(true)}
        className={`absolute w-full h-full object-cover transform scale-105 ${
          isVideoLoaded ? "opacity-100" : "opacity-0"
        } transition-opacity duration-1000`}
      >
        <source src="/videos/trucks-background.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      {/* Grain overlay for texture */}
      <div
        className="absolute inset-0 z-20 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
};

export default VideoBackground;
