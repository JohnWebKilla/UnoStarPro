"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface FadeInProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  duration?: number;
  delay?: number;
  direction?: "up" | "down" | "left" | "right";
}

export function FadeIn({
  children,
  duration = 0.5,
  delay = 0,
  direction,
  className,
  ...props
}: FadeInProps) {
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    setIsVisible(true);
  }, []);

  const getTransform = () => {
    switch (direction) {
      case "up":
        return "translateY(20px)";
      case "down":
        return "translateY(-20px)";
      case "left":
        return "translateX(20px)";
      case "right":
        return "translateX(-20px)";
      default:
        return "none";
    }
  };

  const style = {
    opacity: 0,
    transform: getTransform(),
    transition: `opacity ${duration}s ease-out, transform ${duration}s ease-out`,
    transitionDelay: `${delay}s`,
    ...(isVisible && {
      opacity: 1,
      transform: "none",
    }),
  };

  return (
    <div className={cn(className)} style={style} {...props}>
      {children}
    </div>
  );
}

interface SlideInProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  duration?: number;
  delay?: number;
  direction: "up" | "down" | "left" | "right";
}

export function SlideIn({
  children,
  duration = 0.5,
  delay = 0,
  direction,
  className,
  ...props
}: SlideInProps) {
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    setIsVisible(true);
  }, []);

  const getInitialTransform = () => {
    switch (direction) {
      case "up":
        return "translateY(100%)";
      case "down":
        return "translateY(-100%)";
      case "left":
        return "translateX(100%)";
      case "right":
        return "translateX(-100%)";
      default:
        return "none";
    }
  };

  const style = {
    transform: getInitialTransform(),
    transition: `transform ${duration}s ease-out`,
    transitionDelay: `${delay}s`,
    ...(isVisible && {
      transform: "none",
    }),
  };

  return (
    <div className={cn(className)} style={style} {...props}>
      {children}
    </div>
  );
}

interface AnimatePresenceProps {
  children: React.ReactNode;
  show: boolean;
  duration?: number;
}

export function AnimatePresence({
  children,
  show,
  duration = 0.3,
}: AnimatePresenceProps) {
  const [shouldRender, setShouldRender] = React.useState(show);

  React.useEffect(() => {
    if (show) setShouldRender(true);
    else {
      const timer = setTimeout(() => setShouldRender(false), duration * 1000);
      return () => clearTimeout(timer);
    }
  }, [show, duration]);

  if (!shouldRender) return null;

  return (
    <div
      style={{
        opacity: show ? 1 : 0,
        transition: `opacity ${duration}s ease-out`,
      }}
    >
      {children}
    </div>
  );
}
