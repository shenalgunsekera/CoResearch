"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

const TOUR_STORAGE_KEY = "coresearch:onboarding:v2";
const START_EVENT = "coresearch:tour:start";

type TourStep = {
  id: string;
  route: string;
  selector: string;
  title: string;
  body: string;
  activateSelector?: string;
};

type RectState = {
  top: number;
  left: number;
  width: number;
  height: number;
};

function isVisible(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false;
  }
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function ProductTour() {
  const { user, isAdmin, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<RectState | null>(null);
  const [targetFound, setTargetFound] = useState(false);
  const [navInFlight, setNavInFlight] = useState(false);

  const hasAutoStartedRef = useRef(false);
  const currentTargetRef = useRef<HTMLElement | null>(null);
  const shouldRouteSyncRef = useRef(false);
  const navInFlightRef = useRef(false);

  const steps = useMemo<TourStep[]>(() => {
    const baseSteps: TourStep[] = [
      {
        id: "dashboard-guide",
        route: "/dashboard",
        selector: '[data-tour-id="dashboard-guide"]',
        title: "Your control point",
        body: "Re-open this tour anytime from here.",
      },
      {
        id: "dashboard-new-paper",
        route: "/dashboard",
        selector: '[data-tour-id="dashboard-new-paper"]',
        title: "Create a new paper",
        body: "Start a paper here. This opens the full editor workspace.",
      },
      {
        id: "document-publish",
        route: "/document/new",
        selector: '[data-tour-id="document-publish"]',
        title: "Publish flow",
        body: "Publish public/private with cover image, abstract, and keywords.",
      },
      {
        id: "document-invite",
        route: "/document/new",
        selector: '[data-tour-id="document-invite"]',
        title: "Invite collaborators",
        body: "Invite teammates by email and assign editor/viewer roles.",
      },
      {
        id: "document-save-version",
        route: "/document/new",
        selector: '[data-tour-id="document-save-version"]',
        title: "Versioning",
        body: "Save a version snapshot and restore versions when needed.",
      },
      {
        id: "document-comments",
        route: "/document/new",
        selector: '[data-tour-id="document-comments"]',
        title: "Paper comments",
        body: "Open threaded paper comments for collaboration feedback.",
      },
      {
        id: "document-export",
        route: "/document/new",
        selector: '[data-tour-id="document-export"]',
        title: "Export output",
        body: "Export your current paper as a PDF.",
      },
      {
        id: "dashboard-discover",
        route: "/dashboard",
        selector: '[data-tour-id="dashboard-discover"]',
        title: "Discover research",
        body: "Open Discover to browse published work and find collaborators.",
      },
      {
        id: "discover-projects-tab",
        route: "/discover",
        selector: '[data-tour-id="discover-projects-tab"]',
        title: "Browse projects",
        body: "Filter and search published papers by field and topic.",
      },
      {
        id: "discover-search",
        route: "/discover",
        selector: '[data-tour-id="discover-search-input"]',
        title: "Search quickly",
        body: "Search by title or topic to find relevant papers faster.",
        activateSelector: '[data-tour-id="discover-projects-tab"]',
      },
      {
        id: "discover-chat-tab",
        route: "/discover",
        selector: '[data-tour-id="discover-chat-tab"]',
        title: "Knowledge sharing chat",
        body: "Use your university chat channel for discussions and image sharing.",
      },
    ];

    if (isAdmin) {
      baseSteps.push({
        id: "admin-verification",
        route: "/admin",
        selector: '[data-tour-id="admin-verification-tabs"]',
        title: "Admin moderation",
        body: "Approve or reject student verification requests from here.",
      });
    }

    return baseSteps;
  }, [isAdmin]);

  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const completedKey = user ? `${TOUR_STORAGE_KEY}:${user.id}` : null;

  const markCompleted = () => {
    if (!completedKey) return;
    localStorage.setItem(completedKey, "completed");
  };

  const updateNavInFlight = (value: boolean) => {
    navInFlightRef.current = value;
    setNavInFlight(value);
  };

  const startTour = useCallback(() => {
    shouldRouteSyncRef.current = true;
    updateNavInFlight(true);
    setStepIndex(0);
    setActive(true);
    setTargetRect(null);
    setTargetFound(false);
    currentTargetRef.current = null;
  }, []);

  useEffect(() => {
    const handler = () => startTour();
    window.addEventListener(START_EVENT, handler);
    return () => window.removeEventListener(START_EVENT, handler);
  }, [startTour]);

  useEffect(() => {
    if (isLoading || !user || !completedKey || hasAutoStartedRef.current) return;
    if (localStorage.getItem(completedKey) === "completed") return;
    if (!pathname?.startsWith("/dashboard")) return;

    hasAutoStartedRef.current = true;
    window.setTimeout(() => {
      startTour();
    }, 0);
  }, [completedKey, isLoading, pathname, startTour, user]);

  useEffect(() => {
    if (!active || !step || !pathname) return;

    if (pathname !== step.route && shouldRouteSyncRef.current) {
      router.replace(step.route);
      return;
    }

    if (pathname === step.route) {
      shouldRouteSyncRef.current = false;
    }
  }, [active, pathname, router, step]);

  useEffect(() => {
    if (!active || !pathname || !step) return;
    if (pathname === step.route) return;

    const forwardMatch = steps.findIndex((s, i) => i >= stepIndex && s.route === pathname);
    const anyMatch = steps.findIndex((s) => s.route === pathname);
    const nextIndex = forwardMatch >= 0 ? forwardMatch : anyMatch;

    if (nextIndex >= 0 && nextIndex !== stepIndex) {
      window.setTimeout(() => {
        setStepIndex(nextIndex);
        shouldRouteSyncRef.current = false;
        updateNavInFlight(false);
      }, 0);
    }
  }, [active, pathname, step, stepIndex, steps]);

  useEffect(() => {
    if (!active || !step || pathname !== step.route) return;

    let cancelled = false;
    let attempts = 0;

    const findTarget = () => {
      if (cancelled) return;

      if (step.activateSelector) {
        const activator = document.querySelector(step.activateSelector);
        if (activator instanceof HTMLElement && isVisible(activator)) {
          activator.click();
        }
      }

      const node = document.querySelector(step.selector);
      if (node instanceof HTMLElement && isVisible(node)) {
        currentTargetRef.current = node;
        node.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        setTargetFound(true);
        updateNavInFlight(false);

        const rect = node.getBoundingClientRect();
        setTargetRect({
          top: rect.top - 8,
          left: rect.left - 8,
          width: rect.width + 16,
          height: rect.height + 16,
        });
        return;
      }

      attempts += 1;
      if (attempts < 60) {
        window.setTimeout(findTarget, 120);
      } else {
        setTargetFound(false);
        setTargetRect(null);
        updateNavInFlight(false);
      }
    };

    const kickoffId = window.setTimeout(() => {
      setTargetFound(false);
      setTargetRect(null);
      findTarget();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(kickoffId);
      currentTargetRef.current = null;
    };
  }, [active, pathname, step]);

  useEffect(() => {
    if (!active || !targetFound) return;

    const syncRect = () => {
      const node = currentTargetRef.current;
      if (!node || !isVisible(node)) return;

      const rect = node.getBoundingClientRect();
      setTargetRect({
        top: rect.top - 8,
        left: rect.left - 8,
        width: rect.width + 16,
        height: rect.height + 16,
      });
    };

    const onScroll = () => syncRect();
    const onResize = () => syncRect();

    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    const id = window.setInterval(syncRect, 180);

    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      window.clearInterval(id);
    };
  }, [active, targetFound]);

  if (!active || !user || !step) return null;

  const finishTour = () => {
    markCompleted();
    updateNavInFlight(false);
    setActive(false);
  };

  const skipTour = () => {
    markCompleted();
    updateNavInFlight(false);
    setActive(false);
  };

  const next = () => {
    if (navInFlightRef.current) return;
    if (stepIndex >= steps.length - 1) {
      finishTour();
      return;
    }

    shouldRouteSyncRef.current = true;
    updateNavInFlight(true);
    setStepIndex((prev) => prev + 1);
  };

  const previous = () => {
    if (navInFlightRef.current) return;

    shouldRouteSyncRef.current = true;
    updateNavInFlight(true);
    setStepIndex((prev) => Math.max(0, prev - 1));
  };

  const progress = Math.round(((stepIndex + 1) / steps.length) * 100);
  const tooltipWidth = 360;
  const viewportWidth = typeof window === "undefined" ? 1024 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 768 : window.innerHeight;
  const defaultTop = 96;
  const defaultLeft = Math.max(20, Math.floor((viewportWidth - tooltipWidth) / 2));

  const tooltipTop = targetRect
    ? Math.min(viewportHeight - 220, Math.max(20, targetRect.top + targetRect.height + 16))
    : defaultTop;
  const tooltipLeft = targetRect
    ? Math.min(viewportWidth - tooltipWidth - 20, Math.max(20, targetRect.left))
    : defaultLeft;

  return (
    <div className="pointer-events-none fixed inset-0 z-[120]">
      <div className="absolute inset-0 bg-slate-950/58" />

      {targetRect && (
        <div
          className="tour-spotlight"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
          }}
        />
      )}

      <div
        className="pointer-events-auto fixed z-[140] w-[360px] max-w-[calc(100vw-1.5rem)] rounded-xl border border-slate-700 bg-slate-900/98 p-4 text-white shadow-2xl"
        style={{ top: tooltipTop, left: tooltipLeft }}
      >
        <div className="mb-2 flex items-center justify-between">
          <Badge className="border border-blue-300/30 bg-blue-500/20 text-blue-100">
            <Sparkles className="mr-1 h-3.5 w-3.5" />
            Product Tour
          </Badge>
          <span className="text-xs text-slate-300">
            {stepIndex + 1}/{steps.length}
          </span>
        </div>

        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-700">
          <div className="h-full rounded-full bg-cyan-400 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        <h3 className="text-base font-semibold">{step.title}</h3>
        <p className="mt-1 text-sm text-slate-200">{step.body}</p>
        {!targetFound && (
          <p className="mt-2 text-xs text-cyan-200">Finding the highlighted control...</p>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="ghost" className="text-white hover:bg-slate-700 hover:text-white" onClick={skipTour}>
            Skip
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="border-slate-500 bg-transparent text-white hover:bg-slate-700 hover:text-white"
              onClick={previous}
              disabled={stepIndex === 0 || navInFlight}
            >
              Back
            </Button>
            <Button onClick={next} disabled={navInFlight}>
              {stepIndex === steps.length - 1 ? "Finish" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function startProductTour() {
  window.dispatchEvent(new Event(START_EVENT));
}

export function completeProductTourForUser(userId: string) {
  localStorage.setItem(`${TOUR_STORAGE_KEY}:${userId}`, "completed");
}
