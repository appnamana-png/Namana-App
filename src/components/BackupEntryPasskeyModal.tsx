import React, { useState } from 'react';
import { ShieldAlert, KeyRound, Eye, EyeOff, X, AlertTriangle } from 'lucide-react';

interface BackupEntryPasskeyModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onClose: () => void;
}

const STATIC_ENTRY_PASSKEY = '9880517715';

export const BackupEntryPasskeyModal: React.FC<BackupEntryPasskeyModalProps> = ({
  isOpen,
  onSuccess,
  onClose,
}) => {
  const [passkey, setPasskey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (passkey.trim() === STATIC_ENTRY_PASSKEY) {
      setError(null);
      setPasskey('');
      onSuccess();
    } else {
      setError('Access Denied: Incorrect static entry passkey.');
    }
  };

  const handleClose = () => {
    setPasskey('');
    setError(null);
    onClose();
  };

  return (
    <div
      id="backup-entry-passkey-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="backup-entry-title"
    >
      <div
        id="backup-entry-passkey-card"
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-amber-200 overflow-hidden"
      >
        {/* Warning Banner Header */}
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-800/40 rounded-xl">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 id="backup-entry-title" className="text-base font-bold tracking-tight text-white leading-tight">
                Security Warning
              </h2>
              <p className="text-xs text-amber-100 font-medium">
                Protected Backup &amp; Cloud Database Area
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-amber-800/40 text-amber-100 hover:text-white transition-colors cursor-pointer"
            aria-label="Cancel access"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs leading-relaxed flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">You are entering the Backup &amp; Restore section.</p>
              <p className="mt-1 text-amber-800">
                This administrative section controls cloud synchronization, sheet pulls, database replacement, and data exports. Please verify authorized ownership by entering the entry passkey.
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="backup-entry-passkey-input" className="block text-xs font-bold text-slate-700 mb-1.5">
              Enter Section Passkey
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                id="backup-entry-passkey-input"
                type={showPassword ? 'text' : 'password'}
                value={passkey}
                onChange={(e) => {
                  setPasskey(e.target.value);
                  if (error) setError(null);
                }}
                autoFocus
                placeholder="Enter passkey to proceed"
                className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono tracking-wider text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                title={showPassword ? 'Hide passkey' : 'Show passkey'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && (
              <p className="mt-1.5 text-xs font-semibold text-rose-600 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                {error}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              id="backup-entry-cancel-btn"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="backup-entry-submit-btn"
              className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Authorize &amp; Enter
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
