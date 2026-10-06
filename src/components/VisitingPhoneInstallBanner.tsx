import React, { useState, useEffect } from 'react';
import { Smartphone, Download, X, Sparkles } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface VisitingPhoneInstallBannerProps {
  onOpenInstallModal: () => void;
}

export const VisitingPhoneInstallBanner: React.FC<VisitingPhoneInstallBannerProps> = ({
  onOpenInstallModal,
}) => {
  const { isInstalled, isInstallable, install } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    // Only show if not already running as installed standalone app and not dismissed in this session
    if (typeof window !== 'undefined') {
      const dismissed = sessionStorage.getItem('namana_install_banner_dismissed') === 'true';
      if (!isInstalled && !dismissed) {
        setIsDismissed(false);
      }
    }
  }, [isInstalled]);

  if (isInstalled || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('namana_install_banner_dismissed', 'true');
    }
  };

  const handleQuickAction = async () => {
    if (isInstallable) {
      const res = await install();
      if (res === 'accepted') {
        setIsDismissed(true);
        return;
      }
    }
    // If native prompt is not directly available, open the comprehensive install & APK modal
    onOpenInstallModal();
  };

  return (
    <div className="bg-gradient-to-r from-sky-900 via-sky-800 to-indigo-900 text-white px-3 py-2 text-xs flex items-center justify-between gap-2 shadow-md relative z-25 border-b border-sky-700/60 select-none animate-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-400/30">
          <Smartphone className="w-3.5 h-3.5" />
        </div>
        <div className="truncate">
          <span className="font-extrabold text-white">Install Clinic App & APK: </span>
          <span className="text-sky-200 font-medium">Direct installation for any visiting phone</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={handleQuickAction}
          className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-slate-950 font-black text-[11px] shadow-xs flex items-center gap-1 cursor-pointer transition-all uppercase tracking-wide"
        >
          <Download className="w-3 h-3 text-slate-950" />
          <span>Download APK</span>
        </button>

        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 rounded-lg text-sky-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Dismiss banner"
          aria-label="Dismiss banner"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
