import React from 'react';
import { Activity, TrendingDown, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

export interface PainScaleProps {
  labelBefore?: string;
  labelAfter?: string;
  beforeValue?: number | string;
  afterValue?: number | string;
  onChangeBefore: (val: number) => void;
  onChangeAfter: (val: number) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function getPainSeverityInfo(score: number | undefined | null) {
  if (score === undefined || score === null || isNaN(Number(score))) {
    return { label: 'Not Recorded', color: 'text-slate-400', bg: 'bg-slate-100', border: 'border-slate-200', emoji: '—' };
  }
  const num = Number(score);
  if (num === 0) return { label: 'No Pain', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-300', emoji: '😊' };
  if (num <= 3) return { label: 'Mild Pain', color: 'text-lime-700', bg: 'bg-lime-50', border: 'border-lime-300', emoji: '🙂' };
  if (num <= 6) return { label: 'Moderate Pain', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-300', emoji: '😐' };
  if (num <= 8) return { label: 'Severe Pain', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-300', emoji: '😣' };
  return { label: 'Worst Possible', color: 'text-red-900', bg: 'bg-red-50', border: 'border-red-400', emoji: '😫' };
}

export function calculatePainImprovement(before?: number | string, after?: number | string) {
  if (before === undefined || before === '' || after === undefined || after === '') {
    return null;
  }
  const b = Number(before);
  const a = Number(after);
  if (isNaN(b) || isNaN(a)) return null;

  const diff = b - a; // positive means pain reduced
  const percent = b > 0 ? Math.round((diff / b) * 100) : (diff > 0 ? 100 : 0);

  let tone: 'excellent' | 'good' | 'unchanged' | 'increased' = 'unchanged';
  if (diff > 2) tone = 'excellent';
  else if (diff > 0) tone = 'good';
  else if (diff < 0) tone = 'increased';

  return {
    before: b,
    after: a,
    diff,
    percent,
    tone,
  };
}

export function getPainScoreButtonClass(score: number, currentSelected?: number) {
  const isSelected = currentSelected === score;
  if (isSelected) {
    if (score === 0) return 'bg-emerald-600 text-white font-extrabold border-emerald-700 shadow-sm ring-2 ring-emerald-300 scale-105';
    if (score <= 3) return 'bg-lime-600 text-white font-extrabold border-lime-700 shadow-sm ring-2 ring-lime-300 scale-105';
    if (score <= 6) return 'bg-amber-500 text-white font-extrabold border-amber-600 shadow-sm ring-2 ring-amber-200 scale-105';
    if (score <= 8) return 'bg-rose-600 text-white font-extrabold border-rose-700 shadow-sm ring-2 ring-rose-300 scale-105';
    return 'bg-red-700 text-white font-extrabold border-red-800 shadow-sm ring-2 ring-red-300 scale-105';
  }
  // Idle state
  if (score === 0) return 'bg-emerald-50/70 hover:bg-emerald-100 text-emerald-800 border-emerald-200';
  if (score <= 3) return 'bg-lime-50/70 hover:bg-lime-100 text-lime-800 border-lime-200';
  if (score <= 6) return 'bg-amber-50/70 hover:bg-amber-100 text-amber-800 border-amber-200';
  if (score <= 8) return 'bg-rose-50/70 hover:bg-rose-100 text-rose-800 border-rose-200';
  return 'bg-red-50/70 hover:bg-red-100 text-red-900 border-red-200';
}

export const PainScaleComponent: React.FC<PainScaleProps> = ({
  labelBefore = 'Pain Before Treatment (VAS 0–10)',
  labelAfter = 'Pain After Treatment (VAS 0–10)',
  beforeValue,
  afterValue,
  onChangeBefore,
  onChangeAfter,
  disabled = false,
  compact = false,
}) => {
  const numBefore = beforeValue !== undefined && beforeValue !== '' ? Number(beforeValue) : undefined;
  const numAfter = afterValue !== undefined && afterValue !== '' ? Number(afterValue) : undefined;
  const improvement = calculatePainImprovement(beforeValue, afterValue);

  const scores = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  const getButtonClass = (score: number, currentSelected?: number) => {
    const isSelected = currentSelected === score;
    if (isSelected) {
      if (score === 0) return 'bg-emerald-600 text-white font-extrabold border-emerald-700 shadow-md ring-2 ring-emerald-300';
      if (score <= 3) return 'bg-lime-600 text-white font-extrabold border-lime-700 shadow-md ring-2 ring-lime-300';
      if (score <= 6) return 'bg-amber-500 text-white font-extrabold border-amber-600 shadow-md ring-2 ring-amber-200';
      if (score <= 8) return 'bg-rose-600 text-white font-extrabold border-rose-700 shadow-md ring-2 ring-rose-300';
      return 'bg-red-700 text-white font-extrabold border-red-800 shadow-md ring-2 ring-red-300';
    }
    // Idle state
    if (score === 0) return 'bg-emerald-50/70 hover:bg-emerald-100 text-emerald-800 border-emerald-200';
    if (score <= 3) return 'bg-lime-50/70 hover:bg-lime-100 text-lime-800 border-lime-200';
    if (score <= 6) return 'bg-amber-50/70 hover:bg-amber-100 text-amber-800 border-amber-200';
    if (score <= 8) return 'bg-rose-50/70 hover:bg-rose-100 text-rose-800 border-rose-200';
    return 'bg-red-50/70 hover:bg-red-100 text-red-900 border-red-200';
  };

  return (
    <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-3 sm:p-4 space-y-4">
      {/* Header with Visual Rating Guide */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-sky-600" />
          <span className="text-xs font-bold text-slate-800">Visual Analogue Pain Scale (VAS 0–10)</span>
        </div>
        <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
          0 = No Pain • 5 = Moderate • 10 = Severe
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
        {/* Pain BEFORE Treatment */}
        <div className="space-y-2 bg-white/70 p-2.5 sm:p-3 rounded-xl border border-slate-200/70 shadow-2xs">
          <div className="flex items-center justify-between gap-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 min-w-0">
              <span className="truncate">{labelBefore}</span>
              {numBefore !== undefined && (
                <span className="text-[11px] font-extrabold px-1.5 py-0.5 rounded-md bg-white border border-slate-300 shadow-2xs font-mono shrink-0">
                  {numBefore}/10
                </span>
              )}
            </label>
            {numBefore !== undefined && (
              <span className={`text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-lg border shrink-0 ${getPainSeverityInfo(numBefore).bg} ${getPainSeverityInfo(numBefore).color} ${getPainSeverityInfo(numBefore).border}`}>
                {getPainSeverityInfo(numBefore).emoji} {getPainSeverityInfo(numBefore).label}
              </span>
            )}
          </div>

          <div className="grid grid-cols-11 gap-1 w-full">
            {scores.map((s) => (
              <button
                type="button"
                key={`before-${s}`}
                disabled={disabled}
                onClick={() => onChangeBefore(s)}
                className={`h-8 sm:h-9 w-full rounded-lg border text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${getButtonClass(s, numBefore)} disabled:opacity-50`}
                title={`Pain Score ${s}/10 - ${getPainSeverityInfo(s).label}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Pain AFTER Treatment */}
        <div className="space-y-2 bg-white/70 p-2.5 sm:p-3 rounded-xl border border-slate-200/70 shadow-2xs">
          <div className="flex items-center justify-between gap-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 min-w-0">
              <span className="truncate">{labelAfter}</span>
              {numAfter !== undefined && (
                <span className="text-[11px] font-extrabold px-1.5 py-0.5 rounded-md bg-white border border-slate-300 shadow-2xs font-mono shrink-0">
                  {numAfter}/10
                </span>
              )}
            </label>
            {numAfter !== undefined && (
              <span className={`text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-lg border shrink-0 ${getPainSeverityInfo(numAfter).bg} ${getPainSeverityInfo(numAfter).color} ${getPainSeverityInfo(numAfter).border}`}>
                {getPainSeverityInfo(numAfter).emoji} {getPainSeverityInfo(numAfter).label}
              </span>
            )}
          </div>

          <div className="grid grid-cols-11 gap-1 w-full">
            {scores.map((s) => (
              <button
                type="button"
                key={`after-${s}`}
                disabled={disabled}
                onClick={() => onChangeAfter(s)}
                className={`h-8 sm:h-9 w-full rounded-lg border text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${getButtonClass(s, numAfter)} disabled:opacity-50`}
                title={`Pain Score ${s}/10 - ${getPainSeverityInfo(s).label}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* PAIN IMPROVEMENT INDICATOR / DELTA */}
      {improvement && (
        <div
          id="pain-scale-relief-score-container"
          className={`p-3 sm:p-3.5 rounded-2xl border flex flex-col gap-2.5 shadow-2xs w-full max-w-full overflow-hidden ${
            improvement.diff > 0
              ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
              : improvement.diff === 0
              ? 'bg-amber-50/90 border-amber-200 text-amber-950'
              : 'bg-rose-50/90 border-rose-200 text-rose-950'
          }`}
        >
          {/* Top: Status Icon and Clinical Score Details */}
          <div className="flex items-start sm:items-center gap-2.5 min-w-0 w-full">
            {improvement.diff > 0 ? (
              <div className="w-8 h-8 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 shrink-0">
                <TrendingDown className="w-4 h-4 text-emerald-700" />
              </div>
            ) : improvement.diff === 0 ? (
              <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0">
                <AlertCircle className="w-4 h-4 text-amber-700" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-700 shrink-0">
                <AlertCircle className="w-4 h-4 text-rose-700" />
              </div>
            )}

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-black break-words leading-tight">
                  {improvement.diff > 0
                    ? `Pain Improved by ${improvement.diff} Points (${improvement.percent}% Relief)`
                    : improvement.diff === 0
                    ? 'Pain Score Unchanged Post-Treatment'
                    : `Pain Score Rose by ${Math.abs(improvement.diff)} Points`}
                </span>
                {improvement.diff > 0 && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white whitespace-nowrap shrink-0">
                    {improvement.diff >= 4 ? 'Significant Relief' : 'Good Response'}
                  </span>
                )}
              </div>
              <p className="text-[11px] opacity-80 break-words leading-normal">
                Initial: <b>{improvement.before}/10</b> ({getPainSeverityInfo(improvement.before).label}) ➔ Post-Session: <b>{improvement.after}/10</b> ({getPainSeverityInfo(improvement.after).label})
              </p>
            </div>
          </div>

          {/* Graphical Relief Bar - positioned right after the text */}
          <div className="w-full space-y-1 pt-1.5 border-t border-black/5">
            <div className="flex justify-between items-center text-[10.5px] font-bold">
              <span className="opacity-90">Relief Progress</span>
              <span className="font-mono">{Math.max(0, improvement.percent)}%</span>
            </div>
            <div className="w-full h-2.5 bg-black/10 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  improvement.diff > 0 ? 'bg-emerald-500' : improvement.diff === 0 ? 'bg-amber-400' : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, improvement.percent))}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export function PainImprovementBadge({
  before,
  after,
}: {
  before?: number | string;
  after?: number | string;
}) {
  const imp = calculatePainImprovement(before, after);
  if (!imp) return null;

  if (imp.diff > 0) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs max-w-full text-center truncate"
        title={`Pain dropped from ${imp.before}/10 to ${imp.after}/10 (${imp.percent}% relief)`}
      >
        <TrendingDown className="w-3 h-3 text-emerald-600 shrink-0" />
        <span className="truncate">VAS: {imp.before} ➔ {imp.after} (-{imp.diff} pts / {imp.percent}%)</span>
      </span>
    );
  }

  if (imp.diff === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 max-w-full text-center truncate">
        <span className="truncate">VAS: {imp.before}/10 (Stable)</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-rose-50 text-rose-800 border border-rose-200 max-w-full text-center truncate">
      <span className="truncate">VAS: {imp.before} ➔ {imp.after} (+{Math.abs(imp.diff)})</span>
    </span>
  );
}
