"use client";

import { useEffect, useRef } from "react";

interface PDFViewerProps {
  url: string;
  signatures?: {
    [key: string]: {
      url: string;
      position: {
        x: number;
        y: number;
        width: number;
        height: number;
        page: number;
      };
    };
  };
}

export default function PDFViewer({ url, signatures }: PDFViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const signatureLayerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!signatures || !signatureLayerRef.current) return;

    // Clear existing signatures
    signatureLayerRef.current.innerHTML = "";

    // Add signatures
    Object.entries(signatures).forEach(([fieldId, sigData]) => {
      const sigDiv = document.createElement("div");
      sigDiv.style.position = "absolute";
      sigDiv.style.left = `${sigData.position.x}%`;
      sigDiv.style.top = `${sigData.position.y}%`;
      sigDiv.style.width = `${sigData.position.width}%`;
      sigDiv.style.height = `${sigData.position.height}%`;
      sigDiv.style.transform = "translate(-50%, -50%)";
      sigDiv.style.zIndex = "50";

      const sigImg = document.createElement("img");
      sigImg.src = sigData.url;
      sigImg.style.width = "100%";
      sigImg.style.height = "100%";
      sigImg.style.objectFit = "contain";

      sigDiv.appendChild(sigImg);
      signatureLayerRef.current?.appendChild(sigDiv);
    });
  }, [signatures]);

  const viewerUrl = `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(url)}&toolbar=0&zoom=140`;

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <iframe
        src={viewerUrl}
        className="w-full h-full border-none"
        sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-downloads"
      />
      <div
        ref={signatureLayerRef}
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
      />
    </div>
  );
}
