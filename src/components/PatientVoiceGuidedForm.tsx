import React from 'react';
import {
  Mic,
  Check,
  AlertCircle,
  Stethoscope,
  Phone,
  User,
  MapPin,
  IndianRupee,
  Activity,
  Calendar,
  Layers,
  Zap,
  CreditCard,
  ChevronRight,
  ChevronLeft,
  Heart,
  Scale,
  Ruler,
  Droplet,
  UserCheck,
  Clock,
  Pause,
  Play,
  Sparkles,
} from 'lucide-react';
import { RecognizedClinicalFields } from '../utils/voiceFieldParser';
import { COMMON_DIAGNOSES, MODALITIES_LIST, BLOOD_GROUPS, HEIGHT_PRESETS } from '../constants';
import {
  GuidedFieldStep,
  PatientVoiceMenu,
  PatientVoiceMenuId,
  PATIENT_VOICE_MENUS,
} from './UnifiedVoiceCommandModal';

interface PatientVoiceGuidedFormProps {
  activeMenu: PatientVoiceMenuId;
  onSelectMenu: (menuId: PatientVoiceMenuId) => void;
  activeFieldStepIndex: number;
  currentGuidedSteps: GuidedFieldStep[];
  editableFields: RecognizedClinicalFields;
  setEditableFields: React.Dispatch<React.SetStateAction<RecognizedClinicalFields>>;
  formErrors: Record<string, string>;
  setFormErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  touchedForm: boolean;
  voiceInputStyle: 'guided' | 'all_in_one';
  onJumpToStep: (index: number, speak?: boolean) => void;
  onNextMenu: () => void;
  onPrevMenu: () => void;
  onConfirmAndExecute: () => void;
  missingMandatoryFields: string[];
  voicePacingMode?: 'generous' | 'relaxed' | 'manual';
  setVoicePacingMode?: (mode: 'generous' | 'relaxed' | 'manual') => void;
  autoAdvanceCountdown?: number | null;
  onCancelCountdown?: () => void;
}

export const PatientVoiceGuidedForm: React.FC<PatientVoiceGuidedFormProps> = ({
  activeMenu,
  onSelectMenu,
  activeFieldStepIndex,
  currentGuidedSteps,
  editableFields,
  setEditableFields,
  formErrors,
  setFormErrors,
  touchedForm,
  voiceInputStyle,
  onJumpToStep,
  onNextMenu,
  onPrevMenu,
  onConfirmAndExecute,
  missingMandatoryFields,
  voicePacingMode = 'relaxed',
  setVoicePacingMode,
  autoAdvanceCountdown,
  onCancelCountdown,
}) => {
  const activeStep = currentGuidedSteps[activeFieldStepIndex] || currentGuidedSteps[0];

  // Helper to find step index by ID
  const getStepIndex = (id: string) => currentGuidedSteps.findIndex((s) => s.id === id);

  // Clear single error helper
  const clearFieldError = (fieldName: string) => {
    if (formErrors[fieldName]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
    }
  };

  // Toggle modality helper
  const toggleModality = (label: string) => {
    const currentList: string[] = Array.isArray(editableFields.modalities)
      ? editableFields.modalities
      : [];
    const exists = currentList.some((m) => m.toLowerCase() === label.toLowerCase());
    let nextList: string[];
    if (exists) {
      nextList = currentList.filter((m) => m.toLowerCase() !== label.toLowerCase());
    } else {
      nextList = [...currentList, label];
    }
    setEditableFields((prev) => ({ ...prev, modalities: nextList }));
  };

  // Comorbid state helper
  const comorbidObj = typeof editableFields.comorbid === 'object' && editableFields.comorbid !== null
    ? editableFields.comorbid
    : {
        diabetes: typeof editableFields.comorbid === 'string' && /diabet|sugar/i.test(editableFields.comorbid),
        hyperTension: typeof editableFields.comorbid === 'string' && /hypertens|bp/i.test(editableFields.comorbid),
        other: typeof editableFields.comorbid === 'string' && /thyroid|cardiac|asthma/i.test(editableFields.comorbid),
        otherText: typeof editableFields.comorbid === 'string' ? editableFields.comorbid : '',
      };

  const toggleComorbid = (key: 'diabetes' | 'hyperTension' | 'other') => {
    const nextObj = { ...comorbidObj, [key]: !comorbidObj[key] };
    setEditableFields((prev) => ({ ...prev, comorbid: nextObj }));
  };

  // Check completion per menu
  const isDemographicsComplete =
    Boolean(editableFields.name && editableFields.name.trim().length >= 2) &&
    Boolean(editableFields.age && Number(editableFields.age) > 0) &&
    Boolean(editableFields.contact && editableFields.contact.replace(/\D/g, '').length >= 7) &&
    Boolean(editableFields.address && editableFields.address.trim().length > 0);

  const isDiagnosisComplete = Boolean(editableFields.diagnosis && editableFields.diagnosis.trim().length > 0);
  const selectedModalitiesCount = Array.isArray(editableFields.modalities) ? editableFields.modalities.length : 0;

  // Helper to jump directly to any missing mandatory field
  const jumpToMissingField = (fieldName: string) => {
    const lower = fieldName.toLowerCase();
    let targetStepId = 'name';
    if (lower.includes('age')) targetStepId = 'age';
    else if (lower.includes('phone') || lower.includes('contact')) targetStepId = 'contact';
    else if (lower.includes('address')) targetStepId = 'address';
    else if (lower.includes('diagnos') || lower.includes('complaint')) targetStepId = 'diagnosis';

    const stepIdx = currentGuidedSteps.findIndex((s) => s.id === targetStepId);
    if (stepIdx !== -1) {
      onJumpToStep(stepIdx, true);
    }
  };

  return (
    <div className="space-y-4">
      {/* 4 Clinical Voice Menus Navigation Tabs */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
          {PATIENT_VOICE_MENUS.map((menu) => {
            const isActive = activeMenu === menu.id;
            let isComplete = false;
            let countBadge: string | null = null;

            if (menu.id === 'demographics') {
              isComplete = isDemographicsComplete;
            } else if (menu.id === 'diagnosis') {
              isComplete = isDiagnosisComplete;
            } else if (menu.id === 'modalities') {
              if (selectedModalitiesCount > 0) {
                countBadge = `${selectedModalitiesCount} selected`;
              }
            } else if (menu.id === 'billing') {
              if (editableFields.treatmentFee !== undefined && editableFields.treatmentFee !== '') {
                countBadge = `₹${editableFields.treatmentFee}`;
              }
            }

            return (
              <button
                key={menu.id}
                type="button"
                id={`voice-menu-tab-${menu.id}`}
                onClick={() => onSelectMenu(menu.id)}
                className={`relative flex flex-col text-left p-2.5 rounded-xl transition-all cursor-pointer select-none ${
                  isActive
                    ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-md ring-2 ring-sky-300 scale-[1.01]'
                    : 'bg-slate-50/70 hover:bg-slate-100 text-slate-700 border border-slate-200/60'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5">
                    {menu.id === 'demographics' && <User className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-sky-600'}`} />}
                    {menu.id === 'diagnosis' && <Stethoscope className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-indigo-600'}`} />}
                    {menu.id === 'modalities' && <Zap className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-amber-600'}`} />}
                    {menu.id === 'billing' && <IndianRupee className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-emerald-600'}`} />}
                    <span className={`text-[11.5px] font-extrabold truncate ${isActive ? 'text-white' : 'text-slate-900'}`}>
                      {menu.badgeLabel}
                    </span>
                  </div>

                  {isComplete && (
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${isActive ? 'bg-white text-emerald-700' : 'bg-emerald-500 text-white'}`}>
                      ✓
                    </span>
                  )}
                  {countBadge && (
                    <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-sky-100 text-sky-800'}`}>
                      {countBadge}
                    </span>
                  )}
                </div>
                <p className={`text-[10px] line-clamp-1 leading-tight ${isActive ? 'text-sky-100' : 'text-slate-500 font-medium'}`}>
                  {menu.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* UNIVERSAL PATIENT REGISTRATION ACTION BAR (Always visible across all menus) */}
      <div
        id="universal-patient-registration-bar"
        className={`p-3.5 rounded-2xl border transition-all shadow-sm flex flex-wrap items-center justify-between gap-3 ${
          missingMandatoryFields.length === 0
            ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white border-emerald-400 shadow-emerald-600/20'
            : 'bg-amber-50/90 border-amber-300 text-amber-950'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {missingMandatoryFields.length === 0 ? (
            <div className="w-9 h-9 rounded-xl bg-white/20 text-white flex items-center justify-center font-black shrink-0 shadow-inner">
              <Check className="w-5 h-5" />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-amber-200 text-amber-900 flex items-center justify-center font-black shrink-0 shadow-inner">
              <AlertCircle className="w-5 h-5" />
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-xs sm:text-sm">
                {missingMandatoryFields.length === 0
                  ? `✓ All Mandatory Fields Complete!`
                  : `Mandatory Patient Fields (${missingMandatoryFields.length} Pending)`}
              </span>
              {missingMandatoryFields.length === 0 ? (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white text-emerald-800 uppercase tracking-wider shadow-2xs">
                  Ready to Register Now
                </span>
              ) : (
                <span className="text-[10.5px] font-semibold text-amber-800">
                  Click any chip below to jump and speak:
                </span>
              )}
            </div>

            {missingMandatoryFields.length === 0 ? (
              <p className="text-[11.5px] text-emerald-100 mt-0.5 leading-snug">
                You can register <strong>{editableFields.name || 'this patient'}</strong> immediately without visiting remaining menus. Say <em>"Register patient"</em> or click the button.
              </p>
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                {missingMandatoryFields.map((field) => (
                  <button
                    key={field}
                    type="button"
                    onClick={() => jumpToMissingField(field)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-white border border-amber-300 hover:border-amber-500 hover:bg-amber-100 text-amber-900 transition-all cursor-pointer shadow-2xs"
                    title={`Click to fill ${field}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span>{field}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            id="btn-voice-register-patient-universal"
            onClick={onConfirmAndExecute}
            disabled={missingMandatoryFields.length > 0}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs transition-all shadow-md select-none ${
              missingMandatoryFields.length === 0
                ? 'bg-white text-emerald-900 hover:bg-emerald-50 hover:scale-[1.02] cursor-pointer shadow-lg active:scale-95 ring-2 ring-white/50'
                : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed opacity-60'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>Register Patient Record</span>
          </button>
        </div>
      </div>

      {/* VOICE PACING & PAUSE STATUS BANNER */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          {autoAdvanceCountdown !== null ? (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-900 font-bold text-xs animate-pulse">
              <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
              <span>
                Waiting for you to finish... Moving to next field in {autoAdvanceCountdown}s
              </span>
              {onCancelCountdown && (
                <button
                  type="button"
                  onClick={onCancelCountdown}
                  className="px-2 py-0.5 rounded bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 text-[10.5px] font-black cursor-pointer shadow-2xs ml-1"
                  title="Stop countdown and stay on this field"
                >
                  Stay Here / Pause
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-slate-700 text-xs">
              <span className="font-extrabold text-slate-900">Voice Speed:</span>
              <span className="text-slate-500">
                {voicePacingMode === 'manual'
                  ? 'Manual Mode: AI waits patiently until you say "Next" or click Next.'
                  : voicePacingMode === 'relaxed'
                  ? 'Relaxed: AI waits 5.5 seconds of silence before moving.'
                  : 'Paced: AI waits 3.5 seconds of silence before moving.'}
              </span>
            </div>
          )}
        </div>

        {/* Pacing Mode Selector */}
        {setVoicePacingMode && (
          <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setVoicePacingMode('generous')}
              className={`px-2 py-0.5 rounded text-[10.5px] font-bold transition-all cursor-pointer ${
                voicePacingMode === 'generous'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Waits 3.5 seconds of silence before advancing"
            >
              Paced (3.5s)
            </button>
            <button
              type="button"
              onClick={() => setVoicePacingMode('relaxed')}
              className={`px-2 py-0.5 rounded text-[10.5px] font-bold transition-all cursor-pointer ${
                voicePacingMode === 'relaxed'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Waits 5.5 seconds of silence before advancing"
            >
              Relaxed (5.5s)
            </button>
            <button
              type="button"
              onClick={() => setVoicePacingMode('manual')}
              className={`px-2 py-0.5 rounded text-[10.5px] font-bold transition-all cursor-pointer ${
                voicePacingMode === 'manual'
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Never auto-advances. AI waits for you to say 'Next' or click Next"
            >
              Manual (Wait for "Next")
            </button>
          </div>
        )}
      </div>

      {/* Spoken Voice Control Breadcrumb & Action Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-sky-50/80 border border-sky-200/80 rounded-xl text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping shrink-0" />
          <span className="font-extrabold text-sky-950">
            Active Menu: {PATIENT_VOICE_MENUS.find((m) => m.id === activeMenu)?.label}
          </span>
          <span className="text-[11px] text-sky-700 hidden sm:inline">
            (Voice command automatically moves forward through all menus)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onPrevMenu}
            className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
            title="Go to previous menu (or say 'previous menu')"
          >
            <ChevronLeft className="w-3 h-3" /> Prev Menu
          </button>
          <button
            type="button"
            onClick={onNextMenu}
            className="px-2 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
            title="Go to next menu (or say 'next menu')"
          >
            Next Menu <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* MENU 1: PATIENT DEMOGRAPHICS & PROFILE                                */}
      {/* ==================================================================== */}
      {activeMenu === 'demographics' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            {/* Patient Name */}
            <div
              id="voice-field-container-name"
              className={`p-2 rounded-xl transition-all ${
                voiceInputStyle === 'guided' && activeStep?.id === 'name'
                  ? 'border-2 border-sky-500 ring-4 ring-sky-300/80 bg-sky-50/80 shadow-md scale-[1.01]'
                  : 'border border-slate-200/80 bg-white'
              }`}
            >
              <div className="flex items-center justify-between pb-1">
                <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wide">
                  Patient Full Name <span className="text-rose-600 font-extrabold">*</span>
                </label>
                <div className="flex items-center gap-1.5">
                  {voiceInputStyle === 'guided' && activeStep?.id === 'name' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-white bg-sky-600 px-2 py-0.5 rounded-full animate-pulse">
                      <Mic className="w-2.5 h-2.5" /> Speaking Now
                    </span>
                  )}
                  {editableFields.name && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                      <Check className="w-2.5 h-2.5" /> Captured
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onJumpToStep(getStepIndex('name'), true)}
                    className="text-sky-600 hover:text-sky-800 p-0.5 rounded hover:bg-sky-100 cursor-pointer"
                    title="Jump to speak Name"
                  >
                    <Mic className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <input
                id="voice-input-name"
                type="text"
                value={editableFields.name || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditableFields((prev) => ({ ...prev, name: val }));
                  clearFieldError('name');
                }}
                className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs font-bold text-slate-900 outline-none transition-all ${
                  formErrors.name || (touchedForm && !editableFields.name)
                    ? 'border-rose-400 bg-rose-50/20 ring-2 ring-rose-200'
                    : 'border-slate-300 focus:border-sky-500'
                }`}
                placeholder="e.g. Ramesh Kumar"
              />
              {formErrors.name && (
                <p className="text-[10px] text-rose-600 font-bold mt-0.5 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{formErrors.name}</span>
                </p>
              )}
            </div>

            {/* Age and Gender */}
            <div className="grid grid-cols-2 gap-2">
              {/* Age */}
              <div
                id="voice-field-container-age"
                className={`p-2 rounded-xl transition-all ${
                  voiceInputStyle === 'guided' && activeStep?.id === 'age'
                    ? 'border-2 border-sky-500 ring-4 ring-sky-300/80 bg-sky-50/80 shadow-md scale-[1.01]'
                    : 'border border-slate-200/80 bg-white'
                }`}
              >
                <div className="flex items-center justify-between pb-1">
                  <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wide">
                    Age (Yrs) <span className="text-rose-600 font-extrabold">*</span>
                  </label>
                  <div className="flex items-center gap-1">
                    {voiceInputStyle === 'guided' && activeStep?.id === 'age' && (
                      <span className="text-[9.5px] font-extrabold text-white bg-sky-600 px-1.5 py-0.2 rounded-full animate-pulse">
                        Mic
                      </span>
                    )}
                    {editableFields.age !== undefined && String(editableFields.age).length > 0 && (
                      <span className="text-[9.5px] font-bold text-emerald-700 bg-emerald-100 px-1 py-0.2 rounded">✓</span>
                    )}
                    <button
                      type="button"
                      onClick={() => onJumpToStep(getStepIndex('age'), true)}
                      className="text-sky-600 hover:text-sky-800 p-0.5 rounded hover:bg-sky-100 cursor-pointer"
                      title="Jump to speak Age"
                    >
                      <Mic className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <input
                  id="voice-input-age"
                  type="number"
                  value={editableFields.age ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditableFields((prev) => ({ ...prev, age: val }));
                    clearFieldError('age');
                  }}
                  className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs font-bold text-slate-900 outline-none transition-all ${
                    formErrors.age || (touchedForm && !editableFields.age)
                      ? 'border-rose-400 bg-rose-50/20 ring-2 ring-rose-200'
                      : 'border-slate-300 focus:border-sky-500'
                  }`}
                  placeholder="e.g. 45"
                />
                {formErrors.age && <p className="text-[10px] text-rose-600 font-bold mt-0.5">{formErrors.age}</p>}
              </div>

              {/* Gender */}
              <div
                id="voice-field-container-sex"
                className={`p-2 rounded-xl transition-all ${
                  voiceInputStyle === 'guided' && activeStep?.id === 'sex'
                    ? 'border-2 border-sky-500 ring-4 ring-sky-300/80 bg-sky-50/80 shadow-md scale-[1.01]'
                    : 'border border-slate-200/80 bg-white'
                }`}
              >
                <div className="flex items-center justify-between pb-1">
                  <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wide">
                    Gender <span className="text-rose-600 font-extrabold">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => onJumpToStep(getStepIndex('sex'), true)}
                    className="text-sky-600 hover:text-sky-800 p-0.5 rounded hover:bg-sky-100 cursor-pointer"
                    title="Jump to speak Gender"
                  >
                    <Mic className="w-3 h-3" />
                  </button>
                </div>
                <select
                  id="voice-input-sex"
                  value={editableFields.sex || 'Male'}
                  onChange={(e) => setEditableFields((prev) => ({ ...prev, sex: e.target.value as any }))}
                  className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:border-sky-500 outline-none"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* Contact Phone */}
            <div
              id="voice-field-container-contact"
              className={`p-2 rounded-xl transition-all ${
                voiceInputStyle === 'guided' && activeStep?.id === 'contact'
                  ? 'border-2 border-sky-500 ring-4 ring-sky-300/80 bg-sky-50/80 shadow-md scale-[1.01]'
                  : 'border border-slate-200/80 bg-white'
              }`}
            >
              <div className="flex items-center justify-between pb-1">
                <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wide">
                  Contact Phone <span className="text-rose-600 font-extrabold">*</span>
                </label>
                <div className="flex items-center gap-1.5">
                  {voiceInputStyle === 'guided' && activeStep?.id === 'contact' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-white bg-sky-600 px-2 py-0.5 rounded-full animate-pulse">
                      <Mic className="w-2.5 h-2.5" /> Speaking Now
                    </span>
                  )}
                  {editableFields.contact && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                      <Check className="w-2.5 h-2.5" /> Captured
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onJumpToStep(getStepIndex('contact'), true)}
                    className="text-sky-600 hover:text-sky-800 p-0.5 rounded hover:bg-sky-100 cursor-pointer"
                    title="Jump to speak Contact"
                  >
                    <Mic className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <input
                id="voice-input-contact"
                type="text"
                value={editableFields.contact || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditableFields((prev) => ({ ...prev, contact: val }));
                  clearFieldError('contact');
                }}
                className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs font-bold text-slate-900 outline-none transition-all ${
                  formErrors.contact || (touchedForm && !editableFields.contact)
                    ? 'border-rose-400 bg-rose-50/20 ring-2 ring-rose-200'
                    : 'border-slate-300 focus:border-sky-500'
                }`}
                placeholder="10-digit mobile number"
              />
              {formErrors.contact && (
                <p className="text-[10px] text-rose-600 font-bold mt-0.5 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{formErrors.contact}</span>
                </p>
              )}
            </div>

            {/* Residential Address */}
            <div
              id="voice-field-container-address"
              className={`p-2 rounded-xl transition-all ${
                voiceInputStyle === 'guided' && activeStep?.id === 'address'
                  ? 'border-2 border-sky-500 ring-4 ring-sky-300/80 bg-sky-50/80 shadow-md scale-[1.01]'
                  : 'border border-slate-200/80 bg-white'
              }`}
            >
              <div className="flex items-center justify-between pb-1">
                <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wide">
                  Residential Address <span className="text-rose-600 font-extrabold">*</span>
                </label>
                <div className="flex items-center gap-1.5">
                  {voiceInputStyle === 'guided' && activeStep?.id === 'address' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-white bg-sky-600 px-2 py-0.5 rounded-full animate-pulse">
                      <Mic className="w-2.5 h-2.5" /> Speaking Now
                    </span>
                  )}
                  {editableFields.address && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                      <Check className="w-2.5 h-2.5" /> Captured
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onJumpToStep(getStepIndex('address'), true)}
                    className="text-sky-600 hover:text-sky-800 p-0.5 rounded hover:bg-sky-100 cursor-pointer"
                    title="Jump to speak Address"
                  >
                    <Mic className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <input
                id="voice-input-address"
                type="text"
                value={editableFields.address || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditableFields((prev) => ({ ...prev, address: val }));
                  clearFieldError('address');
                }}
                className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs font-medium text-slate-900 outline-none transition-all ${
                  formErrors.address || (touchedForm && !editableFields.address)
                    ? 'border-rose-400 bg-rose-50/20 ring-2 ring-rose-200'
                    : 'border-slate-300 focus:border-sky-500'
                }`}
                placeholder="e.g. Vijayanagar, Mysuru"
              />
              {formErrors.address && <p className="text-[10px] text-rose-600 font-bold mt-0.5">{formErrors.address}</p>}
            </div>

            {/* Consultation Date */}
            <div
              id="voice-field-container-date"
              className={`p-2 rounded-xl transition-all ${
                voiceInputStyle === 'guided' && activeStep?.id === 'date'
                  ? 'border-2 border-sky-500 ring-4 ring-sky-300/80 bg-sky-50/80 shadow-md scale-[1.01]'
                  : 'border border-slate-200/80 bg-white'
              }`}
            >
              <div className="flex items-center justify-between pb-1">
                <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wide">
                  Consultation Date
                </label>
                <button
                  type="button"
                  onClick={() => onJumpToStep(getStepIndex('date'), true)}
                  className="text-sky-600 hover:text-sky-800 p-0.5 rounded hover:bg-sky-100 cursor-pointer"
                  title="Jump to speak Date"
                >
                  <Mic className="w-3 h-3" />
                </button>
              </div>
              <input
                id="voice-input-date"
                type="date"
                value={editableFields.date || new Date().toISOString().slice(0, 10)}
                onChange={(e) => setEditableFields((prev) => ({ ...prev, date: e.target.value }))}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:border-sky-500 outline-none"
              />
            </div>

            {/* Height and Weight */}
            <div className="grid grid-cols-2 gap-2">
              {/* Height */}
              <div
                id="voice-field-container-height"
                className={`p-2 rounded-xl transition-all ${
                  voiceInputStyle === 'guided' && activeStep?.id === 'height'
                    ? 'border-2 border-sky-500 ring-4 ring-sky-300/80 bg-sky-50/80 shadow-md scale-[1.01]'
                    : 'border border-slate-200/80 bg-white'
                }`}
              >
                <div className="flex items-center justify-between pb-1">
                  <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1">
                    <Ruler className="w-3 h-3 text-sky-600" /> Height
                  </label>
                  <button
                    type="button"
                    onClick={() => onJumpToStep(getStepIndex('height'), true)}
                    className="text-sky-600 hover:text-sky-800 p-0.5 rounded hover:bg-sky-100 cursor-pointer"
                    title="Jump to speak Height"
                  >
                    <Mic className="w-3 h-3" />
                  </button>
                </div>
                <input
                  id="voice-input-height"
                  type="text"
                  value={editableFields.height || `5'6"`}
                  onChange={(e) => setEditableFields((prev) => ({ ...prev, height: e.target.value }))}
                  className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:border-sky-500 outline-none"
                  placeholder="e.g. 5'6&quot; or 168 cm"
                />
              </div>

              {/* Weight */}
              <div
                id="voice-field-container-weight"
                className={`p-2 rounded-xl transition-all ${
                  voiceInputStyle === 'guided' && activeStep?.id === 'weight'
                    ? 'border-2 border-sky-500 ring-4 ring-sky-300/80 bg-sky-50/80 shadow-md scale-[1.01]'
                    : 'border border-slate-200/80 bg-white'
                }`}
              >
                <div className="flex items-center justify-between pb-1">
                  <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1">
                    <Scale className="w-3 h-3 text-indigo-600" /> Weight (kg)
                  </label>
                  <button
                    type="button"
                    onClick={() => onJumpToStep(getStepIndex('weight'), true)}
                    className="text-sky-600 hover:text-sky-800 p-0.5 rounded hover:bg-sky-100 cursor-pointer"
                    title="Jump to speak Weight"
                  >
                    <Mic className="w-3 h-3" />
                  </button>
                </div>
                <input
                  id="voice-input-weight"
                  type="number"
                  value={editableFields.weight || '65'}
                  onChange={(e) => setEditableFields((prev) => ({ ...prev, weight: e.target.value }))}
                  className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:border-sky-500 outline-none"
                  placeholder="e.g. 65"
                />
              </div>
            </div>

            {/* Blood Group */}
            <div
              id="voice-field-container-bloodGroup"
              className={`p-2 rounded-xl transition-all ${
                voiceInputStyle === 'guided' && activeStep?.id === 'bloodGroup'
                  ? 'border-2 border-sky-500 ring-4 ring-sky-300/80 bg-sky-50/80 shadow-md scale-[1.01]'
                  : 'border border-slate-200/80 bg-white'
              }`}
            >
              <div className="flex items-center justify-between pb-1">
                <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1">
                  <Droplet className="w-3 h-3 text-rose-500" /> Blood Group
                </label>
                <button
                  type="button"
                  onClick={() => onJumpToStep(getStepIndex('bloodGroup'), true)}
                  className="text-sky-600 hover:text-sky-800 p-0.5 rounded hover:bg-sky-100 cursor-pointer"
                  title="Jump to speak Blood Group"
                >
                  <Mic className="w-3 h-3" />
                </button>
              </div>
              <select
                id="voice-input-bloodGroup"
                value={editableFields.bloodGroup || 'O+'}
                onChange={(e) => setEditableFields((prev) => ({ ...prev, bloodGroup: e.target.value }))}
                className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:border-sky-500 outline-none"
              >
                {BLOOD_GROUPS.map((bg) => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>
            </div>

            {/* Referred By & Attending Physiotherapist */}
            <div className="grid grid-cols-2 gap-2">
              <div
                id="voice-field-container-referredBy"
                className={`p-2 rounded-xl transition-all ${
                  voiceInputStyle === 'guided' && activeStep?.id === 'referredBy'
                    ? 'border-2 border-sky-500 ring-4 ring-sky-300/80 bg-sky-50/80 shadow-md scale-[1.01]'
                    : 'border border-slate-200/80 bg-white'
                }`}
              >
                <div className="flex items-center justify-between pb-1">
                  <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wide">
                    Referred By
                  </label>
                  <button
                    type="button"
                    onClick={() => onJumpToStep(getStepIndex('referredBy'), true)}
                    className="text-sky-600 hover:text-sky-800 p-0.5 rounded hover:bg-sky-100 cursor-pointer"
                    title="Jump to speak Referred By"
                  >
                    <Mic className="w-3 h-3" />
                  </button>
                </div>
                <input
                  id="voice-input-referredBy"
                  type="text"
                  value={editableFields.referredBy || 'Self'}
                  onChange={(e) => setEditableFields((prev) => ({ ...prev, referredBy: e.target.value }))}
                  className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:border-sky-500 outline-none"
                  placeholder="Self / Dr. Name"
                />
              </div>

              <div
                id="voice-field-container-seenBy"
                className={`p-2 rounded-xl transition-all ${
                  voiceInputStyle === 'guided' && activeStep?.id === 'seenBy'
                    ? 'border-2 border-sky-500 ring-4 ring-sky-300/80 bg-sky-50/80 shadow-md scale-[1.01]'
                    : 'border border-slate-200/80 bg-white'
                }`}
              >
                <div className="flex items-center justify-between pb-1">
                  <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1">
                    <UserCheck className="w-3 h-3 text-emerald-600" /> Seen By
                  </label>
                  <button
                    type="button"
                    onClick={() => onJumpToStep(getStepIndex('seenBy'), true)}
                    className="text-sky-600 hover:text-sky-800 p-0.5 rounded hover:bg-sky-100 cursor-pointer"
                    title="Jump to speak Seen By"
                  >
                    <Mic className="w-3 h-3" />
                  </button>
                </div>
                <input
                  id="voice-input-seenBy"
                  type="text"
                  value={editableFields.seenBy || 'R. Chandrashekar'}
                  onChange={(e) => setEditableFields((prev) => ({ ...prev, seenBy: e.target.value }))}
                  className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:border-sky-500 outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MENU 2: CLINICAL DIAGNOSIS & ASSESSMENT                              */}
      {/* ==================================================================== */}
      {activeMenu === 'diagnosis' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          {/* Clinical Diagnosis / Chief Complaint */}
          <div
            id="voice-field-container-diagnosis"
            className={`p-3 rounded-2xl transition-all space-y-2 ${
              voiceInputStyle === 'guided' && activeStep?.id === 'diagnosis'
                ? 'border-2 border-sky-500 ring-4 ring-sky-300/80 bg-sky-50/80 shadow-md scale-[1.01]'
                : 'border border-slate-200/80 bg-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Stethoscope className="w-4 h-4 text-indigo-600" />
                <span>Clinical Diagnosis / Chief Complaint</span>
                <span className="text-rose-600 font-extrabold">*</span>
              </label>
              <div className="flex items-center gap-2">
                {voiceInputStyle === 'guided' && activeStep?.id === 'diagnosis' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-white bg-sky-600 px-2 py-0.5 rounded-full animate-pulse">
                    <Mic className="w-2.5 h-2.5" /> Speaking Now
                  </span>
                )}
                {editableFields.diagnosis && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                    <Check className="w-2.5 h-2.5" /> Captured
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onJumpToStep(getStepIndex('diagnosis'), true)}
                  className="text-sky-600 hover:text-sky-800 p-1 rounded hover:bg-sky-100 cursor-pointer"
                  title="Jump to speak Diagnosis"
                >
                  <Mic className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <input
              id="voice-input-diagnosis"
              type="text"
              value={editableFields.diagnosis || ''}
              onChange={(e) => {
                const val = e.target.value;
                setEditableFields((prev) => ({ ...prev, diagnosis: val }));
                clearFieldError('diagnosis');
              }}
              className={`w-full px-3 py-2 bg-white border rounded-xl text-xs font-bold text-slate-900 outline-none transition-all ${
                formErrors.diagnosis || (touchedForm && !editableFields.diagnosis)
                  ? 'border-rose-400 bg-rose-50/20 ring-2 ring-rose-200'
                  : 'border-slate-300 focus:border-sky-500'
              }`}
              placeholder="e.g. Frozen Shoulder, Cervical Spondylosis, Lumbar Radiculopathy..."
            />
            {formErrors.diagnosis && (
              <p className="text-[10px] text-rose-600 font-bold mt-0.5 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{formErrors.diagnosis}</span>
              </p>
            )}

            {/* Quick Diagnostic Suggestions - Append with '+' without erasing typed diagnosis */}
            <div className="pt-1 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  Common Clinical Conditions (Tap '+' to add):
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const cur = (editableFields.diagnosis || '').trim();
                    if (cur && !cur.endsWith('+')) {
                      setEditableFields((prev) => ({ ...prev, diagnosis: `${cur} + ` }));
                    } else if (!cur) {
                      setEditableFields((prev) => ({ ...prev, diagnosis: '+ ' }));
                    }
                    const el = document.getElementById('voice-input-diagnosis') as HTMLInputElement;
                    if (el) el.focus();
                  }}
                  className="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 cursor-pointer flex items-center gap-1 transition-colors"
                  title="Add '+' to append another diagnosis"
                >
                  <span>+ Add Condition</span>
                </button>
              </div>

              {/* Helper notice when '+' is entered */}
              {(editableFields.diagnosis || '').trim().endsWith('+') && (
                <div className="text-[10.5px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 animate-pulse">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>'+' active: Tap any common condition below to add it to what you typed!</span>
                </div>
              )}

              <div className="flex flex-wrap gap-1">
                {COMMON_DIAGNOSES.map((diag) => {
                  const currentDiag = (editableFields.diagnosis || '').trim();
                  const isIncluded = currentDiag.toLowerCase().includes(diag.toLowerCase());
                  return (
                    <button
                      key={diag}
                      type="button"
                      onClick={() => {
                        clearFieldError('diagnosis');
                        if (!currentDiag) {
                          setEditableFields((prev) => ({ ...prev, diagnosis: diag }));
                        } else if (currentDiag.endsWith('+')) {
                          setEditableFields((prev) => ({
                            ...prev,
                            diagnosis: `${currentDiag} ${diag}`.replace(/\s+/g, ' ').trim(),
                          }));
                        } else if (!isIncluded) {
                          setEditableFields((prev) => ({
                            ...prev,
                            diagnosis: `${currentDiag} + ${diag}`,
                          }));
                        } else {
                          // Toggle off if clicked again when already included
                          const updated = currentDiag
                            .split(/\s*\+\s*/)
                            .filter((part) => part.trim().toLowerCase() !== diag.toLowerCase())
                            .join(' + ');
                          setEditableFields((prev) => ({ ...prev, diagnosis: updated }));
                        }
                      }}
                      className={`text-[10.5px] px-2 py-1 rounded-lg border font-medium cursor-pointer transition-all flex items-center gap-1 ${
                        isIncluded
                          ? 'bg-sky-600 text-white border-sky-600 font-bold shadow-2xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span className="text-[10px] font-black">{isIncluded ? '✓' : '+'}</span>
                      <span>{diag}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Clinical History / History of Present Illness */}
          <div
            id="voice-field-container-history"
            className={`p-3 rounded-2xl transition-all space-y-1.5 ${
              voiceInputStyle === 'guided' && activeStep?.id === 'history'
                ? 'border-2 border-sky-500 ring-4 ring-sky-300/80 bg-sky-50/80 shadow-md scale-[1.01]'
                : 'border border-slate-200/80 bg-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
                Chief Complaints & History of Present Illness
              </label>
              <button
                type="button"
                onClick={() => onJumpToStep(getStepIndex('history'), true)}
                className="text-sky-600 hover:text-sky-800 p-1 rounded hover:bg-sky-100 cursor-pointer"
                title="Jump to speak History"
              >
                <Mic className="w-3.5 h-3.5" />
              </button>
            </div>
            <textarea
              id="voice-input-history"
              rows={2}
              value={editableFields.history || ''}
              onChange={(e) => setEditableFields((prev) => ({ ...prev, history: e.target.value }))}
              placeholder="e.g. Severe shoulder stiffness and pain radiating to arm for 3 months, worse at night and during overhead reaching..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:border-sky-500 outline-none resize-none"
            />
          </div>

          {/* VAS Pain Scales (Before & After) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* VAS Pain Scale Before Treatment */}
            <div
              id="voice-field-container-painScaleBefore"
              className={`p-3 rounded-2xl transition-all space-y-2 ${
                voiceInputStyle === 'guided' && activeStep?.id === 'painScaleBefore'
                  ? 'border-2 border-sky-500 ring-4 ring-sky-300/80 bg-sky-50/80 shadow-md scale-[1.01]'
                  : 'border border-slate-200/80 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-rose-500" />
                  <span>VAS Pain Before Treatment (0 - 10)</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-extrabold px-2 py-0.5 bg-rose-100 text-rose-800 rounded-md">
                    {editableFields.painScaleBefore !== undefined ? editableFields.painScaleBefore : 6} / 10
                  </span>
                  <button
                    type="button"
                    onClick={() => onJumpToStep(getStepIndex('painScaleBefore'), true)}
                    className="text-sky-600 hover:text-sky-800 p-0.5 rounded hover:bg-sky-100 cursor-pointer"
                  >
                    <Mic className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={editableFields.painScaleBefore !== undefined ? editableFields.painScaleBefore : 6}
                onChange={(e) => setEditableFields((prev) => ({ ...prev, painScaleBefore: Number(e.target.value) }))}
                className="w-full accent-rose-600 cursor-pointer"
              />
              <div className="flex justify-between text-[9.5px] text-slate-400 font-semibold px-0.5">
                <span>0 (No Pain)</span>
                <span>5 (Moderate)</span>
                <span>10 (Worst Pain)</span>
              </div>
            </div>

            {/* VAS Pain Scale After Treatment */}
            <div
              id="voice-field-container-painScaleAfter"
              className={`p-3 rounded-2xl transition-all space-y-2 ${
                voiceInputStyle === 'guided' && activeStep?.id === 'painScaleAfter'
                  ? 'border-2 border-sky-500 ring-4 ring-sky-300/80 bg-sky-50/80 shadow-md scale-[1.01]'
                  : 'border border-slate-200/80 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-emerald-500" />
                  <span>VAS Pain After Treatment (0 - 10)</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-extrabold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                    {editableFields.painScaleAfter !== undefined ? editableFields.painScaleAfter : 3} / 10
                  </span>
                  <button
                    type="button"
                    onClick={() => onJumpToStep(getStepIndex('painScaleAfter'), true)}
                    className="text-sky-600 hover:text-sky-800 p-0.5 rounded hover:bg-sky-100 cursor-pointer"
                  >
                    <Mic className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={editableFields.painScaleAfter !== undefined ? editableFields.painScaleAfter : 3}
                onChange={(e) => setEditableFields((prev) => ({ ...prev, painScaleAfter: Number(e.target.value) }))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-[9.5px] text-slate-400 font-semibold px-0.5">
                <span>0 (Resolved)</span>
                <span>5 (Mild)</span>
                <span>10 (Severe)</span>
              </div>
            </div>
          </div>

          {/* Comorbid Conditions */}
          <div
            id="voice-field-container-comorbid"
            className={`p-3 rounded-2xl transition-all space-y-2 ${
              voiceInputStyle === 'guided' && activeStep?.id === 'comorbid'
                ? 'border-2 border-sky-500 ring-4 ring-sky-300/80 bg-sky-50/80 shadow-md scale-[1.01]'
                : 'border border-slate-200/80 bg-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-rose-500" />
                <span>Comorbid Conditions</span>
              </label>
              <button
                type="button"
                onClick={() => onJumpToStep(getStepIndex('comorbid'), true)}
                className="text-sky-600 hover:text-sky-800 p-0.5 rounded hover:bg-sky-100 cursor-pointer"
                title="Jump to speak Comorbid Conditions"
              >
                <Mic className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => toggleComorbid('diabetes')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  comorbidObj.diabetes
                    ? 'bg-rose-500 text-white border-rose-500 shadow-2xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {comorbidObj.diabetes ? '✓ Diabetes' : '+ Diabetes'}
              </button>
              <button
                type="button"
                onClick={() => toggleComorbid('hyperTension')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  comorbidObj.hyperTension
                    ? 'bg-rose-500 text-white border-rose-500 shadow-2xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {comorbidObj.hyperTension ? '✓ Hypertension / BP' : '+ Hypertension / BP'}
              </button>
              <button
                type="button"
                onClick={() => toggleComorbid('other')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  comorbidObj.other
                    ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {comorbidObj.other ? '✓ Thyroid / Other' : '+ Thyroid / Other'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MENU 3: INITIAL PHYSIOTHERAPY MODALITIES & INTERVENTIONS             */}
      {/* ==================================================================== */}
      {activeMenu === 'modalities' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <div
            id="voice-field-container-modalities"
            className={`p-3 rounded-2xl transition-all space-y-3 ${
              voiceInputStyle === 'guided' && activeStep?.id === 'modalities'
                ? 'border-2 border-sky-500 ring-4 ring-sky-300/80 bg-sky-50/80 shadow-md scale-[1.01]'
                : 'border border-slate-200/80 bg-white'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-600" />
                  <span>Physiotherapy Modalities & Interventions ({selectedModalitiesCount} Selected)</span>
                </label>
                <p className="text-[11px] text-slate-500">
                  Say therapies out loud (e.g. <em>"IFT, Ultrasound, and Exercises"</em>) or click any modality card:
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                {voiceInputStyle === 'guided' && activeStep?.id === 'modalities' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-white bg-sky-600 px-2 py-0.5 rounded-full animate-pulse">
                    <Mic className="w-2.5 h-2.5" /> Speaking Now
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onJumpToStep(getStepIndex('modalities'), true)}
                  className="text-sky-600 hover:text-sky-800 p-1 rounded hover:bg-sky-100 cursor-pointer"
                  title="Jump to speak Modalities"
                >
                  <Mic className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 15 Clinical Modalities Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
              {MODALITIES_LIST.map((mod) => {
                const currentList: string[] = Array.isArray(editableFields.modalities) ? editableFields.modalities : [];
                const isSelected = currentList.some(
                  (m) =>
                    m.toLowerCase().includes(mod.label.toLowerCase()) ||
                    mod.label.toLowerCase().includes(m.toLowerCase()) ||
                    m.toLowerCase() === mod.key.toLowerCase()
                );

                return (
                  <button
                    key={mod.key}
                    type="button"
                    onClick={() => toggleModality(mod.label)}
                    className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-sky-600 text-white border-sky-600 shadow-xs ring-2 ring-sky-300 scale-[1.01]'
                        : 'bg-slate-50/80 hover:bg-slate-100 text-slate-700 border-slate-200/90'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                        {mod.label}
                      </span>
                      {isSelected ? (
                        <span className="w-4 h-4 rounded-full bg-white text-sky-700 flex items-center justify-center text-[10px] font-black shrink-0">
                          ✓
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 bg-slate-200/60 px-1 py-0.2 rounded">
                          {mod.category}
                        </span>
                      )}
                    </div>
                    <p className={`text-[10px] line-clamp-1 leading-tight ${isSelected ? 'text-sky-100' : 'text-slate-500'}`}>
                      {mod.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Modality Instructions / Protocol Notes */}
          <div
            id="voice-field-container-treatmentNotes"
            className={`p-3 rounded-2xl transition-all space-y-1.5 ${
              voiceInputStyle === 'guided' && activeStep?.id === 'treatmentNotes'
                ? 'border-2 border-sky-500 ring-4 ring-sky-300/80 bg-sky-50/80 shadow-md scale-[1.01]'
                : 'border border-slate-200/80 bg-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
                Modality Protocol & Treatment Instructions
              </label>
              <button
                type="button"
                onClick={() => onJumpToStep(getStepIndex('treatmentNotes'), true)}
                className="text-sky-600 hover:text-sky-800 p-0.5 rounded hover:bg-sky-100 cursor-pointer"
                title="Jump to speak Treatment Notes"
              >
                <Mic className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              id="voice-input-treatmentNotes"
              type="text"
              value={editableFields.treatmentNotes || ''}
              onChange={(e) => setEditableFields((prev) => ({ ...prev, treatmentNotes: e.target.value }))}
              placeholder="e.g. Lumbar IFT 4-pole 15 mins daily, Maitland Grade II mobilization, core stabilization..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:border-sky-500 outline-none"
            />
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MENU 4: CONSULTATION FEE & PAYMENT COLLECTION                        */}
      {/* ==================================================================== */}
      {activeMenu === 'billing' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            {/* Visit Type */}
            <div
              id="voice-field-container-visitType"
              className={`p-2.5 rounded-xl transition-all ${
                voiceInputStyle === 'guided' && activeStep?.id === 'visitType'
                  ? 'border-2 border-sky-500 ring-4 ring-sky-300/80 bg-sky-50/80 shadow-md scale-[1.01]'
                  : 'border border-slate-200/80 bg-white'
              }`}
            >
              <div className="flex items-center justify-between pb-1">
                <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wide">
                  Visit Type
                </label>
                <button
                  type="button"
                  onClick={() => onJumpToStep(getStepIndex('visitType'), true)}
                  className="text-sky-600 hover:text-sky-800 p-0.5 rounded hover:bg-sky-100 cursor-pointer"
                  title="Jump to speak Visit Type"
                >
                  <Mic className="w-3 h-3" />
                </button>
              </div>
              <select
                id="voice-input-visitType"
                value={editableFields.visitType || 'Clinic'}
                onChange={(e) => setEditableFields((prev) => ({ ...prev, visitType: e.target.value as any }))}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:border-sky-500 outline-none"
              >
                <option value="Clinic">Clinic Visit</option>
                <option value="Home Visit">Home Visit</option>
                <option value="Online">Online Consultation</option>
              </select>
            </div>

            {/* Treatment Fee */}
            <div
              id="voice-field-container-treatmentFee"
              className={`p-2.5 rounded-xl transition-all ${
                voiceInputStyle === 'guided' && activeStep?.id === 'treatmentFee'
                  ? 'border-2 border-sky-500 ring-4 ring-sky-300/80 bg-sky-50/80 shadow-md scale-[1.01]'
                  : 'border border-slate-200/80 bg-white'
              }`}
            >
              <div className="flex items-center justify-between pb-1">
                <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1">
                  <IndianRupee className="w-3 h-3 text-emerald-600" /> Fee (₹)
                </label>
                <button
                  type="button"
                  onClick={() => onJumpToStep(getStepIndex('treatmentFee'), true)}
                  className="text-sky-600 hover:text-sky-800 p-0.5 rounded hover:bg-sky-100 cursor-pointer"
                  title="Jump to speak Treatment Fee"
                >
                  <Mic className="w-3 h-3" />
                </button>
              </div>
              <input
                id="voice-input-treatmentFee"
                type="number"
                value={editableFields.treatmentFee !== undefined && editableFields.treatmentFee !== null ? editableFields.treatmentFee : '500'}
                onChange={(e) => setEditableFields((prev) => ({ ...prev, treatmentFee: e.target.value }))}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-emerald-700 focus:border-sky-500 outline-none"
              />
              <div className="flex gap-1 pt-1.5 flex-wrap">
                {['0', '300', '500', '700', '1000'].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setEditableFields((prev) => ({ ...prev, treatmentFee: amt }))}
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded border cursor-pointer ${
                      String(editableFields.treatmentFee) === amt
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Method */}
            <div
              id="voice-field-container-paymentMethod"
              className={`p-2.5 rounded-xl transition-all ${
                voiceInputStyle === 'guided' && activeStep?.id === 'paymentMethod'
                  ? 'border-2 border-sky-500 ring-4 ring-sky-300/80 bg-sky-50/80 shadow-md scale-[1.01]'
                  : 'border border-slate-200/80 bg-white'
              }`}
            >
              <div className="flex items-center justify-between pb-1">
                <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1">
                  <CreditCard className="w-3 h-3 text-indigo-600" /> Mode of Payment
                </label>
                <button
                  type="button"
                  onClick={() => onJumpToStep(getStepIndex('paymentMethod'), true)}
                  className="text-sky-600 hover:text-sky-800 p-0.5 rounded hover:bg-sky-100 cursor-pointer"
                  title="Jump to speak Payment Method"
                >
                  <Mic className="w-3 h-3" />
                </button>
              </div>
              <select
                id="voice-input-paymentMethod"
                value={editableFields.paymentMethod || 'UPI'}
                onChange={(e) => setEditableFields((prev) => ({ ...prev, paymentMethod: e.target.value as any }))}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:border-sky-500 outline-none"
              >
                <option value="UPI">UPI / GPay / PhonePe / QR</option>
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="Due">Due / Pending</option>
                <option value="Bank Transfer">Bank Transfer / NEFT</option>
              </select>
            </div>
          </div>

          {/* Registration Summary & Final Submission Card */}
          <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border-2 border-emerald-300 rounded-2xl space-y-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="font-extrabold text-sm text-emerald-950">
                  Ready to Register:{' '}
                  <span className="underline decoration-emerald-500">
                    {editableFields.name || 'New Patient Record'}
                  </span>
                </h4>
                <p className="text-xs text-emerald-800 mt-0.5">
                  {missingMandatoryFields.length === 0 ? (
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                      <Check className="w-3.5 h-3.5" /> All 5 mandatory clinic fields are complete!
                    </span>
                  ) : (
                    <span className="text-rose-700 font-bold">
                      Pending mandatory fields: {missingMandatoryFields.join(', ')}
                    </span>
                  )}
                </p>
              </div>

              <button
                type="button"
                id="btn-voice-register-patient-complete"
                onClick={onConfirmAndExecute}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black rounded-xl shadow-md hover:shadow-lg cursor-pointer transition-all flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>Register Patient Record</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
