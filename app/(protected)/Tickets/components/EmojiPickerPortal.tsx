"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { EmojiList } from "./EmojiList";

interface EmojiPickerPortalProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  buttonRef: React.RefObject<HTMLButtonElement>;
}

export function EmojiPickerPortal({
  onSelect,
  onClose,
  buttonRef,
}: EmojiPickerPortalProps) {
  const portalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create portal container
    const portal = document.createElement("div");
    portal.style.position = "absolute";
    portal.style.zIndex = "9999";
    document.body.appendChild(portal);
    portalRef.current = portal;

    // Position the portal relative to the button
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      portal.style.bottom = `${window.innerHeight - rect.top + 10}px`;
      portal.style.right = `${window.innerWidth - rect.right}px`;
    }

    // Cleanup
    return () => {
      document.body.removeChild(portal);
    };
  }, [buttonRef]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        portalRef.current &&
        !portalRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose, buttonRef]);

  if (!portalRef.current) return null;

  return createPortal(
    <div onClick={(e) => e.stopPropagation()}>
      <EmojiList onSelect={onSelect} />
    </div>,
    portalRef.current
  );
}
