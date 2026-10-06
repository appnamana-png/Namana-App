import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Mic,
  MicOff,
  Stethoscope,
  Zap,
  Check,
  ChevronRight,
  Sparkles,
  User,
  Activity,
} from 'lucide-react';
import { Patient } from '../types';
import { MODALITIES_LIST } from '../constants';
import { PatientVoiceMenuId, EXISTING_PATIENT_VOICE_MENUS } from './UnifiedVoiceCommandModal';
import {
  RecognizedClinicalFields,
  FollowUpVoiceFields,
  parseMultipleSpokenFollowUpDates,
  parseSpokenDateAndTimeToISO,
} from '../utils/voiceFieldParser';

interface ExistingPatientVoiceGuidedFormProps {
  activeMenu: PatientVoiceMenuId;
  onSelectMenu: (menuId: PatientVoiceMenuId) => void;
  targetPatient: Patient | null;
  editableFields: RecognizedClinicalFields;
  setEditableFields: React.Dispatch<React.SetStateAction<RecognizedClinicalFields>>;
  onConfirmAndSchedule: () => void;
  isListening: boolean;
  toggleListening: () => void;
}

export const ExistingPatientVoiceGuidedForm: React.FC<ExistingPatientVoiceGuidedFormProps> = ({
  activeMenu,
  onSelectMenu,
  targetPatient,
  editableFields,
  setEditableFields,
  onConfirmAndSchedule,
  isListening,
  toggleListening,
}) => {
  const [dictateFollowUpInput, setDictateFollowUpInput] = useState('');
  const [dictateFeedback, setDictateFeedback] = useState<string | null>(null);

  // Guaranteed follow-ups list from editableFields, safely checking Array.isArray
  const followUpsList: FollowUpVoiceFields[] = useMemo(() => {
    if (Array.isArray(editableFields.followUps) && editableFields.followUps.length > 0) {
      return editableFields.followUps;
    }
    if (typeof editableFields.followUps === 'string' && (editableFields.followUps as string).trim().length > 0) {
      const parsed = parseMultipleSpokenFollowUpDates(editableFields.followUps, targetPatient);
      if (parsed.length > 0) {
        return parsed;
      }
    }
    if (
      editableFields.followUp &&
      typeof editableFields.followUp === 'object' &&
      editableFields.followUp.date
    ) {
      return [editableFields.followUp];
    }
    const fallbackFee =
      targetPatient?.treatmentFee !== undefined && targetPatient.treatmentFee !== ''
        ? targetPatient.treatmentFee
        : '500';
    return [
      {
        action: 'add',
        date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        time: '10:00:00',
        notes: 'Scheduled follow-up session',
        fee: fallbackFee,
        paymentMethod: targetPatient?.paymentMethod || 'UPI',
        visitType: targetPatient?.visitType || 'Clinic',
        seenBy: targetPatient?.seenBy || 'Dr. Vinay',
      },
    ];
  }, [editableFields.followUps, editableFields.followUp, targetPatient]);

  // Helper to update the follow-ups list
  const updateFollowUps = (newList: FollowUpVoiceFields[]) => {
    setEditableFields((prev) => ({
      ...prev,
      followUps: newList,
      followUp: newList[0] || undefined,
    }));
  };

  // Handle parsing dictated text into multiple dates & times
  const handleParseAndApplyDictatedSessions = (rawText: string) => {
    if (!rawText.trim()) return;
    const parsed = parseMultipleSpokenFollowUpDates(rawText);

    if (parsed.length > 0) {
      const baseSessionNum = targetPatient?.followUps?.length || 0;
      const newSessions: FollowUpVoiceFields[] = parsed.map((p, idx) => ({
        action: 'add',
        sessionNumber: baseSessionNum + idx + 1,
        date: p.date,
        time: p.time || '10:00:00',
        notes: editableFields.notes || editableFields.history || 'Scheduled follow-up session',
        treatmentsGiven: editableFields.modalities,
        fee:
          targetPatient?.treatmentFee !== undefined && targetPatient.treatmentFee !== ''
            ? targetPatient.treatmentFee
            : '500',
        paymentMethod: targetPatient?.paymentMethod || 'UPI',
        visitType: targetPatient?.visitType || 'Clinic',
        seenBy: targetPatient?.seenBy || 'Dr. Vinay',
      }));

      updateFollowUps(newSessions);
      setDictateFeedback(`✓ Captured ${newSessions.length} follow-up session(s) from voice!`);
      setDictateFollowUpInput('');
      setTimeout(() => setDictateFeedback(null), 4000);
    } else {
      const single = parseSpokenDateAndTimeToISO(rawText);
      if (single.date) {
        const newSession: FollowUpVoiceFields = {
          action: 'add',
          sessionNumber: (targetPatient?.followUps?.length || 0) + 1,
          date: single.date,
          time: single.time || '10:00:00',
          notes: editableFields.notes || editableFields.history || 'Scheduled follow-up session',
          treatmentsGiven: editableFields.modalities,
          fee:
            targetPatient?.treatmentFee !== undefined && targetPatient.treatmentFee !== ''
              ? targetPatient.treatmentFee
              : '500',
          paymentMethod: targetPatient?.paymentMethod || 'UPI',
          visitType: targetPatient?.visitType || 'Clinic',
          seenBy: targetPatient?.seenBy || 'Dr. Vinay',
        };
        updateFollowUps([newSession]);
        setDictateFeedback('✓ Captured follow-up session date & time!');
        setDictateFollowUpInput('');
        setTimeout(() => setDictateFeedback(null), 4000);
      } else {
        setDictateFeedback('Could not detect clear dates. Try saying "tomorrow at 10 AM and Friday at 4 PM".');
        setTimeout(() => setDictateFeedback(null), 4000);
      }
    }
  };

  // Quick preset adder
  const handleAddQuickSchedule = (daysFromNow: number, defaultHour: string) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    const iso = d.toISOString().split('T')[0];

    const currentList = [...followUpsList];
    const exists = currentList.some((s) => s.date === iso);
    if (!exists) {
      currentList.push({
        action: 'add',
        date: iso,
        time: defaultHour,
        notes: editableFields.notes || 'Scheduled follow-up session',
        fee:
          targetPatient?.treatmentFee !== undefined && targetPatient.treatmentFee !== ''
            ? targetPatient.treatmentFee
            : '500',
        paymentMethod: targetPatient?.paymentMethod || 'UPI',
        visitType: targetPatient?.visitType || 'Clinic',
        seenBy: targetPatient?.seenBy || 'Dr. Vinay',
      });
      updateFollowUps(currentList);
    }
  };

  // Add Mon-Wed-Fri routine
  const handleAddMonWedFri = () => {
    const list: FollowUpVoiceFields[] = [];
    const now = new Date();
    const targetDays = [1, 3, 5]; // Mon, Wed, Fri
    const currentDay = now.getDay();

    targetDays.forEach((targetDay) => {
      let diff = targetDay - currentDay;
      if (diff <= 0) diff += 7;
      const sessionDate = new Date(now);
      sessionDate.setDate(sessionDate.getDate() + diff);
      const iso = sessionDate.toISOString().split('T')[0];
      list.push({
        action: 'add',
        date: iso,
        time: '10:00:00',
        notes: editableFields.notes || 'Routine follow-up session',
        fee:
          targetPatient?.treatmentFee !== undefined && targetPatient.treatmentFee !== ''
            ? targetPatient.treatmentFee
            : '500',
        paymentMethod: targetPatient?.paymentMethod || 'UPI',
        visitType: targetPatient?.visitType || 'Clinic',
        seenBy: targetPatient?.seenBy || 'Dr. Vinay',
      });
    });

    list.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    updateFollowUps(list);
    setDictateFeedback('✓ Added 3 Follow-up Sessions (Mon, Wed, Fri at 10 AM)!');
    setTimeout(() => setDictateFeedback(null), 4000);
  };

  // Toggle modality
  const handleToggleModality = (modLabel: string) => {
    setEditableFields((prev) => {
      const current = prev.modalities || [];
      const exists = current.includes(modLabel);
      const next = exists ? current.filter((m) => m !== modLabel) : [...current, modLabel];
      return { ...prev, modalities: next };
    });
  };

  return (
    <div className="space-y-4">
      {/* 3 Clinical Voice Navigation Tabs for Existing Patient */}
      <div className="bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
          {EXISTING_PATIENT_VOICE_MENUS.map((menu) => {
            const isActive = activeMenu === menu.id;
            let countBadge: string | null = null;
            let isComplete = false;

            if (menu.id === 'diagnosis') {
              isComplete = Boolean(editableFields.notes && editableFields.notes.trim().length > 0);
              if (isComplete) countBadge = 'Recorded';
            } else if (menu.id === 'modalities') {
              const modCount = editableFields.modalities?.length || 0;
              if (modCount > 0) countBadge = `${modCount} selected`;
              isComplete = modCount > 0;
            } else if (menu.id === 'followup') {
              const fuCount = followUpsList.length;
              if (fuCount > 0) countBadge = `${fuCount} ${fuCount === 1 ? 'Session' : 'Sessions'}`;
              isComplete = fuCount > 0;
            }

            return (
              <button
                key={menu.id}
                type="button"
                id={`voice-existing-menu-${menu.id}`}
                onClick={() => onSelectMenu(menu.id)}
                className={`relative flex flex-col text-left p-2.5 rounded-xl transition-all cursor-pointer select-none ${
                  isActive
                    ? menu.id === 'followup'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md ring-2 ring-emerald-300 scale-[1.01]'
                      : 'bg-gradient-to-r from-indigo-600 to-sky-600 text-white shadow-md ring-2 ring-indigo-300 scale-[1.01]'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/70'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5">
                    {menu.id === 'diagnosis' && (
                      <Stethoscope className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-indigo-600'}`} />
                    )}
                    {menu.id === 'modalities' && (
                      <Zap className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-amber-600'}`} />
                    )}
                    {menu.id === 'followup' && (
                      <Calendar className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-emerald-600'}`} />
                    )}
                    <span className={`text-[11.5px] font-extrabold truncate ${isActive ? 'text-white' : 'text-slate-900'}`}>
                      {menu.badgeLabel}
                    </span>
                  </div>

                  {isComplete && (
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                        isActive ? 'bg-white/20 text-white' : 'bg-emerald-500 text-white'
                      }`}
                    >
                      <Check className="w-2.5 h-2.5" />
                    </span>
                  )}

                  {countBadge && (
                    <span
                      className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-full ${
                        isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {countBadge}
                    </span>
                  )}
                </div>
                <p className={`text-[10px] line-clamp-1 leading-tight ${isActive ? 'text-white/80' : 'text-slate-500 font-medium'}`}>
                  {menu.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===================== TAB 1: Clinical Progress & Complaints ===================== */}
      {activeMenu === 'diagnosis' && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                <Stethoscope className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  1. Clinical Progress & Complaints
                </h4>
                <p className="text-[11px] text-slate-500">
                  Record patient's reported symptoms, pain reduction, and functional response.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleListening}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
                isListening
                  ? 'bg-rose-600 hover:bg-rose-700 text-white ring-2 ring-rose-200'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {isListening ? <MicOff className="w-3.5 h-3.5 animate-bounce" /> : <Mic className="w-3.5 h-3.5" />}
              <span>{isListening ? 'Listening...' : 'Voice Dictate'}</span>
            </button>
          </div>

          <div>
            <textarea
              rows={3}
              value={editableFields.notes || editableFields.history || ''}
              onChange={(e) => {
                const val = e.target.value;
                setEditableFields((prev) => ({
                  ...prev,
                  notes: val,
                  history: val,
                  followUp: { ...(prev.followUp || {}), notes: val },
                }));
              }}
              placeholder="e.g. Patient reports 70% relief in cervical radiculopathy. Range of motion in shoulder abduction improved from 90° to 135° without sharp pain..."
              className="w-full p-3 bg-slate-50/60 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none resize-none leading-relaxed"
            />
          </div>

          {/* Quick symptom progress templates */}
          <div className="space-y-1">
            <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wide">
              Quick Progress Templates:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                '70% pain reduced, improved joint mobility',
                'Mild soreness post-exercise, swelling subsiding',
                'Shoulder flexion and abduction significantly improved',
                'Walking tolerance increased to 30 mins with minimal discomfort',
                'Full cervical rotation restored with negligible stiffness',
              ].map((template) => (
                <button
                  key={template}
                  type="button"
                  onClick={() => {
                    setEditableFields((prev) => {
                      const cur = prev.notes || prev.history || '';
                      const next = cur ? `${cur}. ${template}` : template;
                      return { ...prev, notes: next, history: next };
                    });
                  }}
                  className="px-2 py-1 rounded-lg bg-indigo-50/70 hover:bg-indigo-100 text-indigo-900 text-[10.5px] font-medium border border-indigo-200 transition-colors cursor-pointer"
                >
                  + {template}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onSelectMenu('modalities')}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold cursor-pointer transition-all shadow-xs"
            >
              <span>Next: Modalities & Rx</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ===================== TAB 2: Treatments Given / Modalities ===================== */}
      {activeMenu === 'modalities' && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  2. Treatments Given & Modalities
                </h4>
                <p className="text-[11px] text-slate-500">
                  Select physiotherapy modalities applied during this follow-up session.
                </p>
              </div>
            </div>

            <span className="text-xs font-extrabold text-amber-900 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
              {editableFields.modalities?.length || 0} Therapies Selected
            </span>
          </div>

          {/* 15 Clinical Modalities Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
            {MODALITIES_LIST.map((mod) => {
              const isSelected = editableFields.modalities?.includes(mod.label);
              return (
                <button
                  key={mod.key}
                  type="button"
                  onClick={() => handleToggleModality(mod.label)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-white border-amber-600 shadow-2xs font-bold'
                      : 'bg-slate-50/80 hover:bg-slate-100 text-slate-800 border-slate-200 font-medium'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border ${
                      isSelected ? 'bg-white text-amber-600 border-white' : 'bg-white border-slate-300'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span className="text-[11px] truncate">{mod.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onSelectMenu('diagnosis')}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              ← Back to Progress
            </button>
            <button
              type="button"
              onClick={() => onSelectMenu('followup')}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold cursor-pointer transition-all shadow-xs"
            >
              <span>Next: Schedule Follow-ups</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ===================== TAB 3: DEDICATED FOLLOW-UP SESSION SCHEDULER ===================== */}
      {activeMenu === 'followup' && (
        <div className="bg-gradient-to-b from-emerald-50/80 via-white to-white p-4 rounded-2xl border-2 border-emerald-300 shadow-sm space-y-4 animate-in fade-in">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-emerald-200">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-2xs">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-extrabold text-emerald-950 uppercase tracking-wider">
                    3. Follow-Up Session Scheduler
                  </h4>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold">
                    {followUpsList.length} {followUpsList.length === 1 ? 'Session' : 'Sessions'}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800">
                  Dictate multiple dates & times in natural speech (e.g. <em>"tomorrow at 10 AM and Friday at 4 PM"</em>)
                </p>
              </div>
            </div>

            {targetPatient && (
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-emerald-200 text-xs shadow-2xs">
                <User className="w-3.5 h-3.5 text-emerald-700" />
                <span className="font-extrabold text-emerald-950">{targetPatient.name}</span>
                {targetPatient.regNo && (
                  <span className="font-mono text-[10px] text-emerald-800">({targetPatient.regNo})</span>
                )}
              </div>
            )}
          </div>

          {/* Dedicated Voice Dictation Bar for Multiple Dates & Times */}
          <div className="bg-white p-3 rounded-xl border border-emerald-300 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Dictate Dates & Times via Speech:</span>
              </span>
              <button
                type="button"
                id="btn-voice-dictate-followups"
                onClick={toggleListening}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
                  isListening
                    ? 'bg-rose-600 hover:bg-rose-700 text-white ring-2 ring-rose-200'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {isListening ? (
                  <>
                    <MicOff className="w-3.5 h-3.5 animate-bounce" />
                    <span>Listening... (Dictate now)</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5" />
                    <span>Dictate Follow-up Dates</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={dictateFollowUpInput}
                onChange={(e) => setDictateFollowUpInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleParseAndApplyDictatedSessions(dictateFollowUpInput);
                  }
                }}
                placeholder="e.g. tomorrow at 10 AM, Friday at 4 PM, and next Monday at 11 AM..."
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 outline-none"
              />
              <button
                type="button"
                onClick={() => handleParseAndApplyDictatedSessions(dictateFollowUpInput)}
                disabled={!dictateFollowUpInput.trim()}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs"
              >
                Parse & Add
              </button>
            </div>

            {dictateFeedback && (
              <p
                className={`text-xs font-bold px-2 py-1 rounded-lg ${
                  dictateFeedback.startsWith('✓') ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {dictateFeedback}
              </p>
            )}
          </div>

          {/* Quick 1-Click Schedule Presets */}
          <div className="space-y-1.5">
            <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wide">
              Quick 1-Click Scheduling Presets:
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleAddQuickSchedule(1, '10:00:00')}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 text-emerald-950 text-xs font-bold border border-emerald-200 transition-colors cursor-pointer shadow-2xs"
              >
                + Tomorrow 10:00 AM
              </button>
              <button
                type="button"
                onClick={() => handleAddQuickSchedule(2, '11:00:00')}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 text-emerald-950 text-xs font-bold border border-emerald-200 transition-colors cursor-pointer shadow-2xs"
              >
                + Day After Tomorrow 11:00 AM
              </button>
              <button
                type="button"
                onClick={() => handleAddQuickSchedule(7, '16:00:00')}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 text-emerald-950 text-xs font-bold border border-emerald-200 transition-colors cursor-pointer shadow-2xs"
              >
                + Next Week 04:00 PM
              </button>
              <button
                type="button"
                onClick={handleAddMonWedFri}
                className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-950 text-xs font-extrabold border border-emerald-300 transition-colors cursor-pointer shadow-2xs"
              >
                + Mon, Wed & Fri (10 AM)
              </button>
              <button
                type="button"
                onClick={() => {
                  const lastIso =
                    followUpsList[followUpsList.length - 1]?.date || new Date().toISOString().split('T')[0];
                  const nextDate = new Date(lastIso);
                  nextDate.setDate(nextDate.getDate() + 1);
                  const newSession: FollowUpVoiceFields = {
                    action: 'add',
                    date: nextDate.toISOString().split('T')[0],
                    time: '10:00:00',
                    notes: editableFields.notes || 'Scheduled follow-up session',
                    fee:
                      targetPatient?.treatmentFee !== undefined && targetPatient.treatmentFee !== ''
                        ? targetPatient.treatmentFee
                        : '500',
                    paymentMethod: targetPatient?.paymentMethod || 'UPI',
                    visitType: targetPatient?.visitType || 'Clinic',
                    seenBy: targetPatient?.seenBy || 'Dr. Vinay',
                  };
                  updateFollowUps([...followUpsList, newSession]);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-300 transition-colors cursor-pointer"
              >
                + Add Custom Date
              </button>
            </div>
          </div>

          {/* Formatted List of Scheduled Follow-Up Sessions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-0.5">
              <span>Scheduled Sessions to Book ({followUpsList.length}):</span>
              <span className="text-[11px] text-slate-500 font-normal">Adjust date or time per session below</span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {followUpsList.map((session, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-emerald-200 shadow-2xs"
                >
                  <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                    #{idx + 1}
                  </div>

                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <input
                        type="date"
                        value={session.date || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          const updated = [...followUpsList];
                          updated[idx] = { ...updated[idx], date: val };
                          updateFollowUps(updated);
                        }}
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-500 outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <input
                        type="time"
                        value={(session.time || '10:00').slice(0, 5)}
                        onChange={(e) => {
                          const val = `${e.target.value}:00`;
                          const updated = [...followUpsList];
                          updated[idx] = { ...updated[idx], time: val };
                          updateFollowUps(updated);
                        }}
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (followUpsList.length > 1) {
                        const filtered = followUpsList.filter((_, i) => i !== idx);
                        updateFollowUps(filtered);
                      }
                    }}
                    disabled={followUpsList.length <= 1}
                    className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-20 rounded-lg transition-colors cursor-pointer"
                    title={followUpsList.length <= 1 ? 'Minimum 1 session required' : 'Remove this session'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* PRIMARY CONFIRMATION / ACTION BAR */}
          <div className="p-3 bg-emerald-900 text-white rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-md">
            <div>
              <p className="font-extrabold text-xs sm:text-sm">
                Ready to Schedule {followUpsList.length} Follow-up {followUpsList.length === 1 ? 'Session' : 'Sessions'}
              </p>
              <p className="text-[11px] text-emerald-200">
                Clicking will schedule all sessions and update clinical record for{' '}
                <strong>{targetPatient?.name || 'this patient'}</strong>.
              </p>
            </div>

            <button
              type="button"
              id="btn-voice-confirm-schedule-followups"
              onClick={onConfirmAndSchedule}
              className="px-5 py-2.5 bg-white hover:bg-emerald-50 text-emerald-950 font-black text-xs sm:text-sm rounded-xl cursor-pointer shadow-md transition-all active:scale-95 flex items-center gap-2"
            >
              <Check className="w-4 h-4 text-emerald-700 stroke-[3]" />
              <span>
                Schedule {followUpsList.length} Follow-up {followUpsList.length === 1 ? 'Session' : 'Sessions'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
