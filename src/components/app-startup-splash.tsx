"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import loadingAnimation from "@/app/animations/loadinganimation.gif";

const SPLASH_DURATION_MS = 2200;
const EXIT_DURATION_MS = 350;
const SPLASH_SEEN_KEY = "coresearch:splash:seen";

export function AppStartupSplash() {
  usePathname();
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const hasInitializedRef = useRef(false);
  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const alreadySeen = sessionStorage.getItem(SPLASH_SEEN_KEY) === "1";
    if (alreadySeen) return;
    sessionStorage.setItem(SPLASH_SEEN_KEY, "1");

    if (showTimerRef.current) window.clearTimeout(showTimerRef.current);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);

    // Schedule state transitions asynchronously to avoid sync setState inside the effect body.
    showTimerRef.current = window.setTimeout(() => {
      setVisible(true);
      setExiting(false);
      hideTimerRef.current = window.setTimeout(() => {
        setExiting(true);
        exitTimerRef.current = window.setTimeout(() => setVisible(false), EXIT_DURATION_MS);
      }, SPLASH_DURATION_MS);
    }, 0);

    return () => {
      if (showTimerRef.current) window.clearTimeout(showTimerRef.current);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-white/95 backdrop-blur-sm transition-opacity duration-300 ${
        exiting ? "opacity-0" : "opacity-100"
      }`}
      aria-live="polite"
      aria-label="Loading application"
    >
      <div
        className={`mx-4 flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border bg-white p-6 shadow-xl transition-all duration-300 ${
          exiting ? "scale-95 opacity-0" : "scale-100 opacity-100"
        }`}
      >
        <Image
          src={loadingAnimation}
          alt="Loading animation"
          priority
          unoptimized
          className="h-40 w-40 object-contain"
        />
        <p className="text-sm font-medium text-gray-600">Loading CoResearch...</p>
      </div>
    </div>
  );
}
