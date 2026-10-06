import React, { useState, useEffect } from 'react';
import { Cloud, Check, Droplets } from 'lucide-react';

interface WaterBackupNavButtonProps {
  isActive: boolean;
  onClick: () => void;
  isMobile?: boolean;
}

export const WaterBackupNavButton: React.FC<WaterBackupNavButtonProps> = ({
  isActive,
  onClick,
  isMobile = false,
}) => {
  const [fillPercent, setFillPercent] = useState<number>(() => {
    const now = new Date();
    return ((now.getMinutes() * 60 + now.getSeconds()) / 3600) * 100;
  });
  const [minutesRemaining, setMinutesRemaining] = useState<number>(() => {
    return 60 - new Date().getMinutes();
  });
  const [isJustBackedUp, setIsJustBackedUp] = useState<boolean>(false);

  useEffect(() => {
    const updateProgress = () => {
      const now = new Date();
      const mins = now.getMinutes();
      const secs = now.getSeconds();
      const pct = Math.min(100, Math.max(4, ((mins * 60 + secs) / 3600) * 100));
      setFillPercent(pct);
      setMinutesRemaining(60 - mins);

      // Trigger splash at top of hour (:00)
      if (mins === 0 && secs < 12) {
        setIsJustBackedUp(true);
      }
    };

    updateProgress();
    const interval = setInterval(updateProgress, 1000);

    // Listen for hourly backup completion events
    const handleBackupDone = () => {
      setIsJustBackedUp(true);
      setTimeout(() => {
        setIsJustBackedUp(false);
      }, 5000);
    };

    window.addEventListener('hourly-backup-completed', handleBackupDone);
    window.addEventListener('physio-hourly-backup-complete', handleBackupDone);
    return () => {
      clearInterval(interval);
      window.removeEventListener('hourly-backup-completed', handleBackupDone);
      window.removeEventListener('physio-hourly-backup-complete', handleBackupDone);
    };
  }, []);

  // Turn off splash after 5s
  useEffect(() => {
    if (isJustBackedUp) {
      const timer = setTimeout(() => {
        setIsJustBackedUp(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isJustBackedUp]);

  // Mobile Version
  if (isMobile) {
    return (
      <button
        id="nav-tab-backup-mobile"
        type="button"
        onClick={onClick}
        title={`Hourly Auto-Backup: ${fillPercent.toFixed(0)}% filled (${minutesRemaining}m until next backup)`}
        className={`relative p-1.5 rounded-lg text-xs cursor-pointer overflow-hidden border transition-all ${
          isActive
            ? 'border-sky-500 ring-2 ring-sky-300 text-sky-900 bg-sky-50 font-bold'
            : 'border-sky-200 text-slate-700 bg-white hover:bg-sky-50/50'
        }`}
      >
        {/* Rising Water Level in Button */}
        <div
          className={`absolute bottom-0 left-0 right-0 transition-all duration-1000 ease-linear pointer-events-none ${
            isJustBackedUp
              ? 'bg-sky-500 animate-pulse'
              : 'bg-gradient-to-t from-sky-500/50 via-sky-400/40 to-sky-300/40'
          }`}
          style={{ height: `${isJustBackedUp ? 100 : fillPercent}%` }}
        >
          {/* Animated wavy surface */}
          <div className="absolute -top-1 left-0 right-0 h-1.5 bg-sky-400/80 rounded-full animate-pulse" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex items-center justify-center">
          {isJustBackedUp ? (
            <Check className="w-4 h-4 text-white drop-shadow-xs animate-bounce stroke-[3]" />
          ) : (
            <Cloud className={`w-4 h-4 ${isActive ? 'text-sky-800' : 'text-sky-600'}`} />
          )}
        </div>
      </button>
    );
  }

  // Desktop Button with Water Level & Hourly Wave Animation
  return (
    <button
      id="nav-tab-backup"
      type="button"
      onClick={onClick}
      title={`Hourly Auto-Backup Clock: ${fillPercent.toFixed(0)}% filled (${minutesRemaining} min until next backup)`}
      className={`relative flex items-center justify-center text-center gap-1 md:gap-1.5 px-1.5 md:px-2 lg:px-3 py-1 lg:py-1.5 rounded-xl text-[10.5px] md:text-[11px] lg:text-xs font-bold transition-all cursor-pointer overflow-hidden border whitespace-nowrap shrink-0 ${
        isJustBackedUp
          ? 'bg-sky-600 text-white border-sky-400 shadow-md ring-2 ring-sky-300'
          : isActive
          ? 'bg-sky-50 text-sky-950 border-sky-300 ring-2 ring-sky-200 shadow-xs'
          : 'bg-white text-slate-700 border-sky-200 hover:border-sky-300 hover:bg-sky-50/40 shadow-2xs'
      }`}
    >
      {/* Dynamic Water Reservoir Layer - Uses same clinic blue (#0284c7 / sky-500) */}
      <div
        className={`absolute bottom-0 left-0 right-0 transition-all duration-1000 ease-linear pointer-events-none ${
          isJustBackedUp
            ? 'bg-gradient-to-t from-sky-600 to-sky-500 opacity-95 animate-pulse'
            : 'bg-gradient-to-t from-sky-500/45 via-sky-400/35 to-sky-300/30'
        }`}
        style={{ height: `${isJustBackedUp ? 100 : fillPercent}%` }}
      >
        {/* Animated Water Crest Line with wave effect */}
        {!isJustBackedUp && (
          <div className="absolute -top-1 left-0 right-0 h-1.5 bg-sky-500/70 border-t border-sky-300/90 shadow-2xs animate-pulse" />
        )}
      </div>

      {/* Subtle tick marks representing water level reservoir (0%, 50%, 100%) */}
      <div className="hidden lg:flex absolute right-1 inset-y-1 w-1 flex-col justify-between pointer-events-none opacity-40">
        <span className="w-1 h-0.5 bg-sky-600 rounded-full" />
        <span className="w-0.5 h-0.5 bg-sky-500 rounded-full" />
        <span className="w-1 h-0.5 bg-sky-600 rounded-full" />
      </div>

      {/* Button Content */}
      <div className="relative z-10 flex items-center gap-1 md:gap-1.5">
        {isJustBackedUp ? (
          <div className="flex items-center gap-1 text-white animate-in zoom-in-95 duration-200">
            <Check className="w-3.5 h-3.5 text-white stroke-[3] animate-bounce" />
            <span className="text-[10px] lg:text-[11px] font-black tracking-tight drop-shadow-xs">
              <span className="hidden sm:inline">Backed Up!</span>
              <span className="sm:hidden">Saved</span>
            </span>
          </div>
        ) : (
          <>
            <div className="relative flex items-center justify-center">
              <Cloud className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              {/* Pulsing water droplet on the cloud */}
              <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-sky-500 rounded-full animate-ping" />
            </div>
            <span className="tracking-tight hidden lg:inline">Backup</span>
            <span
              className="text-[9px] md:text-[9.5px] font-mono font-extrabold px-1 md:px-1.5 py-0.2 rounded-md bg-white/90 border border-sky-300 text-sky-800 shadow-2xs"
              title={`${minutesRemaining} minutes remaining until top-of-hour auto-backup`}
            >
              {minutesRemaining}m
            </span>
          </>
        )}
      </div>
    </button>
  );
};
