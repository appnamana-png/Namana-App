import React, { useState, useEffect } from 'react';
import {
  X,
  Smartphone,
  Download,
  Share2,
  CheckCircle2,
  ExternalLink,
  Copy,
  Info,
  ShieldCheck,
  Zap,
  ArrowRight,
  Globe,
  Settings
} from 'lucide-react';
import { ClinicLogo } from './ClinicLogo';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  apkDownloadUrl?: string;
  onSaveApkDownloadUrl?: (url: string) => void;
}

export function formatApkDownloadUrl(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  // Automatically convert Google Drive view links to direct binary download links
  const gDriveMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (gDriveMatch && gDriveMatch[1]) {
    return `https://drive.google.com/uc?export=download&id=${gDriveMatch[1]}`;
  }
  const gDriveOpenMatch = trimmed.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (gDriveOpenMatch && gDriveOpenMatch[1]) {
    return `https://drive.google.com/uc?export=download&id=${gDriveOpenMatch[1]}`;
  }
  // Convert Dropbox view link to direct download
  if (trimmed.includes('dropbox.com') && trimmed.includes('dl=0')) {
    return trimmed.replace('dl=0', 'dl=1');
  }
  return trimmed;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({
  isOpen,
  onClose,
  apkDownloadUrl,
  onSaveApkDownloadUrl,
}) => {
  const { isInstallable, isInstalled, isAndroid, isIOS, install } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'direct' | 'apk' | 'share' | 'ios'>(
    isIOS ? 'ios' : 'apk'
  );
  const [installStatus, setInstallStatus] = useState<'idle' | 'installing' | 'success' | 'dismissed'>('idle');
  const [copiedLink, setCopiedLink] = useState(false);
  const [customApkUrl, setCustomApkUrl] = useState(apkDownloadUrl || '');
  const [isEditingApkUrl, setIsEditingApkUrl] = useState(false);

  useEffect(() => {
    if (apkDownloadUrl !== undefined) {
      setCustomApkUrl(apkDownloadUrl);
    }
  }, [apkDownloadUrl]);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.origin : 'https://jolly-puppy-6c96b2.netlify.app';
  const effectiveApkUrl = formatApkDownloadUrl(customApkUrl.trim());

  // Handle direct 1-tap browser prompt installation
  const handleTriggerInstall = async () => {
    if (isInstallable) {
      setInstallStatus('installing');
      const res = await install();
      if (res === 'accepted') {
        setInstallStatus('success');
      } else if (res === 'dismissed') {
        setInstallStatus('dismissed');
      } else {
        setInstallStatus('idle');
      }
    } else {
      // If native browser prompt is unavailable (already fired once or not supported), show step-by-step
      setActiveTab('direct');
    }
  };

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(currentUrl).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      });
    }
  };

  const handleSaveApkUrl = () => {
    onSaveApkDownloadUrl?.(customApkUrl.trim());
    setIsEditingApkUrl(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-sky-100 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-sky-600 via-sky-700 to-indigo-700 text-white p-4 sm:p-5 relative shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white/10 p-1 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
                <ClinicLogo className="w-full h-full" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black tracking-tight leading-tight">
                    Install Clinic App & APK
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-400 text-emerald-950 uppercase tracking-wide">
                    Unlimited
                  </span>
                </div>
                <p className="text-xs text-sky-100 font-medium mt-0.5">
                  Direct installation for any visiting phone, tablet, or doctor
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
              title="Close"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 mt-4 p-1 bg-sky-900/40 backdrop-blur-md rounded-xl text-xs font-bold overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab('apk')}
              className={`flex-1 py-1.5 px-2.5 rounded-lg transition-all whitespace-nowrap flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'apk'
                  ? 'bg-white text-sky-900 shadow-sm'
                  : 'text-sky-100 hover:text-white hover:bg-white/10'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download APK</span>
            </button>

            <button
              onClick={() => setActiveTab('direct')}
              className={`flex-1 py-1.5 px-2.5 rounded-lg transition-all whitespace-nowrap flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'direct'
                  ? 'bg-white text-sky-900 shadow-sm'
                  : 'text-sky-100 hover:text-white hover:bg-white/10'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>1-Tap Phone Install</span>
            </button>

            <button
              onClick={() => setActiveTab('share')}
              className={`flex-1 py-1.5 px-2.5 rounded-lg transition-all whitespace-nowrap flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'share'
                  ? 'bg-white text-sky-900 shadow-sm'
                  : 'text-sky-100 hover:text-white hover:bg-white/10'
              }`}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share to Phone</span>
            </button>

            {isIOS && (
              <button
                onClick={() => setActiveTab('ios')}
                className={`flex-1 py-1.5 px-2.5 rounded-lg transition-all whitespace-nowrap flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'ios'
                    ? 'bg-white text-sky-900 shadow-sm'
                    : 'text-sky-100 hover:text-white hover:bg-white/10'
                }`}
              >
                <span>iPhone / iPad</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-slate-700 text-sm">
          {/* Status Message if already installed */}
          {isInstalled && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>App is currently installed and running on this device!</strong> You can still install on any other visiting phone, tablet, or PC without restriction.
              </span>
            </div>
          )}

          {/* TAB 1: DIRECT 1-TAP INSTALLATION */}
          {activeTab === 'direct' && (
            <div className="space-y-4">
              {/* Primary 1-Tap Trigger Button */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-sky-50 to-indigo-50 border border-sky-100 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                      Direct Phone Installation (WebAPK)
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Installs the full clinical application directly onto your Android phone's home screen with clinic logo, offline patient access, and zero browser address bar.
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-200/80 text-sky-800">
                    Recommended
                  </span>
                </div>

                {/* Instant Action Button */}
                {isInstallable ? (
                  <button
                    type="button"
                    onClick={handleTriggerInstall}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-sm sm:text-base shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                  >
                    <Smartphone className="w-5 h-5" />
                    <span>Install App on This Phone Now</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="p-3 bg-white rounded-xl border border-sky-200 shadow-2xs space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-sky-950">
                      <Info className="w-4 h-4 text-sky-600 shrink-0" />
                      <span>How to Install on Any Visiting Phone in 5 Seconds:</span>
                    </div>
                    <ol className="space-y-1.5 text-xs text-slate-700 list-decimal list-inside pl-1 font-medium">
                      <li>
                        Tap the browser menu <strong className="text-slate-900 font-bold">(three vertical dots ⋮)</strong> in the top-right corner of Chrome.
                      </li>
                      <li>
                        Tap <strong className="text-emerald-700 font-bold">"Install app"</strong> or <strong className="text-emerald-700 font-bold">"Add to Home screen"</strong>.
                      </li>
                      <li>
                        Confirm <strong className="text-slate-900 font-bold">"Install"</strong>. Android will build and pin the app icon directly on your phone!
                      </li>
                    </ol>
                  </div>
                )}

                {installStatus === 'success' && (
                  <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-900 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    <span>Installation started successfully! Check your phone's home screen or app drawer.</span>
                  </div>
                )}
              </div>

              {/* Universal Android Browser Compatibility Guide */}
              <div className="rounded-xl border border-slate-200 p-3.5 space-y-2.5 bg-slate-50">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Works on All Android Browsers Without Limit:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <strong className="text-slate-900 font-bold block mb-1">Google Chrome / Edge</strong>
                    <span className="text-slate-600">Menu (⋮) &gt; Tap "Install app" or "Add to Home screen"</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <strong className="text-slate-900 font-bold block mb-1">Samsung Internet</strong>
                    <span className="text-slate-600">Menu (≡) &gt; Tap "+ Add page to" &gt; "Home screen"</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DIRECT APK DOWNLOAD */}
          {activeTab === 'apk' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-extrabold text-amber-950 text-sm sm:text-base flex items-center gap-1.5">
                      <Download className="w-4 h-4 text-amber-600" />
                      Android App & APK Installation
                    </h3>
                    <p className="text-xs text-amber-800 mt-1">
                      Get the Namana Clinic app on any visiting phone or tablet. Works on all Android devices.
                    </p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-200 text-amber-900 shrink-0">
                    Unlimited
                  </span>
                </div>

                <div className="space-y-3 pt-1">
                  {/* Method 1: If custom APK is configured, show Direct Download */}
                  {customApkUrl.trim() && (
                    <a
                      href={effectiveApkUrl}
                      download="NamanaPhysioClinic.apk"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold text-sm sm:text-base shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                    >
                      <Download className="w-5 h-5 shrink-0" />
                      <span>Download NamanaPhysioClinic.apk</span>
                    </a>
                  )}

                  {/* Method 2: Direct 1-Tap Browser WebAPK Installation (Preferred on Mobile) */}
                  <button
                    type="button"
                    onClick={handleTriggerInstall}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-sky-600 via-indigo-600 to-sky-700 hover:from-sky-700 hover:to-indigo-800 text-white font-extrabold text-sm sm:text-base shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    <Smartphone className="w-5 h-5 shrink-0" />
                    <span>1-Tap Install Directly on Phone (WebAPK)</span>
                  </button>

                  {/* Method 3: PWABuilder Cloud APK Generator */}
                  <a
                    href={`https://www.pwabuilder.com/?url=${encodeURIComponent(currentUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-50 border-2 border-emerald-500 text-emerald-800 font-extrabold text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    <Download className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Generate / Download APK via PWABuilder</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </a>

                  <p className="text-[11px] text-amber-900 text-center font-medium">
                    WebAPK creates a native Android app with clinic logo, offline access, and zero browser address bar.
                  </p>
                </div>

                {/* Clear Step-by-Step for Chrome Mobile */}
                <div className="text-[11px] text-amber-900 space-y-1.5 bg-white/80 p-3 rounded-xl border border-amber-200">
                  <p className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                    How to Install on Phone in 5 Seconds:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-800 pl-0.5">
                    <li>Open <strong>{currentUrl}</strong> in <strong>Google Chrome</strong> on the phone.</li>
                    <li>Tap the <strong>three dots menu (⋮)</strong> at top-right in Chrome.</li>
                    <li>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</li>
                    <li>Tap <strong>Install</strong> — Chrome pins the clinic app to your home screen!</li>
                  </ol>
                </div>
              </div>

              {/* Custom APK URL Configuration */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5 text-slate-500" />
                    Custom APK Direct Link (Google Drive / Cloud)
                  </span>
                  {!isEditingApkUrl && (
                    <button
                      type="button"
                      onClick={() => setIsEditingApkUrl(true)}
                      className="text-sky-600 hover:text-sky-800 font-bold text-[11px] cursor-pointer"
                    >
                      {customApkUrl.trim() ? 'Change Link' : 'Add Link'}
                    </button>
                  )}
                </div>

                {isEditingApkUrl ? (
                  <div className="space-y-2">
                    <input
                      type="url"
                      value={customApkUrl}
                      onChange={(e) => setCustomApkUrl(e.target.value)}
                      placeholder="Paste Google Drive link or direct .apk link"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                    <p className="text-[10px] text-slate-500">
                      Supports Google Drive view links (auto-converts to direct download) or direct .apk URLs.
                    </p>
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setIsEditingApkUrl(false)}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveApkUrl}
                        className="px-3 py-1 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white rounded-lg cursor-pointer"
                      >
                        Save APK Link
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-600 truncate">
                    {customApkUrl.trim() ? (
                      <span className="font-mono text-emerald-700 font-semibold">Active: {effectiveApkUrl}</span>
                    ) : (
                      <span>No custom APK link set. Using 1-Tap WebAPK and PWABuilder.</span>
                    )}
                  </p>
                )}
              </div>

              {/* Guide for hosting APK when GitHub rejects large files */}
              <div className="p-3.5 bg-sky-50/80 rounded-xl border border-sky-200 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-extrabold text-sky-950">
                  <Info className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>Cannot upload large files to GitHub? 3 Best Ways to Host Your APK:</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  GitHub blocks git commits containing files larger than 100 MB. Never run <code className="bg-sky-100 px-1 py-0.5 rounded font-mono text-sky-900">git add file.apk</code> in Git. Instead, use one of these 3 free, instant options:
                </p>
                <div className="space-y-1.5 text-[11px] text-slate-700">
                  <div className="p-2.5 bg-white rounded-lg border border-sky-100 shadow-2xs">
                    <strong className="text-slate-900 block mb-0.5">1. PWABuilder (Instant Cloud APK — No GitHub upload):</strong>
                    <span className="text-slate-600">
                      Open <a href="https://www.pwabuilder.com" target="_blank" rel="noreferrer" className="underline text-sky-600 font-bold">PWABuilder.com</a>, enter <code className="font-mono text-sky-800">{currentUrl}</code>, select Android, and download the ready-to-use APK directly to your device.
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-sky-100 shadow-2xs">
                    <strong className="text-slate-900 block mb-0.5">2. Google Drive (Direct 1-Click Link — Up to 15 GB):</strong>
                    <span className="text-slate-600">
                      Upload your built APK to Google Drive, right-click &gt; <em>Share</em> &gt; set to <em>"Anyone with the link"</em>, copy the link and paste it into the <strong>Custom APK Direct Link</strong> box above. The app will automatically convert it into a direct 1-tap download!
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-sky-100 shadow-2xs">
                    <strong className="text-slate-900 block mb-0.5">3. GitHub Releases (Up to 2 GB per file):</strong>
                    <span className="text-slate-600">
                      Do not commit the APK into Git. Instead, go to your GitHub repo in a browser &gt; click <strong>Releases</strong> &gt; <strong>Draft a new release</strong> &gt; drag &amp; drop the APK file into the <em>Attach binaries</em> box. Copy that release link and paste it into the box above.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SHARE TO VISITING PHONES */}
          {activeTab === 'share' && (
            <div className="space-y-4">
              <div className="text-center p-4 bg-sky-50/60 rounded-2xl border border-sky-100 space-y-3">
                <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                  Instant Install on Any Visiting Phone
                </h3>
                <p className="text-xs text-slate-600 max-w-sm mx-auto">
                  Any doctor, staff member, or patient can point their mobile phone camera at this QR code to immediately open and install the app!
                </p>

                {/* Instant SVG QR Code */}
                <div className="flex flex-col items-center justify-center p-3 bg-white rounded-2xl shadow-xs border border-sky-200 w-fit mx-auto">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                      currentUrl
                    )}`}
                    alt="Scan to Install Clinic App"
                    className="w-40 h-40 object-contain rounded-lg"
                    loading="lazy"
                  />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-2">
                    Scan with Phone Camera
                  </span>
                </div>

                {/* Copy Website Link Button */}
                <div className="flex items-center gap-2 max-w-md mx-auto">
                  <input
                    type="text"
                    readOnly
                    value={currentUrl}
                    className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-800 select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs shrink-0"
                  >
                    {copiedLink ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: IPHONE / IPAD (IOS SAFARI) */}
          {activeTab === 'ios' && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-sky-600" />
                Install on iPhone or iPad (Safari)
              </h3>
              <p className="text-xs text-slate-600">
                Apple requires installing via Safari's Share menu:
              </p>
              <div className="space-y-2 text-xs">
                <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-sky-100 text-sky-800 font-bold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span>
                    Tap the <strong>Share button</strong> (square with arrow pointing up) at the bottom of Safari.
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-sky-100 text-sky-800 font-bold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span>
                    Scroll down and tap <strong>"Add to Home Screen"</strong> with the plus (+) icon.
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-sky-100 text-sky-800 font-bold flex items-center justify-center shrink-0">
                    3
                  </span>
                  <span>
                    Tap <strong>"Add"</strong> in the top-right corner. The Namana Clinic icon will appear on your iPhone screen!
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
          <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
            Offline ready • Automatic hourly backup • Full patient privacy
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer ml-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
