import React, { useState } from 'react';
import { X, Plus, Trash2, Check, Sparkles, Activity, AlertCircle } from 'lucide-react';
import { DEFAULT_FOLLOW_UP_TREATMENTS } from '../utils/storage';

interface ManageTreatmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  treatments: string[];
  onAddTreatment: (name: string) => void;
  onDeleteTreatment: (name: string) => void;
  onResetDefaults?: () => void;
}

export const ManageTreatmentsModal: React.FC<ManageTreatmentsModalProps> = ({
  isOpen,
  onClose,
  treatments,
  onAddTreatment,
  onDeleteTreatment,
  onResetDefaults,
}) => {
  const [newInput, setNewInput] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newInput.trim();
    if (!trimmed) return;
    onAddTreatment(trimmed);
    setNewInput('');
  };

  return (
    <div
      id="manage-treatments-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="manage-treatments-modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-treatments-title"
        className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-sky-50 via-white to-blue-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 id="manage-treatments-title" className="text-base font-bold text-slate-800">
                Manage Follow-up Treatments
              </h3>
              <p className="text-xs text-slate-500">
                Add your clinic's custom modalities or remove unused treatments
              </p>
            </div>
          </div>
          <button
            id="close-manage-treatments-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add Treatment Input Form */}
        <div className="p-4 bg-slate-50/80 border-b border-slate-100">
          <form onSubmit={handleAdd} className="flex gap-2">
            <input
              id="new-treatment-input"
              type="text"
              value={newInput}
              onChange={(e) => setNewInput(e.target.value)}
              placeholder="e.g. Shockwave Therapy, Laser Therapy, Acupressure..."
              className="flex-1 px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 text-slate-800 placeholder-slate-400 shadow-2xs font-medium"
              autoFocus
            />
            <button
              id="submit-add-treatment-btn"
              type="submit"
              disabled={!newInput.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Treatment
            </button>
          </form>
        </div>

        {/* Treatments List */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100">
          <div className="flex items-center justify-between pb-2 mb-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Available Modalities ({treatments.length})
            </span>
            <span className="text-[11px] text-slate-400">
              Synced with Google Sheets & backups
            </span>
          </div>

          {treatments.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              No treatments defined. Type a name above to add one!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              {treatments.map((treatment) => {
                const isConfirming = confirmDelete === treatment;
                return (
                  <div
                    key={treatment}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs transition-all ${
                      isConfirming
                        ? 'bg-rose-50 border-rose-200'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <span className="font-semibold text-slate-700 truncate pr-2" title={treatment}>
                      {treatment}
                    </span>

                    {isConfirming ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteTreatment(treatment);
                            setConfirmDelete(null);
                          }}
                          className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded-md transition-colors cursor-pointer"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(null)}
                          className="px-1.5 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-medium rounded-md transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(treatment)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                        title={`Delete "${treatment}"`}
                        aria-label={`Delete ${treatment}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-sky-500" />
            Changes take effect immediately across all follow-ups
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
