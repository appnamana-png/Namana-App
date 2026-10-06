import React from 'react';
import { Users, Calendar, IndianRupee, FileSpreadsheet, UserCheck, Smartphone, Download } from 'lucide-react';
import { ClinicLogo } from './ClinicLogo';
import { WaterBackupNavButton } from './WaterBackupNavButton';

export type MainView = 'patients' | 'monthly' | 'fees' | 'itreturn' | 'backup' | 'locum';

interface HeaderProps {
  currentView: MainView;
  onSelectView: (view: MainView) => void;
  clinicName?: string;
  totalPatientsCount?: number;
  activePatientsCount?: number;
  deletedPatientsCount?: number;
  onSelectPatientStatus?: (status: 'all' | 'active' | 'deleted') => void;
  onOpenInstallModal?: () => void;
  isInstalled?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onSelectView,
  clinicName = "Namana Physiotherapy Clinic",
  totalPatientsCount = 0,
  activePatientsCount = 0,
  deletedPatientsCount = 0,
  onSelectPatientStatus,
  onOpenInstallModal,
  isInstalled = false,
}) => {
  return (
    <header className="h-14 sm:h-15 md:h-16 bg-white/95 backdrop-blur-md border-b border-sky-100 px-2 sm:px-3 md:px-3 lg:px-6 xl:px-8 flex items-center justify-between flex-nowrap shrink-0 sticky top-0 z-30 shadow-xs text-slate-800 w-full overflow-hidden select-none">
      {/* Clinic Name & Logo Header Region - Single Line Protected */}
      <div className="flex items-center gap-1.5 sm:gap-2 md:gap-2.5 shrink-0 z-20 min-w-0">
        {/* Clinic Name Branding Button */}
        <button
          type="button"
          id="header-home-logo-btn"
          className="flex items-center gap-1.5 sm:gap-2 md:gap-2.5 cursor-pointer select-none py-1 text-left group focus:outline-none focus:ring-2 focus:ring-sky-400 rounded-xl transition-all shrink-0 min-w-0"
          onClick={() => {
            onSelectView('patients');
            onSelectPatientStatus?.('all');
          }}
          title={`${clinicName} - Click to Return to Home / Patient Directory`}
          aria-label="Return to Home Screen"
        >
          {/* Fluid Logo scaling on mobile, tablet, desktop */}
          <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-8.5 md:h-8.5 lg:w-9.5 lg:h-9.5 shrink-0 drop-shadow-xs flex items-center justify-center group-hover:scale-105 transition-transform">
            <ClinicLogo className="w-full h-full" />
          </div>

          {/* Guaranteed Single Line Clinic Name & Sizing */}
          <div className="flex flex-col justify-center shrink-0 min-w-0">
            <h1 className="text-xs sm:text-sm md:text-sm lg:text-base font-extrabold tracking-tight text-sky-950 leading-tight group-hover:text-sky-700 transition-colors whitespace-nowrap">
              <span className="hidden xl:inline">{clinicName}</span>
              <span className="hidden md:inline xl:hidden">Namana Physio Clinic</span>
              <span className="md:hidden font-bold">Namana Physio</span>
            </h1>
            <p className="hidden xl:block text-[8.5px] lg:text-[9.5px] font-bold tracking-wide uppercase whitespace-nowrap leading-tight mt-0.5 text-slate-500">
              <span className="text-rose-600">Remove pain, </span>
              <span className="text-emerald-600">Move Again</span>
            </p>
          </div>
        </button>
      </div>

      {/* Desktop & Tablet Navigation Tabs - Single Line Layout with Compact Spacing on Tab */}
      <nav className="hidden md:flex items-center gap-0.5 md:gap-1 lg:gap-1.5 shrink-0 flex-nowrap">
        <button
          id="nav-tab-patients"
          onClick={() => {
            onSelectView('patients');
            onSelectPatientStatus?.('all');
          }}
          className={`flex items-center gap-1 md:gap-1.5 px-1.5 md:px-2 lg:px-3 py-1 lg:py-1.5 rounded-xl text-[10.5px] md:text-[11px] lg:text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            currentView === 'patients'
              ? 'bg-sky-50 text-sky-800 border border-sky-200 shadow-xs'
              : 'text-slate-600 hover:bg-sky-50/70 hover:text-sky-900 border border-transparent'
          }`}
          title="Patient Directory"
        >
          <Users className="w-3.5 h-3.5 text-sky-600 shrink-0" />
          <span>Patients</span>
        </button>

        <button
          id="nav-tab-monthly"
          onClick={() => onSelectView('monthly')}
          className={`flex items-center gap-1 md:gap-1.5 px-1.5 md:px-2 lg:px-3 py-1 lg:py-1.5 rounded-xl text-[10.5px] md:text-[11px] lg:text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            currentView === 'monthly'
              ? 'bg-sky-50 text-sky-800 border border-sky-200 shadow-xs'
              : 'text-slate-600 hover:bg-sky-50/70 hover:text-sky-900 border border-transparent'
          }`}
          title="Monthly Analytics & Reports"
        >
          <Calendar className="w-3.5 h-3.5 text-sky-600 shrink-0" />
          <span className="inline lg:hidden">Monthly</span>
          <span className="hidden lg:inline">Monthly Data</span>
        </button>

        <button
          id="nav-tab-fees"
          onClick={() => onSelectView('fees')}
          className={`flex items-center gap-1 md:gap-1.5 px-1.5 md:px-2 lg:px-3 py-1 lg:py-1.5 rounded-xl text-[10.5px] md:text-[11px] lg:text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            currentView === 'fees'
              ? 'bg-sky-50 text-sky-800 border border-sky-200 shadow-xs'
              : 'text-slate-600 hover:bg-sky-50/70 hover:text-sky-900 border border-transparent'
          }`}
          title="Fee Collected Overview"
        >
          <IndianRupee className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="inline lg:hidden">Fees</span>
          <span className="hidden lg:inline">Fee Collected</span>
        </button>

        <button
          id="nav-tab-itreturn"
          onClick={() => onSelectView('itreturn')}
          className={`flex items-center justify-center gap-1 md:gap-1.5 px-1.5 md:px-2 lg:px-3 py-1 lg:py-1.5 rounded-xl text-[10.5px] md:text-[11px] lg:text-xs font-bold transition-all cursor-pointer whitespace-nowrap text-center shrink-0 ${
            currentView === 'itreturn'
              ? 'bg-sky-50 text-sky-800 border border-sky-200 shadow-xs'
              : 'text-slate-600 hover:bg-sky-50/70 hover:text-sky-900 border border-transparent'
          }`}
          title="Income Tax / Section 44ADA Return Audit"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span className="inline lg:hidden text-center">IT</span>
          <span className="hidden lg:inline text-center">IT Return</span>
        </button>

        <button
          id="nav-tab-locum"
          onClick={() => onSelectView('locum')}
          className={`flex items-center justify-center gap-1 md:gap-1.5 px-1.5 md:px-2 lg:px-3 py-1 lg:py-1.5 rounded-xl text-[10.5px] md:text-[11px] lg:text-xs font-bold transition-all cursor-pointer whitespace-nowrap text-center shrink-0 ${
            currentView === 'locum'
              ? 'bg-sky-50 text-sky-800 border border-sky-200 shadow-xs'
              : 'text-slate-600 hover:bg-sky-50/70 hover:text-sky-900 border border-transparent'
          }`}
          title="Locum Tenens Physiotherapists"
        >
          <UserCheck className="w-3.5 h-3.5 text-sky-600 shrink-0" />
          <span className="inline lg:hidden text-center">Locum</span>
          <span className="hidden lg:inline text-center">Locum Tenens</span>
        </button>

        <WaterBackupNavButton
          isActive={currentView === 'backup'}
          onClick={() => onSelectView('backup')}
        />

        {!isInstalled && onOpenInstallModal && (
          <button
            id="nav-btn-install-apk"
            type="button"
            onClick={onOpenInstallModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0 active:scale-95"
            title="Download APK / Install App on Phone & Tablet"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Download APK</span>
            <span className="sm:hidden">APK</span>
          </button>
        )}
      </nav>

      {/* Mobile Quick Navigation Bar - Strictly Single Line Guaranteed */}
      <div className="flex md:hidden items-center gap-0.5 sm:gap-1 shrink-0 border-l border-sky-100 pl-1 sm:pl-1.5 flex-nowrap">
        {!isInstalled && onOpenInstallModal && (
          <button
            id="nav-btn-install-apk-mobile"
            type="button"
            onClick={onOpenInstallModal}
            className="px-2 py-1 rounded-lg text-xs cursor-pointer transition-all shrink-0 flex items-center gap-1 text-center bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs font-extrabold active:scale-95"
            title="Download APK / Install App"
            aria-label="Download APK / Install App"
          >
            <Download className="w-3 h-3 text-white shrink-0" />
            <span className="text-[11px] font-bold">APK</span>
          </button>
        )}

        <button
          id="nav-tab-patients-mobile"
          type="button"
          onClick={() => {
            onSelectView('patients');
            onSelectPatientStatus?.('all');
          }}
          className={`p-1.5 rounded-lg text-xs cursor-pointer transition-colors shrink-0 flex items-center justify-center text-center ${
            currentView === 'patients' ? 'bg-sky-100 text-sky-800 font-bold shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Patients Directory"
          aria-label="Patients Directory"
        >
          <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-600" />
        </button>

        <button
          id="nav-tab-monthly-mobile"
          type="button"
          onClick={() => onSelectView('monthly')}
          className={`p-1.5 rounded-lg text-xs cursor-pointer transition-colors shrink-0 flex items-center justify-center text-center ${
            currentView === 'monthly' ? 'bg-sky-100 text-sky-800 font-bold shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Monthly Analytics"
          aria-label="Monthly Analytics"
        >
          <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-600" />
        </button>

        <button
          id="nav-tab-fees-mobile"
          type="button"
          onClick={() => onSelectView('fees')}
          className={`p-1.5 rounded-lg text-xs cursor-pointer transition-colors shrink-0 flex items-center justify-center text-center ${
            currentView === 'fees' ? 'bg-sky-100 text-sky-800 font-bold shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Fee Collected"
          aria-label="Fee Collected"
        >
          <IndianRupee className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
        </button>

        <button
          id="nav-tab-itreturn-mobile"
          type="button"
          onClick={() => onSelectView('itreturn')}
          className={`p-1.5 rounded-lg text-xs cursor-pointer transition-colors shrink-0 flex items-center justify-center text-center ${
            currentView === 'itreturn' ? 'bg-sky-100 text-sky-800 font-bold shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="IT Return"
          aria-label="IT Return"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />
        </button>

        <button
          id="nav-tab-locum-mobile"
          type="button"
          onClick={() => onSelectView('locum')}
          className={`p-1.5 rounded-lg text-xs cursor-pointer transition-colors shrink-0 flex items-center justify-center text-center ${
            currentView === 'locum'
              ? 'bg-sky-100 text-sky-800 font-bold ring-1 ring-sky-300 shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Locum Tenens Physiotherapists"
          aria-label="Locum Tenens Physiotherapists"
        >
          <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-700" />
        </button>

        <WaterBackupNavButton
          isMobile
          isActive={currentView === 'backup'}
          onClick={() => onSelectView('backup')}
        />
      </div>
    </header>
  );
};

