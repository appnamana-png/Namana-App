import React from 'react';

interface LoadingScreenProps {
  message?: string;
  subMessage?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Namana Physiotherapy Clinic',
  subMessage = 'Loading clinical database and system records...',
}) => {
  return (
    <div
      id="app-rotating-loading-screen"
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 via-sky-50/40 to-slate-100 text-slate-800 select-none animate-in fade-in duration-300"
    >
      <div className="relative flex items-center justify-center">
        {/* Rotating Clinic Logo */}
        <img
          src="/clinic_logo.png"
          alt="Namana Physiotherapy Clinic Logo"
          className="w-24 h-24 sm:w-28 sm:h-28 object-contain rounded-full shadow-lg animate-[spin_3.5s_linear_infinite] will-change-transform"
          referrerPolicy="no-referrer"
        />
      </div>

      {/* Clinic branding & status message */}
      <div className="mt-8 text-center px-4 max-w-sm">
        <h2 className="text-base sm:text-lg font-extrabold text-sky-950 tracking-tight">
          {message}
        </h2>
        <div className="mt-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-sky-600">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping" />
          <span>{subMessage}</span>
        </div>
      </div>

      {/* Progress indicator bar */}
      <div className="mt-6 w-40 sm:w-48 h-1 bg-slate-200/80 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-sky-400 via-teal-400 to-sky-600 rounded-full w-2/3 animate-[pulse_1.5s_ease-in-out_infinite]" />
      </div>
    </div>
  );
};
