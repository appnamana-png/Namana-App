import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Stethoscope, CheckCircle2, RotateCcw, UserPlus } from 'lucide-react';
import { getCommonReferralDoctors, saveCommonReferralDoctors } from '../utils/storage';

interface ManageReferralDoctorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDoctorsUpdated: (updatedList: string[]) => void;
  currentSelectedDoc?: string;
  onSelectDoctor?: (docName: string) => void;
}

export const ManageReferralDoctorsModal: React.FC<ManageReferralDoctorsModalProps> = ({
  isOpen,
  onClose,
  onDoctorsUpdated,
  currentSelectedDoc,
  onSelectDoctor,
}) => {
  const [doctors, setDoctors] = useState<string[]>([]);
  const [newDoctorName, setNewDoctorName] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      const list = getCommonReferralDoctors();
      setDoctors(list);
      setNewDoctorName('');
      setError('');
      setSuccessMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddDoctor = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newDoctorName.trim();
    if (!trimmed) {
      setError('Please enter doctor name or hospital/specialty title');
      return;
    }
    if (doctors.some((d) => d.toLowerCase() === trimmed.toLowerCase())) {
      setError('This doctor is already in the referral directory');
      return;
    }

    const updated = [...doctors, trimmed];
    saveCommonReferralDoctors(updated);
    setDoctors(updated);
    onDoctorsUpdated(updated);
    if (onSelectDoctor) {
      onSelectDoctor(trimmed);
    }
    setNewDoctorName('');
    setError('');
    setSuccessMsg(`Added "${trimmed}" to referral directory`);
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const handleRemoveDoctor = (docToRemove: string) => {
    const updated = doctors.filter((d) => d !== docToRemove);
    saveCommonReferralDoctors(updated);
    setDoctors(updated);
    onDoctorsUpdated(updated);
    setSuccessMsg(`Removed "${docToRemove}"`);
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const handleRestoreDefaults = () => {
    const defaults = [
      'Self / Direct',
      'Dr. Suresh (Orthopedic)',
      'Dr. Ramesh (Neurologist)',
      'Dr. Priya (General Physician)',
      'Dr. Anand (Spine Specialist)',
      'Dr. Manjunath (Physician)',
    ];
    saveCommonReferralDoctors(defaults);
    setDoctors(defaults);
    onDoctorsUpdated(defaults);
    setSuccessMsg('Restored default referral doctor list');
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full border border-sky-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-sky-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-800 rounded-xl">
              <Stethoscope className="w-5 h-5 text-sky-200" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base tracking-tight">
                Manage Referral Doctors
              </h3>
              <p className="text-xs text-sky-200">
                Add or remove referring physicians & specialists
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-sky-800 rounded-xl transition-colors cursor-pointer text-sky-200 hover:text-white"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form to Add New Doctor */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-sky-50/50">
          <form onSubmit={handleAddDoctor} className="space-y-2">
            <label className="block text-xs font-bold text-sky-950">
              Add New Referring Doctor
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newDoctorName}
                onChange={(e) => {
                  setNewDoctorName(e.target.value);
                  if (error) setError('');
                }}
                placeholder="e.g. Dr. Kavya (Neuro Specialist)"
                className="flex-1 px-3.5 py-2 bg-white border border-sky-200 rounded-xl text-xs font-semibold text-slate-900 focus:border-sky-500 focus:ring-1 focus:ring-sky-200 outline-none shadow-2xs"
                autoFocus
              />
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Doctor</span>
              </button>
            </div>
            {error && <p className="text-[11px] font-bold text-rose-600 mt-1">{error}</p>}
            {successMsg && (
              <p className="text-[11px] font-bold text-emerald-600 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{successMsg}</span>
              </p>
            )}
          </form>
        </div>

        {/* Existing Doctors List */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Saved Doctors ({doctors.length})
            </span>
            <button
              type="button"
              onClick={handleRestoreDefaults}
              className="text-[11px] font-bold text-slate-500 hover:text-sky-700 flex items-center gap-1 cursor-pointer transition-colors"
              title="Reset to recommended default doctors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Restore Defaults</span>
            </button>
          </div>

          {doctors.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <UserPlus className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-semibold">No doctors currently added.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Use the form above to add one.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {doctors.map((doc) => {
                const isSelected = currentSelectedDoc === doc;
                return (
                  <div
                    key={doc}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-sky-50/80 border-sky-300 shadow-2xs'
                        : 'bg-white hover:bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <Stethoscope className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <span className="text-xs font-bold text-slate-800 truncate">{doc}</span>
                      {isSelected && (
                        <span className="text-[10px] font-extrabold px-1.5 py-0.2 bg-sky-200 text-sky-800 rounded">
                          Selected
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {onSelectDoctor && !isSelected && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectDoctor(doc);
                            onClose();
                          }}
                          className="px-2 py-1 text-[11px] font-bold text-sky-700 hover:bg-sky-100 rounded-lg transition-colors cursor-pointer"
                        >
                          Select
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveDoctor(doc)}
                        className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                        title={`Remove "${doc}"`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
