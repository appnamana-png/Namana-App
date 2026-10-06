import React, { useState } from 'react';
import { AlertOctagon, KeyRound, Eye, EyeOff, X, Trash2, AlertTriangle } from 'lucide-react';

interface PermanentDeleteModalProps {
  isOpen: boolean;
  count: number;
  patientNames?: string[];
  onSuccess: () => void;
  onClose: () => void;
}

const STATIC_PERMANENT_DELETE_PASSKEY = '9880517715';

export const PermanentDeleteModal: React.FC<PermanentDeleteModalProps> = ({
  isOpen,
  count,
  patientNames = [],
  onSuccess,
  onClose,
}) => {
  const [passkey, setPasskey] = useState('');
  const [showPasskey, setShowPasskey] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passkey.trim() === STATIC_PERMANENT_DELETE_PASSKEY) {
      setError('');
      setPasskey('');
      onSuccess();
    } else {
      setError('Incorrect passkey. Permanent deletion aborted.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-200 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-100 text-rose-700 rounded-2xl border border-rose-200 shrink-0">
              <AlertOctagon className="w-6 h-6 text-rose-600 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-950">
                Permanent Deletion Warning
              </h3>
              <p className="text-xs text-rose-600 font-semibold mt-0.5">
                Irreversible Action • Passkey Required
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning Details */}
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <p className="font-semibold leading-relaxed">
              You are about to <span className="font-black text-rose-700 underline">permanently erase {count} patient record{count !== 1 ? 's' : ''}</span> from the system storage.
            </p>
          </div>
          <p className="text-[11px] text-rose-700 pl-6 leading-relaxed">
            This will permanently erase all clinical assessment notes, follow-up session histories, fee records, and receipts. This operation <span className="font-bold">CANNOT BE UNDONE</span>.
          </p>
          {patientNames.length > 0 && (
            <div className="pl-6 pt-1">
              <div className="text-[10.5px] font-bold text-slate-700 mb-1">Selected patients:</div>
              <div className="max-h-20 overflow-y-auto space-y-0.5 text-[11px] text-slate-600 font-mono bg-white/80 p-2 rounded-lg border border-rose-100">
                {patientNames.map((name, i) => (
                  <div key={i} className="truncate">• {name}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Passkey Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Enter Static Security Passkey:
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4 text-rose-500" />
              </div>
              <input
                type={showPasskey ? 'text' : 'password'}
                value={passkey}
                onChange={(e) => {
                  setPasskey(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Enter 10-digit passkey"
                autoFocus
                className={`w-full pl-10 pr-10 py-2.5 bg-slate-50 border rounded-xl text-sm font-mono tracking-widest text-slate-900 placeholder:text-slate-400 placeholder:tracking-normal focus:outline-none focus:ring-2 transition-all ${
                  error
                    ? 'border-rose-300 focus:ring-rose-500 bg-rose-50/50'
                    : 'border-slate-300 focus:ring-rose-500 focus:bg-white'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPasskey(!showPasskey)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}
              >
                {showPasskey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && (
              <p className="text-xs text-rose-600 font-bold flex items-center gap-1 mt-1">
                <span>✕</span> {error}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!passkey.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Confirm & Permanently Delete</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
