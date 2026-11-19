import { Capacitor } from '@capacitor/core';
import { AppLauncher } from '@capacitor/app-launcher';

export interface OpenNativeAppOptions {
  deepLink: string;
  fallbackUrl?: string;
  packageNames?: string[];
}

export interface OpenNativeAppResult {
  opened: boolean;
  method:
    | 'capacitor-app-launcher'
    | 'android-bridge'
    | 'web-anchor'
    | 'deep-link-pending'
    | 'failed';
  usedUrl?: string;
  fallbackUrl?: string;
}

const KNOWN_ANDROID_PACKAGES: Array<{ schemePrefix: string; packages: string[] }> = [
  { schemePrefix: 'whatsapp://', packages: ['com.whatsapp', 'com.whatsapp.w4b'] },
  { schemePrefix: 'tg://', packages: ['org.telegram.messenger', 'org.telegram.plus'] },
  { schemePrefix: 'youtube://', packages: ['com.google.android.youtube'] },
  { schemePrefix: 'vnd.youtube://', packages: ['com.google.android.youtube'] },
  { schemePrefix: 'notion://', packages: ['notion.id'] },
  { schemePrefix: 'instagram://', packages: ['com.instagram.android'] },
  { schemePrefix: 'twitter://', packages: ['com.twitter.android'] },
  { schemePrefix: 'spotify://', packages: ['com.spotify.music'] },
];

export const isHttpLink = (url: string): boolean => /^https?:\/\//i.test(url.trim());

export const normalizeDeepLink = (url: string): string => {
  const trimmed = url.trim();
  if (trimmed === 'whatsapp://') return 'whatsapp://send';
  if (trimmed === 'tg://') return 'tg://resolve';
  if (trimmed === 'youtube://') return 'vnd.youtube://';
  return trimmed;
};

export const getDefaultFallbackUrl = (
  deepLink: string,
  explicitFallback?: string
): string => {
  const trimmedFallback = explicitFallback?.trim();
  if (trimmedFallback) return trimmedFallback;

  const lower = deepLink.trim().toLowerCase();
  if (lower.startsWith('whatsapp://')) return 'https://wa.me/';
  if (lower.startsWith('youtube://') || lower.startsWith('vnd.youtube://')) {
    return 'https://www.youtube.com/';
  }
  if (lower.startsWith('tg://')) return 'https://t.me/';
  if (lower.startsWith('notion://')) return 'https://www.notion.so/';
  if (lower.startsWith('instagram://')) return 'https://www.instagram.com/';
  if (lower.startsWith('twitter://')) return 'https://x.com/';
  if (lower.startsWith('spotify://')) return 'https://open.spotify.com/';
  if (lower.startsWith('mailto:')) return 'https://mail.google.com/';
  return '';
};

const getCandidatePackages = (
  deepLink: string,
  extraPackages?: string[]
): string[] => {
  const lower = deepLink.trim().toLowerCase();
  const matched =
    KNOWN_ANDROID_PACKAGES.find((entry) => lower.startsWith(entry.schemePrefix))
      ?.packages || [];
  return Array.from(new Set([...(extraPackages || []), ...matched]));
};

const isMobileWebRuntime = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
};

const isEmbeddedIframe = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

export const triggerAnchorNavigation = (href: string, openInNewTab: boolean): void => {
  if (typeof document === 'undefined') return;
  const link = document.createElement('a');
  link.href = href;
  if (openInNewTab) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

async function tryAppLauncherUrl(targetUrl: string): Promise<boolean> {
  if (!targetUrl) return false;
  try {
    const result = await AppLauncher.openUrl({ url: targetUrl });
    return Boolean(result?.completed);
  } catch {
    return false;
  }
}

async function tryAppLauncherPackage(packageName: string): Promise<boolean> {
  if (!packageName) return false;
  try {
    const { value } = await AppLauncher.canOpenUrl({ url: packageName });
    if (!value) return false;
    const { completed } = await AppLauncher.openUrl({ url: packageName });
    return Boolean(completed);
  } catch {
    return false;
  }
}

/**
 * Launches external native Android/iOS apps (WhatsApp, YouTube, Telegram, etc.)
 * via Capacitor AppLauncher using deep links with package-name & web-URL fallbacks.
 * Never relies on window.location.href or window.open.
 */
export async function openNativeApp(
  deepLinkOrOptions: string | OpenNativeAppOptions,
  fallbackUrlArg?: string
): Promise<OpenNativeAppResult> {
  const options: OpenNativeAppOptions =
    typeof deepLinkOrOptions === 'string'
      ? { deepLink: deepLinkOrOptions, fallbackUrl: fallbackUrlArg }
      : deepLinkOrOptions;

  const resolvedDeepLink = normalizeDeepLink(options.deepLink);
  const resolvedFallback = getDefaultFallbackUrl(resolvedDeepLink, options.fallbackUrl);

  if (!resolvedDeepLink) {
    return { opened: false, method: 'failed', fallbackUrl: resolvedFallback || undefined };
  }

  // 1. Native Capacitor runtime (Android / iOS)
  if (Capacitor.isNativePlatform()) {
    // Try opening the deep link directly through Capacitor AppLauncher
    if (await tryAppLauncherUrl(resolvedDeepLink)) {
      return {
        opened: true,
        method: 'capacitor-app-launcher',
        usedUrl: resolvedDeepLink,
        fallbackUrl: resolvedFallback || undefined,
      };
    }

    // On Android, try known package identifiers via AppLauncher if URI intent didn't match
    if (Capacitor.getPlatform() === 'android') {
      const packages = getCandidatePackages(resolvedDeepLink, options.packageNames);
      for (const pkg of packages) {
        if (await tryAppLauncherPackage(pkg)) {
          return {
            opened: true,
            method: 'capacitor-app-launcher',
            usedUrl: pkg,
            fallbackUrl: resolvedFallback || undefined,
          };
        }
      }
    }

    // Fallback to native Android JS bridge if available
    const androidLauncher = (
      window as unknown as {
        AndroidExternalLauncher?: {
          openApp?: (deepLink: string, fallbackUrl: string) => boolean;
        };
      }
    ).AndroidExternalLauncher;

    if (androidLauncher?.openApp) {
      try {
        const openedByBridge = androidLauncher.openApp(resolvedDeepLink, resolvedFallback);
        if (openedByBridge) {
          return {
            opened: true,
            method: 'android-bridge',
            usedUrl: resolvedDeepLink,
            fallbackUrl: resolvedFallback || undefined,
          };
        }
      } catch {
        // Continue to web fallback URL via AppLauncher
      }
    }

    // Finally try opening the web fallback URL in the device browser via AppLauncher
    if (resolvedFallback && (await tryAppLauncherUrl(resolvedFallback))) {
      return {
        opened: true,
        method: 'capacitor-app-launcher',
        usedUrl: resolvedFallback,
        fallbackUrl: resolvedFallback,
      };
    }

    return {
      opened: false,
      method: 'failed',
      fallbackUrl: resolvedFallback || undefined,
    };
  }

  // 2. Standard HTTP(S) link on Web / PWA
  if (isHttpLink(resolvedDeepLink)) {
    triggerAnchorNavigation(resolvedDeepLink, true);
    return {
      opened: true,
      method: 'web-anchor',
      usedUrl: resolvedDeepLink,
      fallbackUrl: resolvedFallback || undefined,
    };
  }

  // 3. Desktop browser or iframe preview: use web fallback URL via anchor navigation
  if ((!isMobileWebRuntime() || isEmbeddedIframe()) && resolvedFallback) {
    triggerAnchorNavigation(resolvedFallback, true);
    return {
      opened: true,
      method: 'web-anchor',
      usedUrl: resolvedFallback,
      fallbackUrl: resolvedFallback,
    };
  }

  // 4. Mobile web browser: trigger custom scheme anchor synchronously without window.location.href
  try {
    triggerAnchorNavigation(resolvedDeepLink, false);
    return {
      opened: true,
      method: 'deep-link-pending',
      usedUrl: resolvedDeepLink,
      fallbackUrl: resolvedFallback || undefined,
    };
  } catch {
    if (resolvedFallback) {
      triggerAnchorNavigation(resolvedFallback, true);
      return {
        opened: true,
        method: 'web-anchor',
        usedUrl: resolvedFallback,
        fallbackUrl: resolvedFallback,
      };
    }
    return {
      opened: false,
      method: 'failed',
      fallbackUrl: resolvedFallback || undefined,
    };
  }
}
