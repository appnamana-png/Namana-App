import { useEffect, useState, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __pwaInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    typeof window !== 'undefined' ? window.__pwaInstallPrompt || null : null
  );
  const [isInstalled, setIsInstalled] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if running inside the actual installed standalone APK or app
    const checkStandalone = () => {
      // Clear any legacy test flag from localStorage so website visits are never blocked
      try {
        localStorage.removeItem('is_app_installed');
      } catch (e) {}

      // 1. Standard PWA / WebAPK standalone display mode (running in standalone app window without browser UI)
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: window-controls-overlay)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;

      // 2. True Android WebView token in User Agent (standard for APK wrappers like Website2APK / Web2Apk / Capacitor)
      const ua = window.navigator.userAgent || '';
      const isAndroidWebView =
        (/;\s*wv[);]/i.test(ua) || /\(Linux;.*Android.*wv.*\)/i.test(ua)) &&
        !/Chrome\/[0-9.]+ Mobile/i.test(ua);

      // 3. Native app bridges injected into the window (Capacitor, Cordova, Android Native Interface)
      const isNativeApp =
        typeof (window as any).Capacitor !== 'undefined' ||
        typeof (window as any).cordova !== 'undefined' ||
        typeof (window as any).Android !== 'undefined' ||
        typeof (window as any).AndroidBridge !== 'undefined';

      // 4. Explicit APK / Standalone URL parameter (when builder specifies start_url: "/?app=1" or "/?mode=apk")
      const isAppQueryParam =
        window.location.search.includes('mode=apk') ||
        window.location.search.includes('mode=app') ||
        window.location.search.includes('is_apk=1') ||
        window.location.search.includes('app=1');

      // The app is only marked "installed" if the CURRENT RUNTIME is actually running inside the standalone APK / app window
      const runningInApp = Boolean(
        isStandaloneMode ||
        isNativeApp ||
        isAppQueryParam ||
        isAndroidWebView
      );

      setIsInstalled(runningInApp);
    };

    checkStandalone();

    // Check device types
    const ua = window.navigator.userAgent.toLowerCase();
    const android = /android/i.test(ua);
    const ios = /iphone|ipad|ipod/i.test(ua);
    setIsAndroid(android);
    setIsIOS(ios);

    // If global variable has the prompt already, retain it
    if (window.__pwaInstallPrompt) {
      setDeferredPrompt(window.__pwaInstallPrompt);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent standard browser mini-infobar so our unlimited in-app button has full control
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window.__pwaInstallPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      window.__pwaInstallPrompt = null;
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unsupported'> => {
    const prompt = deferredPrompt || window.__pwaInstallPrompt;
    if (!prompt) {
      return 'unsupported';
    }

    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        window.__pwaInstallPrompt = null;
        setDeferredPrompt(null);
        return 'accepted';
      }
      return 'dismissed';
    } catch (err) {
      console.warn('PWA install prompt error:', err);
      return 'unsupported';
    }
  }, [deferredPrompt]);

  return {
    isInstallable: !!(deferredPrompt || (typeof window !== 'undefined' && window.__pwaInstallPrompt)),
    isInstalled,
    isAndroid,
    isIOS,
    install,
    deferredPrompt,
  };
}
