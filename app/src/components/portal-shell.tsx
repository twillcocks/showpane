"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ANALYTICS_METADATA_KEYS,
  type PortalEventMetadata,
  type PortalEventType,
} from "@/lib/portal-contracts";

export type PortalTab = {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: "amber" | null;
  content: ReactNode;
};

export type PortalContact = {
  name: string;
  title: string;
  avatarSrc: string;
  email: string;
  phone?: string;
  phoneDisplay?: string;
  message?: string;
};

export type PortalShellProps = {
  companyName: string;
  companyLogo: ReactNode;
  portalLabel?: string;

  clientName: string;
  clientLogoSrc: string;
  clientLogoAlt: string;

  tabs: PortalTab[];

  contact: PortalContact;
  lastUpdated: string;
  hideFooterOnTab?: string;

  shareEndpoint?: string;
  eventsEndpoint?: string;
};

// ── Visitor ID (sp_visitor cookie, 30-day, first-party UUID) ─────────────────

function getOrCreateVisitorId(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|; )sp_visitor=([^;]+)/);
  if (match) return match[1];
  const id = crypto.randomUUID();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `sp_visitor=${id}; path=/; expires=${expires}; SameSite=Lax`;
  return id;
}

// ── Event tracking ───────────────────────────────────────────────────────────

function trackEvent(
  eventsEndpoint: string,
  event: PortalEventType,
  detail?: string,
  visitorId?: string,
  metadata?: PortalEventMetadata
) {
  fetch(eventsEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, detail, visitorId, metadata }),
  }).catch(() => {});
}

function readHashTab(tabIds: string[]): string {
  if (typeof window === "undefined") return tabIds[0] ?? "";
  const hash = window.location.hash.replace("#", "");
  return tabIds.includes(hash) ? hash : tabIds[0] ?? "";
}

// ── Section time tracking via Intersection Observer ──────────────────────────

function useSectionTimeTracking(
  activeTab: string,
  eventsEndpoint: string,
  visitorId: string
) {
  const sectionTimers = useRef<Map<string, number>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  const flushSectionTime = useCallback(
    (sectionId: string) => {
      const startTime = sectionTimers.current.get(sectionId);
      if (!startTime) return;
      const duration = Math.round((Date.now() - startTime) / 1000);
      sectionTimers.current.delete(sectionId);
      if (duration >= 2) {
        trackEvent(eventsEndpoint, "section_time", sectionId, visitorId, {
          [ANALYTICS_METADATA_KEYS.durationSeconds]: duration,
        });
      }
    },
    [eventsEndpoint, visitorId]
  );

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    // Flush all timers from previous tab
    for (const sectionId of sectionTimers.current.keys()) {
      flushSectionTime(sectionId);
    }

    observerRef.current?.disconnect();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const sectionId = entry.target.getAttribute("data-section-id");
          if (!sectionId) continue;

          if (entry.isIntersecting) {
            if (!sectionTimers.current.has(sectionId)) {
              sectionTimers.current.set(sectionId, Date.now());
              trackEvent(eventsEndpoint, "section_view", sectionId, visitorId);
            }
          } else {
            flushSectionTime(sectionId);
          }
        }
      },
      { threshold: 0.3 }
    );

    observerRef.current = observer;

    // Observe all elements with data-section-id within #main-content
    const mainContent = document.getElementById("main-content");
    if (mainContent) {
      const sections = mainContent.querySelectorAll("[data-section-id]");
      sections.forEach((el) => observer.observe(el));
    }

    return () => {
      for (const sectionId of sectionTimers.current.keys()) {
        flushSectionTime(sectionId);
      }
      observer.disconnect();
    };
  }, [activeTab, eventsEndpoint, visitorId, flushSectionTime]);
}

// ── PortalShell component ────────────────────────────────────────────────────

export function PortalShell({
  companyName,
  companyLogo,
  portalLabel,
  clientName,
  clientLogoSrc,
  clientLogoAlt,
  tabs,
  contact,
  lastUpdated,
  hideFooterOnTab,
  shareEndpoint,
  eventsEndpoint,
}: PortalShellProps) {
  const resolvedShareEndpoint = shareEndpoint ?? "/api/client-auth/share";
  const resolvedEventsEndpoint = eventsEndpoint ?? "/api/client-events";
  const resolvedPortalLabel = portalLabel ?? "Client Portal";
  const resolvedContactMessage = contact.message ?? "Reach out anytime";

  const tabIds = tabs.map((tab) => tab.id);
  const defaultTab = tabIds[0] ?? "";

  const [activeTab, setActiveTab] = useState(defaultTab);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [visitorId] = useState(() => getOrCreateVisitorId());
  const [showLocalBanner, setShowLocalBanner] = useState(false);

  useEffect(() => {
    const syncFromHash = () => setActiveTab(readHashTab(tabIds));
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    trackEvent(resolvedEventsEndpoint, "portal_view", undefined, visitorId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!copied && !copyError) return;
    const timeout = window.setTimeout(() => { setCopied(false); setCopyError(false); }, 2000);
    return () => window.clearTimeout(timeout);
  }, [copied, copyError]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname;
    setShowLocalBanner(host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0");
  }, []);

  useSectionTimeTracking(activeTab, resolvedEventsEndpoint, visitorId);

  function switchTab(tab: string) {
    setActiveTab(tab);
    window.history.replaceState(null, "", `#${tab}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
    trackEvent(resolvedEventsEndpoint, "tab_switch", tab, visitorId);
  }

  async function handleShare() {
    try {
      const response = await fetch(resolvedShareEndpoint);
      if (!response.ok) { setCopyError(true); return; }

      const { shareUrl } = (await response.json()) as { shareUrl?: string };
      if (!shareUrl) { setCopyError(true); return; }

      await navigator.clipboard.writeText(
        activeTab === defaultTab ? shareUrl : `${shareUrl}#${activeTab}`
      );
      setCopied(true);
    } catch {
      setCopyError(true);
    }
  }

  const activeContent = tabs.find((t) => t.id === activeTab)?.content ?? null;
  const showFooter = hideFooterOnTab ? activeTab !== hideFooterOnTab : true;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <div className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur">
        {showLocalBanner && (
          <div className="border-b border-amber-200 bg-amber-50">
            <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-2 text-[11px] font-medium text-amber-900 sm:px-6 sm:text-xs">
              <span className="inline-flex shrink-0 whitespace-nowrap rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-900 sm:text-[11px]">
                Local preview
              </span>
              <span>
                This portal is local only. Tell Claude{" "}
                <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-amber-950 sm:text-xs">
                  /portal-deploy
                </code>{" "}
                to publish it to Showpane Cloud.
              </span>
            </div>
          </div>
        )}
        <header className="border-b bg-white/90">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-900">
                  {companyLogo}
                </div>
                <img
                  src={clientLogoSrc}
                  alt={clientLogoAlt}
                  width={32}
                  height={32}
                  className="-ml-2 h-8 w-8 rounded-full border-2 border-white"
                  loading="eager"
                />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-gray-900">
                  {clientName}
                </h1>
                <p className="text-[11px] text-gray-500">{companyName} {resolvedPortalLabel}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleShare}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                copyError
                  ? "border-red-200 text-red-600"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              )}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied!" : copyError ? "Failed to copy" : "Copy secure link"}
            </button>
          </div>
        </header>

        <div className="bg-white/90">
          <div role="tablist" className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-4 sm:px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`tabpanel-${tab.id}`}
                  id={`tab-${tab.id}`}
                  onClick={() => switchTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:gap-2 sm:px-4",
                    activeTab === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-gray-400 hover:text-gray-700"
                  )}
                >
                  <span className="relative">
                    <Icon className="h-4 w-4" />
                    {tab.badge && activeTab !== tab.id ? (
                      <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-400" />
                    ) : null}
                  </span>
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <main
        id="main-content"
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8"
      >
        {activeContent}
      </main>

      {showFooter ? (
        <footer className="mt-auto border-t bg-white">
          <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-4 sm:px-6">
            <img
              src={contact.avatarSrc}
              alt={contact.name}
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 rounded-full"
              loading="lazy"
            />
            <div className="flex-1">
              <p className="text-xs">
                <span className="font-semibold text-gray-900">{contact.name}</span>{" "}
                <span className="text-gray-400">{contact.title}</span>
              </p>
              <p className="text-[11px] text-gray-500">{resolvedContactMessage}</p>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={`mailto:${contact.email}`}
                className="text-xs text-gray-400 transition-colors hover:text-gray-600"
              >
                {contact.email}
              </a>
              {contact.phone ? (
                <a
                  href={`tel:${contact.phone}`}
                  className="text-xs text-gray-400 transition-colors hover:text-gray-600"
                >
                  {contact.phoneDisplay ?? contact.phone}
                </a>
              ) : null}
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 pb-3">
            <p className="text-[11px] text-gray-300">Last updated {lastUpdated}</p>
            <span className="text-gray-200">·</span>
            <a
              href="https://showpane.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-gray-300 transition-colors hover:text-gray-400"
            >
              Powered by Showpane
            </a>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
