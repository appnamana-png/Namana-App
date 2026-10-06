import React from 'react';
import { X, TrendingDown, Activity, CheckCircle2, ArrowRight, Sparkles, Calendar } from 'lucide-react';
import { Patient } from '../types';
import { getPainSeverityInfo, calculatePainImprovement } from './PainScaleComponent';

interface PainImprovementModalProps {
  isOpen: boolean;
  patient: Patient;
  onClose: () => void;
}

export const PainImprovementModal: React.FC<PainImprovementModalProps> = ({ isOpen, patient, onClose }) => {
  // Support Escape key to close modal
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const initialBefore = patient.painScaleBefore !== undefined ? Number(patient.painScaleBefore) : undefined;
  const initialAfter = patient.painScaleAfter !== undefined ? Number(patient.painScaleAfter) : undefined;
  const initialImp = calculatePainImprovement(initialBefore, initialAfter);

  // Collect all follow up data
  const followUps = patient.followUps || [];

  // Find latest recorded pain score
  let latestPainScore: number | undefined = undefined;
  for (let i = followUps.length - 1; i >= 0; i--) {
    const fu = followUps[i];
    if (fu.painScaleAfter !== undefined) {
      latestPainScore = Number(fu.painScaleAfter);
      break;
    }
    if (fu.painScaleBefore !== undefined) {
      latestPainScore = Number(fu.painScaleBefore);
      break;
    }
    if (fu.painScale !== undefined) {
      latestPainScore = Number(fu.painScale);
      break;
    }
  }
  if (latestPainScore === undefined) {
    latestPainScore = initialAfter !== undefined ? initialAfter : initialBefore;
  }

  // Total journey improvement from Day 1 to Latest
  const overallJourneyImp =
    initialBefore !== undefined && latestPainScore !== undefined
      ? calculatePainImprovement(initialBefore, latestPainScore)
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-sky-100 space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600 shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Pain Scale Improvement & Recovery Analysis
              </h3>
              <p className="text-xs text-slate-500">
                Patient: <b className="text-slate-800">{patient.name || 'Patient'}</b> (Reg No: {patient.regNo || '—'}) • Diagnosis: <span className="font-semibold text-sky-900">{patient.diagnosis || 'Clinical Diagnosis'}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Overall Recovery Summary Card */}
        {overallJourneyImp && (
          <div className="p-4 bg-linear-to-r from-emerald-50 via-teal-50 to-sky-50 border border-emerald-200 rounded-2xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                  Total Rehabilitation Trajectory
                </span>
              </div>
              <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-emerald-600 text-white shadow-2xs">
                {overallJourneyImp.diff > 0
                  ? `${overallJourneyImp.percent}% Total Pain Relief Achieved`
                  : 'Stable Condition'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                <p className="text-[10px] text-slate-500 font-bold uppercase">Day 1 Initial Pain</p>
                <p className="text-lg font-black text-rose-600 font-mono">{overallJourneyImp.before}/10</p>
                <p className="text-[10px] text-slate-600 font-medium">{getPainSeverityInfo(overallJourneyImp.before).label}</p>
              </div>

              <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100 flex flex-col items-center justify-center">
                <p className="text-[10px] text-slate-500 font-bold uppercase">Net Improvement</p>
                <p className="text-lg font-black text-emerald-600 font-mono">
                  {overallJourneyImp.diff > 0 ? `-${overallJourneyImp.diff} pts` : `${overallJourneyImp.diff} pts`}
                </p>
                <p className="text-[10px] text-emerald-700 font-bold">
                  {overallJourneyImp.diff > 0 ? 'Relief' : 'No Change'}
                </p>
              </div>

              <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                <p className="text-[10px] text-slate-500 font-bold uppercase">Current / Latest Pain</p>
                <p className="text-lg font-black text-sky-700 font-mono">{overallJourneyImp.after}/10</p>
                <p className="text-[10px] text-slate-600 font-medium">{getPainSeverityInfo(overallJourneyImp.after).label}</p>
              </div>
            </div>
          </div>
        )}

        {/* Chronological Sessions Timeline */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
            Session-by-Session Pain Scores & Modalities
          </h4>

          {/* Initial Visit */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 font-bold text-[11px]">
                  Initial Evaluation
                </span>
                <span className="font-semibold text-slate-700">{patient.date}</span>
              </div>
              {initialImp && (
                <span className="text-[11px] font-extrabold text-emerald-700">
                  {initialImp.diff > 0 ? `Reduced by ${initialImp.diff} pts (${initialImp.percent}%)` : 'Baseline recorded'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Before:</span>
                <span className="font-bold font-mono px-2 py-0.5 rounded bg-white border border-slate-200">
                  {initialBefore !== undefined ? `${initialBefore}/10` : 'Not recorded'}
                </span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">After:</span>
                <span className="font-bold font-mono px-2 py-0.5 rounded bg-white border border-slate-200">
                  {initialAfter !== undefined ? `${initialAfter}/10` : 'Not recorded'}
                </span>
              </div>
            </div>
          </div>

          {/* Follow-up Visits */}
          {followUps.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
              No follow-up sessions logged yet. Record follow-up visits in Step 3 to build the recovery graph.
            </div>
          ) : (
            followUps.map((fu, idx) => {
              const b = fu.painScaleBefore !== undefined ? Number(fu.painScaleBefore) : undefined;
              const a = fu.painScaleAfter !== undefined ? Number(fu.painScaleAfter) : (fu.painScale !== undefined ? Number(fu.painScale) : undefined);
              const imp = calculatePainImprovement(b, a);

              return (
                <div key={fu.id || idx} className="p-3.5 bg-white border border-slate-200 rounded-2xl space-y-2 hover:border-sky-300 transition-colors">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                        Follow-up #{idx + 1}
                      </span>
                      <span className="font-semibold text-slate-700">{fu.date}</span>
                      <span className="text-[11px] text-slate-500">Fee: ₹{fu.fee || 0}</span>
                    </div>

                    {imp && imp.diff > 0 && (
                      <span className="text-[11px] font-extrabold text-emerald-700 flex items-center gap-1">
                        <TrendingDown className="w-3 h-3" />
                        <span>-{imp.diff} pts ({imp.percent}% relief)</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">Session Start:</span>
                      <span className="font-bold font-mono px-2 py-0.5 rounded bg-slate-50 border border-slate-200">
                        {b !== undefined ? `${b}/10` : (fu.painScale ? `${fu.painScale}/10` : '—')}
                      </span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">Session End:</span>
                      <span className="font-bold font-mono px-2 py-0.5 rounded bg-slate-50 border border-slate-200">
                        {a !== undefined ? `${a}/10` : '—'}
                      </span>
                    </div>
                  </div>

                  {fu.notes && (
                    <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100 italic">
                      "{fu.notes}"
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white transition-colors cursor-pointer shadow-xs"
          >
            Close Analysis
          </button>
        </div>
      </div>
    </div>
  );
};
