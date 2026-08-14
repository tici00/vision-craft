/**
 * Publishing / social platform architecture (contracts only).
 *
 * Vision Craft will later read real performance from TikTok, Instagram and
 * YouTube. This file fixes the boundary now so the intelligence layer never has
 * to change when a real connector arrives:
 *
 *   connector (real API)  ->  ObservedPerformance rows  ->  Creator Intelligence
 *
 * IMPORTANT: there is no implementation here on purpose. No connector is
 * registered, so `listPlatformConnectors()` returns an empty list and the UI
 * states that no platform is connected. Nothing in the app fabricates metrics.
 */

import type { ObservedPerformance, Platform } from "@/services/intelligence/performanceIntelligence";

export const PLATFORM_LABEL: Record<Platform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  other: "Outra plataforma",
};

/** Practical format envelope of each destination, used for platform fit. */
export interface PlatformFormat {
  platform: Platform;
  label: string;
  aspectRatio: "9:16" | "1:1" | "16:9";
  minSeconds: number;
  maxSeconds: number;
}

export const PLATFORM_FORMATS: PlatformFormat[] = [
  { platform: "tiktok", label: "TikTok", aspectRatio: "9:16", minSeconds: 5, maxSeconds: 600 },
  { platform: "instagram", label: "Instagram Reels", aspectRatio: "9:16", minSeconds: 3, maxSeconds: 180 },
  { platform: "youtube", label: "YouTube Shorts", aspectRatio: "9:16", minSeconds: 5, maxSeconds: 180 },
];

export interface PlatformAccount {
  platform: Platform;
  accountId: string;
  displayName: string | null;
}

/** What a real connector must provide; metrics are read, never estimated. */
export interface PlatformConnector {
  platform: Platform;
  /** OAuth / token status for the current user. */
  isConnected(): Promise<boolean>;
  listAccounts(): Promise<PlatformAccount[]>;
  /** Real, measured metrics for a published clip. */
  fetchObservations(params: {
    accountId: string;
    publicationUrl: string;
  }): Promise<ObservedPerformance[]>;
}

/** No connector is implemented yet — deliberately empty. */
export function listPlatformConnectors(): PlatformConnector[] {
  return [];
}

export function isPlatformConnected(platform: Platform): boolean {
  return listPlatformConnectors().some((connector) => connector.platform === platform);
}
