import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  X,
  Check,
  CheckCircle2,
  AlertCircle,
  UserPlus,
  Users,
  Edit3,
  Search,
  Navigation,
  FileDown,
  Receipt,
  RotateCcw,
  Loader2,
  Stethoscope,
  Phone,
  User,
  MapPin,
  IndianRupee,
  Activity,
  ArrowRight,
  HelpCircle,
  Volume2,
  VolumeX,
  Calendar,
  Trash2,
  ChevronLeft,
  ChevronRight,
  SkipForward,
  ListOrdered,
  Zap,
} from 'lucide-react';
import { Patient, PaymentMethod, VisitType } from '../types';
import { MainView } from './Header';
import {
  RecognizedClinicalFields,
  UnifiedVoiceCommandResult,
  VoiceActionType,
  executeUnifiedVoiceCommandWithAI,
  detectVoiceIntent,
  parseVoiceClinicalTranscript,
  parseSingleFieldSpokenValue,
} from '../utils/voiceFieldParser';
import { COMMON_DIAGNOSES, MODALITIES_LIST } from '../constants';
import { PatientVoiceGuidedForm } from './PatientVoiceGuidedForm';
import { ExistingPatientVoiceGuidedForm } from './ExistingPatientVoiceGuidedForm';
import { requestMicrophonePermission, checkMicrophonePermissionState } from '../utils/audioPermissionHelper';

export type PatientVoiceMenuId = 'demographics' | 'diagnosis' | 'modalities' | 'billing' | 'followup';

export interface PatientVoiceMenu {
  id: PatientVoiceMenuId;
  index: number;
  label: string;
  badgeLabel: string;
  description: string;
}

export const PATIENT_VOICE_MENUS: PatientVoiceMenu[] = [
  {
    id: 'demographics',
    index: 0,
    label: '1. Patient Demographics & Profile',
    badgeLabel: 'Demographics',
    description: 'Name, Age, Gender, Contact, Address, Height, Weight, Blood Group',
  },
  {
    id: 'diagnosis',
    index: 1,
    label: '2. Clinical Diagnosis & Assessment',
    badgeLabel: 'Diagnosis & Assessment',
    description: 'Diagnosis, Chief Complaints, VAS Pain Scale, Comorbidities',
  },
  {
    id: 'modalities',
    index: 2,
    label: '3. Initial Physiotherapy Modalities & Interventions',
    badgeLabel: 'Modalities & Rx',
    description: '15 Clinical Therapies: IFT, Ultrasound, Traction, Exercise, TENS',
  },
  {
    id: 'billing',
    index: 3,
    label: '4. Consultation Fee & Payment Collection',
    badgeLabel: 'Fee & Payment',
    description: 'Visit Type, Fee, Mode of Payment (UPI/Cash/Card/Bank)',
  },
];

export const EXISTING_PATIENT_VOICE_MENUS: PatientVoiceMenu[] = [
  {
    id: 'diagnosis',
    index: 0,
    label: '1. Clinical Progress & Complaints',
    badgeLabel: 'Progress & Notes',
    description: 'Patient current progress, symptoms relief, or new complaint',
  },
  {
    id: 'modalities',
    index: 1,
    label: '2. Modalities & Treatments Given',
    badgeLabel: 'Treatments Given',
    description: 'Physiotherapy interventions: IFT, Ultrasound, Exercises, Traction, TENS',
  },
  {
    id: 'followup',
    index: 2,
    label: '3. Follow-Up Session Scheduler',
    badgeLabel: 'Follow-Up Sessions',
    description: 'Dictate multiple dates & times to schedule follow-up appointments',
  },
];

export interface GuidedFieldStep {
  id: string;
  key: string;
  menuId: PatientVoiceMenuId;
  label: string;
  prompt: string;
  hint: string;
  required: boolean;
  type: 'text' | 'number' | 'select' | 'date' | 'multiselect';
  options?: string[];
  defaultValue?: any;
}

export const NEW_PATIENT_GUIDED_STEPS: GuidedFieldStep[] = [
  // ==================== MENU 1: Patient Demographics & Profile ====================
  {
    id: 'name',
    key: 'name',
    menuId: 'demographics',
    label: 'Patient Full Name',
    prompt: "Please tell the patient's full name",
    hint: 'e.g. Ramesh Kumar',
    required: true,
    type: 'text',
  },
  {
    id: 'age',
    key: 'age',
    menuId: 'demographics',
    label: 'Age (Years)',
    prompt: "Please tell the patient's age in years",
    hint: 'e.g. 45',
    required: true,
    type: 'number',
  },
  {
    id: 'sex',
    key: 'sex',
    menuId: 'demographics',
    label: 'Gender',
    prompt: 'Please tell gender: Male, Female, or Other',
    hint: 'Male / Female / Other',
    required: true,
    type: 'select',
    options: ['Male', 'Female', 'Other'],
    defaultValue: 'Male',
  },
  {
    id: 'contact',
    key: 'contact',
    menuId: 'demographics',
    label: 'Contact Phone Number',
    prompt: 'Please tell the 10-digit mobile phone number',
    hint: 'e.g. 98805 17715',
    required: true,
    type: 'text',
  },
  {
    id: 'address',
    key: 'address',
    menuId: 'demographics',
    label: 'Residential Address',
    prompt: 'Please tell residential address or locality',
    hint: 'e.g. Vijayanagar, Mysuru',
    required: true,
    type: 'text',
    defaultValue: 'Mysuru, Karnataka',
  },
  {
    id: 'date',
    key: 'date',
    menuId: 'demographics',
    label: 'Consultation Date',
    prompt: 'Consultation date is set to today. Say a date or next',
    hint: 'Today',
    required: false,
    type: 'date',
    defaultValue: new Date().toISOString().slice(0, 10),
  },
  {
    id: 'height',
    key: 'height',
    menuId: 'demographics',
    label: 'Height',
    prompt: "Please tell height, like 5 foot 6 inches, or say skip",
    hint: `e.g. 5'6" or 168 cm`,
    required: false,
    type: 'text',
    defaultValue: `5'6"`,
  },
  {
    id: 'weight',
    key: 'weight',
    menuId: 'demographics',
    label: 'Weight (kg)',
    prompt: "Please tell weight in kilograms, or say skip",
    hint: 'e.g. 65 kg',
    required: false,
    type: 'number',
    defaultValue: '65',
  },
  {
    id: 'bloodGroup',
    key: 'bloodGroup',
    menuId: 'demographics',
    label: 'Blood Group',
    prompt: 'Please tell blood group, like O positive or B positive, or say skip',
    hint: 'e.g. O+',
    required: false,
    type: 'select',
    options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    defaultValue: 'O+',
  },
  {
    id: 'referredBy',
    key: 'referredBy',
    menuId: 'demographics',
    label: 'Referred By',
    prompt: 'Referred by doctor or self? Say Self or doctor name',
    hint: 'Self / Dr. Name',
    required: false,
    type: 'text',
    defaultValue: 'Self',
  },
  {
    id: 'seenBy',
    key: 'seenBy',
    menuId: 'demographics',
    label: 'Attending Physiotherapist',
    prompt: 'Attending physiotherapist name, or say next for R. Chandrashekar',
    hint: 'R. Chandrashekar',
    required: false,
    type: 'text',
    defaultValue: 'R. Chandrashekar',
  },

  // ==================== MENU 2: Clinical Diagnosis & Assessment ====================
  {
    id: 'diagnosis',
    key: 'diagnosis',
    menuId: 'diagnosis',
    label: 'Clinical Diagnosis / Chief Complaint',
    prompt: 'Moving to Clinical Diagnosis. Please tell the primary diagnosis or chief complaint',
    hint: 'e.g. Frozen Shoulder, Cervical Spondylosis, Lumbar Disc Bulge',
    required: true,
    type: 'text',
  },
  {
    id: 'history',
    key: 'history',
    menuId: 'diagnosis',
    label: 'Clinical History & Complaints',
    prompt: 'Please tell clinical complaints, symptoms, or onset history. Or say skip',
    hint: 'e.g. Severe shoulder stiffness for 3 months, worse at night',
    required: false,
    type: 'text',
  },
  {
    id: 'painScaleBefore',
    key: 'painScaleBefore',
    menuId: 'diagnosis',
    label: 'Initial VAS Pain Scale Before Treatment (0 - 10)',
    prompt: 'Please tell initial pain score from 0 to 10 before treatment',
    hint: '0 (No Pain) to 10 (Worst Pain)',
    required: false,
    type: 'number',
    defaultValue: 6,
  },
  {
    id: 'painScaleAfter',
    key: 'painScaleAfter',
    menuId: 'diagnosis',
    label: 'VAS Pain Scale After Treatment (0 - 10)',
    prompt: 'Please tell pain score from 0 to 10 after initial session, or say skip',
    hint: '0 to 10 (Expected/Assessed)',
    required: false,
    type: 'number',
    defaultValue: 3,
  },
  {
    id: 'comorbid',
    key: 'comorbid',
    menuId: 'diagnosis',
    label: 'Comorbid Conditions',
    prompt: 'Any comorbid conditions like Diabetes, BP, or Thyroid? Or say none',
    hint: 'Diabetes / BP / Thyroid / None',
    required: false,
    type: 'text',
  },

  // ==================== MENU 3: Initial Physiotherapy Modalities & Interventions ====================
  {
    id: 'modalities',
    key: 'modalities',
    menuId: 'modalities',
    label: 'Physiotherapy Modalities & Interventions',
    prompt: 'Moving to Modalities. Please specify initial treatments, like IFT, Ultrasound, or Exercises',
    hint: 'e.g. IFT, Ultrasound, Moist Therapy, Exercises, Traction',
    required: false,
    type: 'multiselect',
  },
  {
    id: 'treatmentNotes',
    key: 'treatmentNotes',
    menuId: 'modalities',
    label: 'Treatment Plan / Protocol Notes',
    prompt: 'Any specific modality instructions, duration, or joint area? Or say skip',
    hint: 'e.g. IFT 15 mins Lumbar, gentle core strengthening',
    required: false,
    type: 'text',
  },

  // ==================== MENU 4: Consultation Fee & Payment Collection ====================
  {
    id: 'visitType',
    key: 'visitType',
    menuId: 'billing',
    label: 'Visit Type',
    prompt: 'Moving to Consultation Fee. Please tell Clinic Visit or Home Visit',
    hint: 'Clinic / Home Visit',
    required: false,
    type: 'select',
    options: ['Clinic', 'Home Visit'],
    defaultValue: 'Clinic',
  },
  {
    id: 'treatmentFee',
    key: 'treatmentFee',
    menuId: 'billing',
    label: 'Consultation Fee (₹)',
    prompt: 'Please tell consultation fee in rupees, or say default 500',
    hint: 'e.g. 500',
    required: false,
    type: 'text',
    defaultValue: '500',
  },
  {
    id: 'paymentMethod',
    key: 'paymentMethod',
    menuId: 'billing',
    label: 'Payment Method',
    prompt: 'Please tell payment method: UPI, Cash, Card, or Bank Transfer',
    hint: 'UPI / Cash / Card / Due / Bank Transfer',
    required: false,
    type: 'select',
    options: ['UPI', 'Cash', 'Card', 'Due', 'Bank Transfer'],
    defaultValue: 'UPI',
  },
];

export const EXISTING_PATIENT_GUIDED_STEPS: GuidedFieldStep[] = [
  {
    id: 'notes',
    key: 'notes',
    menuId: 'diagnosis',
    label: 'Follow-Up Progress / Complaint',
    prompt: "Please tell the patient's current clinical progress or complaint",
    hint: 'e.g. 70% pain reduced, improved shoulder flexion',
    required: true,
    type: 'text',
  },
  {
    id: 'modalities',
    key: 'modalities',
    menuId: 'modalities',
    label: 'Treatments Given / Modalities',
    prompt: 'Please specify treatments given, like IFT, Ultrasound, or Exercises',
    hint: 'e.g. IFT 15 mins, Ultrasound, Exercises',
    required: false,
    type: 'multiselect',
  },
  {
    id: 'followUps',
    key: 'followUps',
    menuId: 'followup',
    label: 'Follow-Up Session Scheduler',
    prompt: 'Please dictate follow-up session dates and times, like tomorrow at 10 AM and Friday at 4 PM',
    hint: 'e.g. tomorrow at 10 AM and Friday at 4 PM',
    required: false,
    type: 'text',
  },
];

interface UnifiedVoiceCommandModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  activePatient: Patient | null;
  initialMode?: 'new' | 'existing';
  initialPatientId?: string | null;
  currentView: MainView;
  onAddPatient: (data: Partial<Patient>) => void;
  onUpdatePatientFields: (patientId: string, fields: RecognizedClinicalFields) => void;
  onNavigate: (view: MainView) => void;
  onSearchPatients: (query: string) => void;
  onDownloadPdf: () => void;
  onCreateReceipt: () => void;
  onSelectActivePatient: (patientId: string) => void;
}

// Audio chime: muted to prevent repetitive sounds and audio glitches
function playChime(_type?: 'success' | 'start' | 'click') {
  // Silent - completely stops repetitive audio beeps on mobile
}

export const UnifiedVoiceCommandModal: React.FC<UnifiedVoiceCommandModalProps> = ({
  isOpen,
  onClose,
  patients,
  activePatient,
  initialMode = 'new',
  initialPatientId = null,
  currentView,
  onAddPatient,
  onUpdatePatientFields,
  onNavigate,
  onSearchPatients,
  onDownloadPdf,
  onCreateReceipt,
  onSelectActivePatient,
}) => {
  // Voice Command Mode: 'new' (1. Add New Patient) or 'existing' (2. Select from Existing Patients)
  const [commandMode, setCommandMode] = useState<'new' | 'existing'>(initialMode || 'new');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(
    initialMode === 'existing' ? (initialPatientId || activePatient?.id || null) : null
  );
  const [patientSearchFilter, setPatientSearchFilter] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [commandResult, setCommandResult] = useState<UnifiedVoiceCommandResult | null>(null);
  const [editableFields, setEditableFields] = useState<RecognizedClinicalFields>({});
  const [hasSpeechSupport, setHasSpeechSupport] = useState(true);
  const [executedToast, setExecutedToast] = useState<string | null>(null);

  // Field-by-Field Guided Voice State
  const [voiceInputStyle, setVoiceInputStyle] = useState<'guided' | 'all_in_one'>('guided');
  const [activeMenu, setActiveMenu] = useState<PatientVoiceMenuId>('demographics');
  const activeMenuRef = useRef<PatientVoiceMenuId>('demographics');
  activeMenuRef.current = activeMenu;

  const [activeFieldStepIndex, setActiveFieldStepIndex] = useState<number>(0);
  const [isTtsEnabled, setIsTtsEnabled] = useState<boolean>(false);
  const isTtsEnabledRef = useRef<boolean>(false);
  isTtsEnabledRef.current = isTtsEnabled;

  const [isSpeakingPrompt, setIsSpeakingPrompt] = useState<boolean>(false);
  const [fieldCaptureFeedback, setFieldCaptureFeedback] = useState<
    Record<string, { status: 'captured' | 'error'; message: string }>
  >({});
  const [lastInterimPerField, setLastInterimPerField] = useState<string>('');

  // Mandatory fields validation state for new patient registration
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [touchedForm, setTouchedForm] = useState(false);

  const recognitionRef = useRef<any>(null);
  const voiceInputStyleRef = useRef(voiceInputStyle);
  voiceInputStyleRef.current = voiceInputStyle;

  const activeFieldStepIndexRef = useRef(activeFieldStepIndex);
  activeFieldStepIndexRef.current = activeFieldStepIndex;

  const commandModeRef = useRef(commandMode);
  commandModeRef.current = commandMode;

  const editableFieldsRef = useRef(editableFields);
  editableFieldsRef.current = editableFields;

  const isSpeakingTtsRef = useRef(false);
  const isMicActiveDesiredRef = useRef(true);
  const safeRestartRecognitionRef = useRef<(delay?: number) => void>(() => {});
  const startListeningOnceRef = useRef<() => void>(() => {});
  const stopListeningDueToSilenceRef = useRef<() => void>(() => {});
  const processCapturedUtteranceRef = useRef<(spoken: string) => void>(() => {});
  const silenceTimerRef = useRef<any>(null);
  const hasSpokenInTurnRef = useRef<boolean>(false);
  const accumulatedTurnTranscriptRef = useRef<string>('');
  const autoAdvanceTimerRef = useRef<any>(null);
  const autoAdvanceIntervalRef = useRef<any>(null);
  const formScrollContainerRef = useRef<HTMLDivElement>(null);

  // Microphone permission prompt state (crucial for Android APK & tablet browsers)
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);

  // Voice pacing mode: 'auto' (Snappy 1.2s auto-move from field to field - default), 'relaxed' (2.5s pause), or 'manual' (no auto-advance, user says 'Next' or taps)
  const [voicePacingMode, setVoicePacingMode] = useState<'auto' | 'relaxed' | 'manual'>(() => {
    try {
      const stored = localStorage.getItem('namana_voice_pacing');
      if (stored === 'manual' || stored === 'relaxed') {
        return stored as any;
      }
      return 'auto';
    } catch {
      return 'auto';
    }
  });
  const voicePacingModeRef = useRef(voicePacingMode);
  voicePacingModeRef.current = voicePacingMode;

  // Visual countdown for auto-advance (null when not counting down, or number of seconds remaining)
  const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState<number | null>(null);

  const clearAutoAdvanceTimers = () => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    if (autoAdvanceIntervalRef.current) {
      clearInterval(autoAdvanceIntervalRef.current);
      autoAdvanceIntervalRef.current = null;
    }
    setAutoAdvanceCountdown(null);
  };

  const handleUpdatePacingMode = (mode: 'auto' | 'relaxed' | 'manual') => {
    setVoicePacingMode(mode);
    voicePacingModeRef.current = mode;
    try {
      localStorage.setItem('namana_voice_pacing', mode);
    } catch {}
    clearAutoAdvanceTimers();
  };

  // Explicit action to prompt user for microphone permission on Android APK / tablet
  const handleRequestMicPermission = async () => {
    setErrorMsg(null);
    const res = await requestMicrophonePermission();
    if (res.granted) {
      setMicPermissionDenied(false);
      if (recognitionRef.current) {
        isMicActiveDesiredRef.current = true;
        try {
          recognitionRef.current.start();
          setIsListening(true);
        } catch {
          // May already be running
        }
      }
    } else {
      setMicPermissionDenied(true);
      setErrorMsg(res.error || 'Microphone access is still denied. Please check device app permissions for Namana Physio.');
    }
  };

  // Current guided steps array based on active mode
  const currentGuidedSteps = useMemo(() => {
    return commandMode === 'new' ? NEW_PATIENT_GUIDED_STEPS : EXISTING_PATIENT_GUIDED_STEPS;
  }, [commandMode]);

  const currentGuidedStepsRef = useRef<GuidedFieldStep[]>(currentGuidedSteps);
  currentGuidedStepsRef.current = currentGuidedSteps;

  const activeGuidedStep = currentGuidedSteps[activeFieldStepIndex] || currentGuidedSteps[0];

  // Speech Synthesis helper to speak questions aloud
  const speakFieldPrompt = (promptText: string) => {
    if (!isTtsEnabledRef.current) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(promptText);
      utterance.lang = 'en-IN';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const matchVoice =
        voices.find(
          (v) =>
            v.lang === 'en-IN' ||
            v.lang.includes('en_IN') ||
            v.name.toLowerCase().includes('india')
        ) || voices.find((v) => v.lang.startsWith('en'));
      if (matchVoice) utterance.voice = matchVoice;

      isSpeakingTtsRef.current = true;
      setIsSpeakingPrompt(true);

      // On mobile / phone: temporarily pause recognition while TTS speaks through speaker
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }

      let completed = false;
      const watchdog = setTimeout(() => {
        if (!completed && isSpeakingTtsRef.current) {
          completed = true;
          isSpeakingTtsRef.current = false;
          setIsSpeakingPrompt(false);
          safeRestartRecognitionRef.current(150);
        }
      }, 3500);

      utterance.onend = () => {
        if (completed) return;
        completed = true;
        clearTimeout(watchdog);
        setTimeout(() => {
          isSpeakingTtsRef.current = false;
          setIsSpeakingPrompt(false);
          // Crucial for phones: safely re-arm microphone now that TTS speaker output has completed!
          safeRestartRecognitionRef.current(150);
        }, 150);
      };

      utterance.onerror = () => {
        if (completed) return;
        completed = true;
        clearTimeout(watchdog);
        isSpeakingTtsRef.current = false;
        setIsSpeakingPrompt(false);
        safeRestartRecognitionRef.current(150);
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis error:', err);
      isSpeakingTtsRef.current = false;
      setIsSpeakingPrompt(false);
      safeRestartRecognitionRef.current(150);
    }
  };

  // Scroll and focus particular field
  const scrollAndFocusField = (stepId: string) => {
    setTimeout(() => {
      const containerEl = document.getElementById(`voice-field-container-${stepId}`);
      if (containerEl) {
        containerEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      const inputEl = document.getElementById(`voice-input-${stepId}`);
      if (inputEl && inputEl.tagName !== 'SELECT') {
        inputEl.focus();
      }
    }, 120);
  };

  // Helper to switch mode to Existing Patient / Follow-up workflow
  const handleSwitchToExistingMode = (overridePatientId?: string | null) => {
    clearAutoAdvanceTimers();
    setCommandMode('existing');
    commandModeRef.current = 'existing';
    setActiveMenu('diagnosis');
    activeMenuRef.current = 'diagnosis';
    setActiveFieldStepIndex(0);
    activeFieldStepIndexRef.current = 0;
    setErrorMsg(null);
    let targetId = overridePatientId || selectedPatientId;
    if (!targetId && patients.length > 0) {
      const firstActive = patients.find((p) => !p.deleted);
      if (firstActive) {
        targetId = firstActive.id;
        setSelectedPatientId(firstActive.id);
      }
    }
    const target = (targetId && patients.find((p) => p.id === targetId)) || activePatient;
    const initialFollowUpDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const defaultExistingFields: RecognizedClinicalFields = {
      notes: '',
      modalities: [],
      followUps: [
        {
          action: 'add',
          date: initialFollowUpDate,
          time: '10:00:00',
          notes: 'Scheduled follow-up session',
          fee: target?.treatmentFee || '500',
          paymentMethod: target?.paymentMethod || 'UPI',
          visitType: target?.visitType || 'Clinic',
          seenBy: target?.seenBy || 'Dr. Vinay',
        },
      ],
      followUp: {
        action: 'add',
        date: initialFollowUpDate,
        time: '10:00:00',
        notes: 'Scheduled follow-up session',
        fee: target?.treatmentFee || '500',
        paymentMethod: target?.paymentMethod || 'UPI',
        visitType: target?.visitType || 'Clinic',
        seenBy: target?.seenBy || 'Dr. Vinay',
      },
    };
    setEditableFields(defaultExistingFields);
    editableFieldsRef.current = defaultExistingFields;
    setCommandResult({
      action: 'add_followup',
      actionSummary: `Voice Edit & Follow-Up for ${target?.name || 'Selected Patient'}`,
      confidence: 1,
      fields: defaultExistingFields,
    });
    setTimeout(() => {
      if (isTtsEnabledRef.current) {
        speakFieldPrompt(EXISTING_PATIENT_GUIDED_STEPS[0].prompt);
      }
    }, 400);
  };

  // Helper to switch mode to New Patient registration workflow
  const handleSwitchToNewMode = () => {
    clearAutoAdvanceTimers();
    setCommandMode('new');
    commandModeRef.current = 'new';
    setSelectedPatientId(null);
    setActiveMenu('demographics');
    activeMenuRef.current = 'demographics';
    setActiveFieldStepIndex(0);
    activeFieldStepIndexRef.current = 0;
    setErrorMsg(null);
    const defaultNewFields: RecognizedClinicalFields = {
      address: 'Mysuru, Karnataka',
      date: new Date().toISOString().slice(0, 10),
      treatmentFee: '500',
      paymentMethod: 'UPI',
      visitType: 'Clinic',
      sex: 'Male',
      seenBy: 'R. Chandrashekar, BPT, MIAP',
      referredBy: 'Self',
    };
    setEditableFields(defaultNewFields);
    editableFieldsRef.current = defaultNewFields;
    setCommandResult({
      action: 'create_patient',
      actionSummary: 'Register New Patient (Guided Voice Assistant)',
      confidence: 1,
      fields: defaultNewFields,
    });
    setTimeout(() => {
      scrollAndFocusField('name');
      if (isTtsEnabledRef.current) {
        speakFieldPrompt(NEW_PATIENT_GUIDED_STEPS[0].prompt);
      }
    }, 400);
  };

  // Forward ref declarations for navigation
  const handleNextFieldStepRef = useRef<() => void>(() => {});
  const handlePrevFieldStepRef = useRef<() => void>(() => {});
  const handleGoToMenuRef = useRef<(menuId: PatientVoiceMenuId) => void>(() => {});
  const handleNextMenuRef = useRef<() => void>(() => {});
  const handlePrevMenuRef = useRef<() => void>(() => {});

  // Jump to specific field step
  const handleJumpToFieldStep = (newIndex: number, speak: boolean = true) => {
    clearAutoAdvanceTimers();
    const steps = currentGuidedStepsRef.current;
    const safeIndex = Math.max(0, Math.min(newIndex, steps.length - 1));
    setActiveFieldStepIndex(safeIndex);
    activeFieldStepIndexRef.current = safeIndex;

    const targetStep = steps[safeIndex];
    if (targetStep) {
      // Auto-switch menu tab if navigating to a field in another menu
      if (targetStep.menuId && targetStep.menuId !== activeMenuRef.current) {
        setActiveMenu(targetStep.menuId);
        activeMenuRef.current = targetStep.menuId;
      }
      scrollAndFocusField(targetStep.id);
      if (speak && isTtsEnabledRef.current) {
        speakFieldPrompt(targetStep.prompt);
      } else if (voicePacingModeRef.current !== 'manual') {
        setTimeout(() => {
          startListeningOnceRef.current?.();
        }, 300);
      }
    }
  };

  // Advance to next step
  const handleNextFieldStep = () => {
    clearAutoAdvanceTimers();
    const currentIndex = activeFieldStepIndexRef.current;
    const steps = currentGuidedStepsRef.current;
    if (currentIndex < steps.length - 1) {
      handleJumpToFieldStep(currentIndex + 1, true);
    } else {
      // Completed last step!
      if (commandModeRef.current === 'existing') {
        speakFieldPrompt('Follow-up details are complete. You can click Add Follow-up or say submit or schedule.');
        return;
      }
      const errs = validateNewPatient(editableFieldsRef.current);
      if (Object.keys(errs).length === 0) {
        speakFieldPrompt('All mandatory fields are complete. You can click Register Patient Record or say submit.');
      } else {
        const firstErrKey = Object.keys(errs)[0];
        const stepIdx = steps.findIndex((s) => s.key === firstErrKey);
        if (stepIdx !== -1) {
          handleJumpToFieldStep(stepIdx, true);
          speakFieldPrompt(`Please check: ${errs[firstErrKey]}`);
        }
      }
    }
  };

  // Go to previous step
  const handlePrevFieldStep = () => {
    clearAutoAdvanceTimers();
    const currentIndex = activeFieldStepIndexRef.current;
    if (currentIndex > 0) {
      handleJumpToFieldStep(currentIndex - 1, true);
    }
  };

  // Switch to specific menu
  const handleGoToMenu = (menuId: PatientVoiceMenuId) => {
    clearAutoAdvanceTimers();
    setActiveMenu(menuId);
    activeMenuRef.current = menuId;
    const steps = currentGuidedStepsRef.current;
    const firstStepIdx = steps.findIndex((s) => s.menuId === menuId);
    if (firstStepIdx !== -1) {
      handleJumpToFieldStep(firstStepIdx, true);
    } else {
      const currentMenus = commandModeRef.current === 'new' ? PATIENT_VOICE_MENUS : EXISTING_PATIENT_VOICE_MENUS;
      const menuObj = currentMenus.find((m) => m.id === menuId);
      if (menuObj && isTtsEnabledRef.current) {
        speakFieldPrompt(`Switched to ${menuObj.badgeLabel}.`);
      }
    }
  };

  // Advance to next menu
  const handleNextMenu = () => {
    clearAutoAdvanceTimers();
    const currentMenus = commandModeRef.current === 'new' ? PATIENT_VOICE_MENUS : EXISTING_PATIENT_VOICE_MENUS;
    const currentMenuIdx = currentMenus.findIndex((m) => m.id === activeMenuRef.current);
    if (currentMenuIdx !== -1 && currentMenuIdx < currentMenus.length - 1) {
      handleGoToMenu(currentMenus[currentMenuIdx + 1].id);
    } else {
      if (commandModeRef.current === 'new') {
        speakFieldPrompt('You are on the final menu: Consultation Fee & Payment Collection. Say submit to finish.');
      } else {
        speakFieldPrompt('You are on the final menu: Follow-Up Session Scheduler. Say schedule or submit to finish.');
      }
    }
  };

  // Return to previous menu
  const handlePrevMenu = () => {
    clearAutoAdvanceTimers();
    const currentMenus = commandModeRef.current === 'new' ? PATIENT_VOICE_MENUS : EXISTING_PATIENT_VOICE_MENUS;
    const currentMenuIdx = currentMenus.findIndex((m) => m.id === activeMenuRef.current);
    if (currentMenuIdx > 0) {
      handleGoToMenu(currentMenus[currentMenuIdx - 1].id);
    }
  };

  handleNextFieldStepRef.current = handleNextFieldStep;
  handlePrevFieldStepRef.current = handlePrevFieldStep;
  handleGoToMenuRef.current = handleGoToMenu;
  handleNextMenuRef.current = handleNextMenu;
  handlePrevMenuRef.current = handlePrevMenu;

  // Validate mandatory fields for new patient registration
  const validateNewPatient = (fields: RecognizedClinicalFields): Record<string, string> => {
    const errs: Record<string, string> = {};

    const name = (fields.name || '').trim();
    if (!name || name.toLowerCase() === 'new patient' || name.toLowerCase() === 'patient') {
      errs.name = 'Patient Full Name is required';
    } else if (name.length < 2) {
      errs.name = 'Patient name must be at least 2 characters';
    }

    const ageStr = String(fields.age ?? '').trim();
    if (!ageStr) {
      errs.age = 'Age is required';
    } else {
      const ageNum = Number(ageStr);
      if (isNaN(ageNum) || ageNum <= 0 || ageNum > 120) {
        errs.age = 'Enter a valid age (1 - 120)';
      }
    }

    const contact = (fields.contact || '').trim();
    const cleanPhone = contact.replace(/\D/g, '');
    if (!contact) {
      errs.contact = 'Contact phone number is required';
    } else if (cleanPhone.length < 7) {
      errs.contact = 'Enter a valid phone number (at least 7 digits)';
    }

    const address = (fields.address || '').trim();
    if (!address) {
      errs.address = 'Residential address is required';
    }

    const diagnosis = (fields.diagnosis || '').trim();
    if (!diagnosis) {
      errs.diagnosis = 'Clinical diagnosis / primary complaint is required';
    }

    const date = (fields.date || '').trim();
    if (!date) {
      errs.date = 'Date of consultation is required';
    }

    // Duplicate check with existing active clinic patients
    if (name && cleanPhone.length >= 8) {
      const duplicate = patients.find(
        (p) =>
          !p.deleted &&
          (p.contact || '').replace(/\D/g, '') === cleanPhone &&
          p.name.trim().toLowerCase() === name.toLowerCase()
      );
      if (duplicate) {
        errs.name = `Duplicate: Patient "${duplicate.name}" is already registered (ID: ${duplicate.regNo || duplicate.id})`;
      }
    }

    return errs;
  };

  // Missing mandatory fields list for prominent UI warning
  const missingMandatoryFields = useMemo(() => {
    if (commandResult?.action !== 'create_patient') return [];
    const missing: string[] = [];
    const name = (editableFields.name || '').trim();
    if (!name || name.toLowerCase() === 'new patient' || name.toLowerCase() === 'patient' || name.length < 2) {
      missing.push('Patient Name');
    }
    const ageStr = String(editableFields.age ?? '').trim();
    if (!ageStr || isNaN(Number(ageStr)) || Number(ageStr) <= 0 || Number(ageStr) > 120) {
      missing.push('Age');
    }
    const contact = (editableFields.contact || '').trim();
    const cleanPhone = contact.replace(/\D/g, '');
    if (!contact || cleanPhone.length < 7) {
      missing.push('Contact Phone');
    }
    const address = (editableFields.address || '').trim();
    if (!address) {
      missing.push('Residential Address');
    }
    const diagnosis = (editableFields.diagnosis || '').trim();
    if (!diagnosis) {
      missing.push('Clinical Diagnosis');
    }
    const date = (editableFields.date || '').trim();
    if (!date) {
      missing.push('Consultation Date');
    }
    return missing;
  }, [commandResult?.action, editableFields]);

  // Synchronize mode and selected patient when modal opens
  useEffect(() => {
    if (isOpen) {
      const mode = initialMode || 'new';
      setCommandMode(mode);
      setActiveFieldStepIndex(0);
      setFieldCaptureFeedback({});
      setLastInterimPerField('');
      setTranscript('');
      setInterimTranscript('');
      setErrorMsg(null);
      setPatientSearchFilter('');
      setFormErrors({});
      setTouchedForm(false);

      if (mode === 'existing') {
        const targetId = initialPatientId || activePatient?.id || null;
        setSelectedPatientId(targetId);
        setActiveMenu('diagnosis');
        const target = (targetId && patients.find((p) => p.id === targetId)) || activePatient;
        const initialFollowUpDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        const defaultExistingFields: RecognizedClinicalFields = {
          notes: '',
          modalities: [],
          followUps: [
            {
              action: 'add',
              date: initialFollowUpDate,
              time: '10:00:00',
              notes: 'Scheduled follow-up session',
              fee: target?.treatmentFee || '500',
              paymentMethod: target?.paymentMethod || 'UPI',
              visitType: target?.visitType || 'Clinic',
              seenBy: target?.seenBy || 'Dr. Vinay',
            },
          ],
          followUp: {
            action: 'add',
            date: initialFollowUpDate,
            time: '10:00:00',
            notes: 'Scheduled follow-up session',
            fee: target?.treatmentFee || '500',
            paymentMethod: target?.paymentMethod || 'UPI',
            visitType: target?.visitType || 'Clinic',
            seenBy: target?.seenBy || 'Dr. Vinay',
          },
        };
        setEditableFields(defaultExistingFields);
        setCommandResult({
          action: 'add_followup',
          actionSummary: `Voice Edit & Follow-Up for ${target?.name || 'Selected Patient'}`,
          confidence: 1,
          fields: defaultExistingFields,
        });

        setTimeout(() => {
          if (isTtsEnabled) {
            speakFieldPrompt(EXISTING_PATIENT_GUIDED_STEPS[0].prompt);
          }
        }, 500);
      } else {
        // Crucial: In 'new' mode, explicitly do NOT default to last patient data entered
        setSelectedPatientId(null);
        const defaultNewFields: RecognizedClinicalFields = {
          address: 'Mysuru, Karnataka',
          date: new Date().toISOString().slice(0, 10),
          treatmentFee: '500',
          paymentMethod: 'UPI',
          visitType: 'Clinic',
          sex: 'Male',
          seenBy: 'Dr. Vinay',
          referredBy: 'Self',
        };
        setEditableFields(defaultNewFields);
        setCommandResult({
          action: 'create_patient',
          actionSummary: 'Register New Patient (Guided Voice Assistant)',
          confidence: 1,
          fields: defaultNewFields,
        });

        // Auto-prompt the first question ("Please tell the patient's full name")
        setTimeout(() => {
          scrollAndFocusField('name');
          if (isTtsEnabled) {
            speakFieldPrompt(NEW_PATIENT_GUIDED_STEPS[0].prompt);
          }
        }, 500);
      }
    }
  }, [isOpen, initialMode, initialPatientId]);

  // Initialize Speech Recognition API
  useEffect(() => {
    if (!isOpen) return;

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setHasSpeechSupport(false);
      return;
    }

    // Proactively verify & request microphone permission on Android APK / WebView / Mobile
    requestMicrophonePermission().then((res) => {
      if (!res.granted && res.error) {
        setMicPermissionDenied(true);
        console.warn('Initial mic permission prompt result:', res);
      } else {
        setMicPermissionDenied(false);
      }
    });

    try {
      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-IN'; // Optimized for Indian clinical English (Mysuru / Karnataka context)

      let restartTimer: any = null;
      const safeRestartRecognition = (delay = 200) => {
        if (restartTimer) {
          clearTimeout(restartTimer);
          restartTimer = null;
        }
        restartTimer = setTimeout(() => {
          if (!isMicActiveDesiredRef.current || isSpeakingTtsRef.current) return;
          if (!recognitionRef.current) return;
          try {
            recognitionRef.current.start();
            setIsListening(true);
          } catch (err: any) {
            if (err?.name === 'InvalidStateError' || String(err).includes('already started')) {
              setIsListening(true);
            } else {
              // Secondary retry for mobile WebKit / Android Chrome recovery
              setTimeout(() => {
                if (isMicActiveDesiredRef.current && !isSpeakingTtsRef.current && recognitionRef.current) {
                  try {
                    recognitionRef.current.start();
                    setIsListening(true);
                  } catch {
                    // ignore
                  }
                }
              }, 350);
            }
          }
        }, delay);
      };
      safeRestartRecognitionRef.current = safeRestartRecognition;

      // Stop listening after 2 seconds gap of silence
      const stopListeningDueToSilence = () => {
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }

        isMicActiveDesiredRef.current = false;
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch {
            // ignore
          }
        }
        setIsListening(false);

        const fullSpoken = (accumulatedTurnTranscriptRef.current || '').trim();
        hasSpokenInTurnRef.current = false;
        accumulatedTurnTranscriptRef.current = '';
        setLastInterimPerField('');
        setInterimTranscript('');

        if (fullSpoken) {
          processCapturedUtteranceRef.current(fullSpoken);
        }
      };
      stopListeningDueToSilenceRef.current = stopListeningDueToSilence;

      // Single-shot listen: listens until something is said, then stops if there is gap of 2 seconds
      const startListeningOnce = () => {
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        hasSpokenInTurnRef.current = false;
        accumulatedTurnTranscriptRef.current = '';
        isMicActiveDesiredRef.current = true;
        setLastInterimPerField('');
        setInterimTranscript('');

        if (recognitionRef.current) {
          try {
            recognitionRef.current.start();
            setIsListening(true);
          } catch (e: any) {
            if (e?.name === 'InvalidStateError' || String(e).includes('already started')) {
              setIsListening(true);
            }
          }
        }
      };
      startListeningOnceRef.current = startListeningOnce;

      recognition.onstart = () => {
        setIsListening(true);
        setMicPermissionDenied(false);
        setErrorMsg(null);
        // Completely silent: NO repetitive chime!
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        let currentFinal = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            currentFinal += event.results[i][0].transcript;
          } else {
            currentInterim += event.results[i][0].transcript;
          }
        }

        // If assistant is currently speaking the prompt out loud, ignore sound so it doesn't self-dictate
        if (isSpeakingTtsRef.current) return;

        const currentSnippet = (currentFinal || currentInterim).trim();
        if (!currentSnippet) return;

        // User has spoken!
        hasSpokenInTurnRef.current = true;

        if (currentFinal) {
          accumulatedTurnTranscriptRef.current = accumulatedTurnTranscriptRef.current
            ? `${accumulatedTurnTranscriptRef.current} ${currentFinal.trim()}`
            : currentFinal.trim();
        }

        const liveText = accumulatedTurnTranscriptRef.current
          ? `${accumulatedTurnTranscriptRef.current} ${currentInterim.trim()}`.trim()
          : currentInterim.trim() || currentSnippet;

        setLastInterimPerField(liveText);
        setInterimTranscript(liveText);
        clearAutoAdvanceTimers();

        // 2 SECONDS SILENCE GAP TIMER:
        // "it should stop if there is gap for 2 seconds"
        // Dynamically tuned: for snappy fields like Age, once a valid age is detected, stop after 800ms of silence
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }

        const steps = commandModeRef.current === 'new' ? NEW_PATIENT_GUIDED_STEPS : EXISTING_PATIENT_GUIDED_STEPS;
        const curStep = steps[activeFieldStepIndexRef.current] || steps[0];
        const isAgeStep = curStep?.key === 'age';
        const hasValidAgeNow = isAgeStep && parseSingleFieldSpokenValue('age', liveText).isValid;
        const silenceGapMs = hasValidAgeNow ? 800 : (currentFinal ? 1200 : 2000);

        silenceTimerRef.current = setTimeout(() => {
          stopListeningDueToSilenceRef.current();
        }, silenceGapMs);
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech') {
          // If speech was already detected and now silence occurred, finalize immediately
          if (hasSpokenInTurnRef.current) {
            stopListeningDueToSilenceRef.current();
            return;
          }
          // If nothing has been said yet ("till something is said"), silently remain listening
          if (isMicActiveDesiredRef.current && !isSpeakingTtsRef.current) {
            safeRestartRecognition(150);
          }
          return;
        }
        if (event.error === 'aborted') {
          return;
        }
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setMicPermissionDenied(true);
          setErrorMsg('Microphone access denied. Tap "Allow Microphone" or check device App Settings.');
        } else {
          setErrorMsg(`Voice input error: ${event.error}. You can also type your command below.`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        // If mic is desired and user hasn't said anything yet ("till something is said"), silently keep ready
        if (isMicActiveDesiredRef.current && !hasSpokenInTurnRef.current && !isSpeakingTtsRef.current) {
          safeRestartRecognition(150);
        } else if (hasSpokenInTurnRef.current) {
          // User spoke and recognition finished: stop and process
          stopListeningDueToSilenceRef.current();
        }
      };

      recognitionRef.current = recognition;

      // Auto-start listening ONCE when modal is opened:
      // "it should just listen once the command is opened till something is said it should stop if there is gap for 2 seconds"
      setTimeout(() => {
        startListeningOnce();
      }, 350);
    } catch (e) {
      console.warn('Speech recognition init failed:', e);
      setHasSpeechSupport(false);
    }

    return () => {
      clearAutoAdvanceTimers();
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      isMicActiveDesiredRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, [isOpen]);

  // Toggle listening
  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      stopListeningDueToSilenceRef.current();
    } else {
      setErrorMsg(null);
      startListeningOnceRef.current();
    }
  };

  // Process the spoken or typed command
  const handleProcessCommand = async (textToProcess?: string) => {
    const rawText = (textToProcess ?? transcript).trim();
    if (!rawText) {
      setErrorMsg('Please speak or type a command first.');
      return;
    }

    // Stop listening during processing
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      // Find patient context based on explicit mode:
      // If commandMode === 'new', do NOT use any existing patient context so new patient registration is clean!
      const contextPatient =
        commandMode === 'existing'
          ? (selectedPatientId ? patients.find((p) => p.id === selectedPatientId) : null) ||
            activePatient ||
            undefined
          : undefined;

      const result = await executeUnifiedVoiceCommandWithAI(rawText, contextPatient);

      // In 'new' patient mode, enforce patient creation action
      if (commandMode === 'new' && result.action === 'update_patient') {
        result.action = 'create_patient';
        result.actionSummary = `Register New Patient: ${result.fields.name || 'New Patient'}`;
      }

      setCommandResult(result);
      const initialFields = { ...result.fields };
      if (result.action === 'create_patient') {
        if (!initialFields.address) initialFields.address = 'Mysuru, Karnataka';
        if (!initialFields.date) initialFields.date = new Date().toISOString().slice(0, 10);
        if (initialFields.treatmentFee === undefined || initialFields.treatmentFee === '') initialFields.treatmentFee = '500';
        if (!initialFields.paymentMethod) initialFields.paymentMethod = 'UPI';
        if (!initialFields.visitType) initialFields.visitType = 'Clinic';
        if (!initialFields.sex) initialFields.sex = 'Male';
        if (!initialFields.seenBy) initialFields.seenBy = 'Dr. Vinay';
        if (!initialFields.referredBy) initialFields.referredBy = 'Self';
      }
      setEditableFields(initialFields);
      setFormErrors({});
      setTouchedForm(false);

      // In 'existing' mode, auto-select matched patient or filter candidates
      if (commandMode === 'existing' && result.targetPatientName) {
        const q = result.targetPatientName.toLowerCase().trim();
        const matches = patients.filter(
          (p) => !p.deleted && (p.name.toLowerCase().includes(q) || (p.regNo && p.regNo.toLowerCase().includes(q)))
        );
        if (matches.length === 1) {
          setSelectedPatientId(matches[0].id);
          onSelectActivePatient?.(matches[0].id);
        } else if (matches.length > 1) {
          setPatientSearchFilter(result.targetPatientName);
        }
      }
      playChime('success');
    } catch (err: any) {
      console.error('Failed to parse command:', err);
      // Fallback to client intent
      const fallback = detectVoiceIntent(
        rawText,
        commandMode === 'existing' ? activePatient || undefined : undefined
      );

      if (commandMode === 'new' && fallback.action === 'update_patient') {
        fallback.action = 'create_patient';
        fallback.actionSummary = 'Register New Patient';
      }

      const extracted = parseVoiceClinicalTranscript(
        rawText,
        commandMode === 'existing' ? activePatient || undefined : undefined
      );

      const fallbackFields: RecognizedClinicalFields = { ...extracted };
      if (fallback.action === 'create_patient') {
        if (!fallbackFields.address) fallbackFields.address = 'Mysuru, Karnataka';
        if (!fallbackFields.date) fallbackFields.date = new Date().toISOString().slice(0, 10);
        if (fallbackFields.treatmentFee === undefined || fallbackFields.treatmentFee === '') fallbackFields.treatmentFee = '500';
        if (!fallbackFields.paymentMethod) fallbackFields.paymentMethod = 'UPI';
        if (!fallbackFields.visitType) fallbackFields.visitType = 'Clinic';
        if (!fallbackFields.sex) fallbackFields.sex = 'Male';
        if (!fallbackFields.seenBy) fallbackFields.seenBy = 'Dr. Vinay';
        if (!fallbackFields.referredBy) fallbackFields.referredBy = 'Self';
      }

      setCommandResult({
        ...fallback,
        fields: fallbackFields,
        source: 'client-nlp',
      });
      setEditableFields(fallbackFields);
      setFormErrors({});
      setTouchedForm(false);
    } finally {
      setIsProcessing(false);
    }
  };

  // Resolve target patient for update action
  const resolveTargetPatient = (): Patient | null => {
    // In 'new' mode, there is never an existing target patient
    if (commandMode === 'new') {
      return null;
    }
    if (selectedPatientId) {
      const found = patients.find((p) => p.id === selectedPatientId);
      if (found) return found;
    }
    if (commandResult?.targetPatientName) {
      const q = commandResult.targetPatientName.toLowerCase().trim();
      const match = patients.find(
        (p) => !p.deleted && (p.name.toLowerCase().includes(q) || (p.regNo && p.regNo.toLowerCase().includes(q)))
      );
      if (match) return match;
    }
    return activePatient && !activePatient.deleted ? activePatient : null;
  };

  // Execute the confirmed action
  const handleConfirmAndExecute = () => {
    if (!commandResult) return;

    switch (commandResult.action) {
      case 'create_patient': {
        setTouchedForm(true);
        const valErrors = validateNewPatient(editableFields);
        setFormErrors(valErrors);

        if (Object.keys(valErrors).length > 0) {
          const firstErr = Object.values(valErrors)[0];
          setErrorMsg(`Mandatory field check failed: ${firstErr}`);
          playChime('start');
          return;
        }

        playChime('success');
        const newPatientData: Partial<Patient> = {
          name: (editableFields.name || '').trim(),
          age: String(editableFields.age).trim(),
          sex: editableFields.sex || 'Male',
          contact: (editableFields.contact || '').trim(),
          address: (editableFields.address || 'Mysuru, Karnataka').trim(),
          height: editableFields.height || "5'6\"",
          weight: editableFields.weight || '65',
          bloodGroup: editableFields.bloodGroup || 'O+',
          diagnosis: (editableFields.diagnosis || '').trim(),
          history: [
            (editableFields.history || '').trim(),
            editableFields.treatmentNotes ? `Treatment Plan: ${editableFields.treatmentNotes}` : '',
          ].filter(Boolean).join('\n'),
          date: editableFields.date || new Date().toISOString().slice(0, 10),
          referredBy: (editableFields.referredBy || 'Self').trim(),
          seenBy: (editableFields.seenBy || 'R. Chandrashekar, BPT, MIAP').trim(),
          treatmentFee: editableFields.treatmentFee !== undefined && editableFields.treatmentFee !== '' ? String(editableFields.treatmentFee) : '500',
          paymentMethod: editableFields.paymentMethod || 'UPI',
          visitType: editableFields.visitType || 'Clinic',
          painScaleBefore: editableFields.painScaleBefore,
          painScaleAfter: editableFields.painScaleAfter,
          comorbid: editableFields.comorbid,
        };

        // Treatment modalities
        if (editableFields.modalities && editableFields.modalities.length > 0) {
          const treat: any = {};
          editableFields.modalities.forEach((m) => {
            const match = MODALITIES_LIST.find(
              (item) => item.label.toLowerCase().includes(m.toLowerCase()) || m.toLowerCase().includes(item.label.toLowerCase())
            );
            if (match) treat[match.key] = true;
          });
          newPatientData.treatment = treat;
        }

        onAddPatient(newPatientData);
        setExecutedToast(`Successfully registered new patient: ${newPatientData.name}!`);
        setTimeout(() => {
          onClose();
        }, 1200);
        break;
      }

      case 'update_patient':
      case 'add_followup':
      case 'update_followup': {
        const target = resolveTargetPatient();
        if (!target) {
          setErrorMsg('No patient selected. Please click on a patient from the matching list above.');
          playChime('start');
          return;
        }

        playChime('success');

        const payload: RecognizedClinicalFields = { ...editableFields };
        if (commandResult.action === 'add_followup') {
          if (Array.isArray(payload.followUps) && payload.followUps.length > 0) {
            payload.followUps = payload.followUps.map((f) => ({ ...f, action: 'add' }));
          }
          payload.followUp = {
            ...(payload.followUp || {}),
            action: 'add',
          };
        } else if (commandResult.action === 'update_followup') {
          payload.followUp = {
            ...(payload.followUp || {}),
            action: 'update',
          };
        }

        onUpdatePatientFields(target.id, payload);
        const multiCount = payload.followUps?.length || 1;
        if (multiCount > 1) {
          setExecutedToast(`Scheduled ${multiCount} follow-up sessions for ${target.name || 'patient'}!`);
        } else if (commandResult.action === 'add_followup' || payload.followUp?.action === 'add') {
          setExecutedToast(`Added new follow-up session for ${target.name || 'patient'}!`);
        } else if (commandResult.action === 'update_followup' || payload.followUp?.action === 'update') {
          setExecutedToast(`Updated follow-up visit for ${target.name || 'patient'}!`);
        } else {
          setExecutedToast(`Updated clinical record for ${target.name || 'patient'}!`);
        }
        setTimeout(() => {
          onClose();
        }, 1200);
        break;
      }

      case 'navigate': {
        if (commandResult.targetView) {
          onNavigate(commandResult.targetView);
          setExecutedToast(`Navigated to ${commandResult.targetView.toUpperCase()}!`);
          setTimeout(() => {
            onClose();
          }, 800);
        }
        break;
      }

      case 'search': {
        const q = commandResult.searchQuery || commandResult.targetPatientName || '';
        if (q) {
          onNavigate('patients');
          onSearchPatients(q);
          setExecutedToast(`Searching for "${q}" in Patient Directory...`);
          setTimeout(() => {
            onClose();
          }, 800);
        }
        break;
      }

      case 'download_pdf': {
        onDownloadPdf();
        setExecutedToast('Downloading Case Sheet PDF...');
        setTimeout(() => {
          onClose();
        }, 800);
        break;
      }

      case 'create_receipt': {
        onCreateReceipt();
        setExecutedToast('Opening Official Receipt Generator...');
        setTimeout(() => {
          onClose();
        }, 800);
        break;
      }

      default:
        onClose();
        break;
    }
  };

  // Process captured utterance after 2 seconds of silence gap
  const processCapturedUtterance = (spokenText: string) => {
    const spoken = spokenText.trim();
    if (!spoken) return;

    setTranscript(spoken);

    // Continuous All-in-One Dictation Mode
    if (voiceInputStyleRef.current === 'all_in_one') {
      handleProcessCommand(spoken);
      return;
    }

    // Field-by-Field Guided Voice Mode
    const steps = commandModeRef.current === 'new' ? NEW_PATIENT_GUIDED_STEPS : EXISTING_PATIENT_GUIDED_STEPS;
    const currentStep = steps[activeFieldStepIndexRef.current] || steps[0];
    if (!currentStep) return;

    // 1. Direct Age Step Prioritization:
    // When the active step is Age, evaluate age parsing directly with zero lag and smooth auto-advance
    if (currentStep.key === 'age') {
      const parsedAge = parseSingleFieldSpokenValue('age', spoken);
      if (parsedAge.value !== undefined && parsedAge.isValid) {
        const finalAge = parsedAge.value;
        const accompanyingSex = parsedAge.extraFields?.sex;

        setEditableFields((prev) => ({
          ...prev,
          age: finalAge,
          ...(accompanyingSex ? { sex: accompanyingSex } : {}),
        }));

        setFormErrors((prev) => {
          const next = { ...prev };
          delete next.age;
          if (accompanyingSex) delete next.sex;
          return next;
        });

        clearAutoAdvanceTimers();

        const currentPacing = voicePacingModeRef.current;
        if (currentPacing === 'manual') {
          setFieldCaptureFeedback((prev) => ({
            ...prev,
            age: {
              status: 'captured',
              message: `✓ Saved: Age ${finalAge}${accompanyingSex ? `, Gender: ${accompanyingSex}` : ''} (Tap Next when ready)`,
            },
          }));
          return;
        }

        // Snappy auto advance from age:
        const currentIdx = activeFieldStepIndexRef.current;
        const totalSteps = currentGuidedStepsRef.current.length;
        // If gender was also specified (e.g. "45 male" or "he is 45"), skip gender prompt and advance directly to contact phone
        const targetStepIdx = accompanyingSex
          ? Math.min(currentIdx + 2, totalSteps - 1)
          : Math.min(currentIdx + 1, totalSteps - 1);

        const feedbackMsg = accompanyingSex
          ? `✓ Saved: Age ${finalAge}, Gender ${accompanyingSex} → Next: Phone...`
          : `✓ Saved: ${finalAge} yrs → Next: Gender...`;

        setFieldCaptureFeedback((prev) => ({
          ...prev,
          age: {
            status: 'captured',
            message: feedbackMsg,
          },
        }));

        const totalSec = currentPacing === 'relaxed' ? 1.6 : 0.7;
        const totalMs = Math.round(totalSec * 1000);
        let secLeft = Math.ceil(totalSec);
        setAutoAdvanceCountdown(secLeft);

        autoAdvanceIntervalRef.current = setInterval(() => {
          secLeft -= 1;
          if (secLeft > 0) {
            setAutoAdvanceCountdown(secLeft);
          } else {
            if (autoAdvanceIntervalRef.current) {
              clearInterval(autoAdvanceIntervalRef.current);
              autoAdvanceIntervalRef.current = null;
            }
            setAutoAdvanceCountdown(null);
          }
        }, 350);

        if (currentIdx < totalSteps - 1) {
          autoAdvanceTimerRef.current = setTimeout(() => {
            clearAutoAdvanceTimers();
            handleJumpToFieldStep(targetStepIdx, isTtsEnabledRef.current);
          }, totalMs);
        }
        return;
      }
    }

    // 2. Smart Multi-Field & Full Clinical Sentence Auto-Detection
    if (commandModeRef.current === 'new') {
      const multiExtracted = parseVoiceClinicalTranscript(spoken);
      const extractedKeys = (Object.keys(multiExtracted) as (keyof RecognizedClinicalFields)[]).filter(
        (k) => multiExtracted[k] !== undefined && multiExtracted[k] !== '' && multiExtracted[k] !== null
      );

      if (extractedKeys.length >= 2) {
        clearAutoAdvanceTimers();

        setEditableFields((prev) => {
          const updated = { ...prev };
          for (const k of extractedKeys) {
            (updated as any)[k] = (multiExtracted as any)[k];
          }
          return updated;
        });

        setFormErrors((prev) => {
          const nextErrs = { ...prev };
          for (const k of extractedKeys) {
            delete nextErrs[k];
          }
          return nextErrs;
        });

        const feedbackUpdates: Record<string, any> = {};
        for (const k of extractedKeys) {
          const val = (multiExtracted as any)[k];
          feedbackUpdates[k] = {
            status: 'captured',
            message: `✓ Saved: ${Array.isArray(val) ? val.join(', ') : String(val)}`,
          };
        }
        setFieldCaptureFeedback((prev) => ({ ...prev, ...feedbackUpdates }));

        const mergedFields = { ...editableFieldsRef.current, ...multiExtracted };
        const requiredSteps = NEW_PATIENT_GUIDED_STEPS.filter((s) => s.required);
        const nextEmptyRequired = requiredSteps.find((s) => {
          const val = (mergedFields as any)[s.key];
          return !val || (typeof val === 'string' && val.trim() === '');
        });

        if (nextEmptyRequired) {
          const nextStepIdx = NEW_PATIENT_GUIDED_STEPS.findIndex((s) => s.id === nextEmptyRequired.id);
          if (nextStepIdx !== -1) {
            setTimeout(() => {
              handleJumpToFieldStep(nextStepIdx, isTtsEnabledRef.current);
            }, 500);
          }
        }
        return;
      }
    }

    // 3. Parse Single Field Spoken Value
    const parsed = parseSingleFieldSpokenValue(String(currentStep.key), spoken);

    // Spoken Navigation & Control Commands
    if (parsed.intent === 'pause') {
      clearAutoAdvanceTimers();
      setFieldCaptureFeedback((prev) => ({
        ...prev,
        [currentStep.id]: {
          status: 'captured',
          message: '⏸ Paused. Take your time, AI is waiting.',
        },
      }));
      return;
    }

    if (parsed.intent === 'pacing_manual') {
      clearAutoAdvanceTimers();
      handleUpdatePacingMode('manual');
      setFieldCaptureFeedback((prev) => ({
        ...prev,
        [currentStep.id]: {
          status: 'captured',
          message: '⏸ Switched to Manual Mode: Tap Next when ready.',
        },
      }));
      return;
    }

    if (parsed.intent === 'pacing_relaxed') {
      clearAutoAdvanceTimers();
      handleUpdatePacingMode('relaxed');
      setFieldCaptureFeedback((prev) => ({
        ...prev,
        [currentStep.id]: {
          status: 'captured',
          message: '🐢 Switched to Relaxed Mode: 2.5 seconds pause.',
        },
      }));
      return;
    }

    if (parsed.intent === 'pacing_fast') {
      clearAutoAdvanceTimers();
      handleUpdatePacingMode('auto');
      setFieldCaptureFeedback((prev) => ({
        ...prev,
        [currentStep.id]: {
          status: 'captured',
          message: '⚡ Switched to Snappy Auto Mode: 1.2s automatic field progression.',
        },
      }));
      return;
    }

    if (parsed.intent === 'switch_mode_existing') {
      clearAutoAdvanceTimers();
      handleSwitchToExistingMode();
      return;
    }

    if (parsed.intent === 'switch_mode_new') {
      clearAutoAdvanceTimers();
      handleSwitchToNewMode();
      return;
    }

    if (parsed.intent === 'goto_menu' && parsed.menuId) {
      clearAutoAdvanceTimers();
      handleGoToMenu(parsed.menuId);
      return;
    }

    if (parsed.intent === 'next_menu') {
      clearAutoAdvanceTimers();
      handleNextMenu();
      return;
    }

    if (parsed.intent === 'prev_menu') {
      clearAutoAdvanceTimers();
      handlePrevMenu();
      return;
    }

    if (parsed.intent === 'next' || parsed.intent === 'skip') {
      clearAutoAdvanceTimers();
      handleNextFieldStepRef.current();
      return;
    }

    if (parsed.intent === 'prev') {
      clearAutoAdvanceTimers();
      handlePrevFieldStepRef.current();
      return;
    }

    if (parsed.intent === 'clear') {
      clearAutoAdvanceTimers();
      setEditableFields((prev) => ({ ...prev, [currentStep.key]: '' }));
      setFieldCaptureFeedback((prev) => ({
        ...prev,
        [currentStep.id]: { status: 'captured', message: 'Cleared' },
      }));
      return;
    }

    if (parsed.intent === 'submit') {
      clearAutoAdvanceTimers();
      if (commandModeRef.current === 'existing') {
        handleConfirmAndExecute();
        return;
      }
      const errs = validateNewPatient(editableFieldsRef.current);
      if (Object.keys(errs).length === 0) {
        handleConfirmAndExecute();
      } else {
        const missingList = Object.values(errs);
        setErrorMsg(`Cannot register yet: ${missingList[0]}`);
        const firstMissingKey = Object.keys(errs)[0];
        const steps = currentGuidedStepsRef.current;
        const targetIdx = steps.findIndex((s) => s.key === firstMissingKey);
        if (targetIdx !== -1) {
          handleJumpToFieldStep(targetIdx, isTtsEnabledRef.current);
        }
      }
      return;
    }

    // Field Data Captured
    if (parsed.value !== undefined && parsed.isValid) {
      let finalVal = parsed.value;

      if (['diagnosis', 'address', 'history', 'treatmentNotes'].includes(currentStep.key)) {
        const existing = String(editableFieldsRef.current[currentStep.key] || '').trim();
        const incoming = String(parsed.value || '').trim();
        if (
          existing &&
          incoming &&
          !existing.toLowerCase().includes(incoming.toLowerCase()) &&
          !incoming.toLowerCase().includes(existing.toLowerCase())
        ) {
          if (currentStep.key === 'address') {
            finalVal = `${existing}, ${incoming}`;
          } else if (currentStep.key === 'diagnosis') {
            finalVal = `${existing} + ${incoming}`;
          } else {
            finalVal = `${existing}. ${incoming}`;
          }
        }
      }

      if (currentStep.type === 'multiselect') {
        const incomingArr: string[] = Array.isArray(finalVal) ? finalVal : [String(finalVal)];
        setEditableFields((prev) => {
          const prevMods: string[] = Array.isArray(prev[currentStep.key]) ? (prev[currentStep.key] as string[]) : [];
          const merged = Array.from(new Set([...prevMods, ...incomingArr]));
          return { ...prev, [currentStep.key]: merged };
        });
      } else if (currentStep.key === 'followUps') {
        const sessionsArr = Array.isArray(finalVal) ? finalVal : [finalVal];
        setEditableFields((prev) => ({
          ...prev,
          followUps: sessionsArr,
          followUp: sessionsArr[0] || prev.followUp,
        }));
      } else {
        setEditableFields((prev) => ({ ...prev, [currentStep.key]: finalVal }));
      }

      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[currentStep.key];
        return next;
      });

      clearAutoAdvanceTimers();

      const currentPacing = voicePacingModeRef.current;

      if (currentPacing === 'manual') {
        setFieldCaptureFeedback((prev) => ({
          ...prev,
          [currentStep.id]: {
            status: 'captured',
            message: `✓ Saved: ${Array.isArray(finalVal) ? finalVal.join(', ') : finalVal} (Tap Next when ready)`,
          },
        }));
        return;
      }

      // Snappy auto advance
      const isFreeText = ['address', 'diagnosis', 'history', 'treatmentNotes'].includes(currentStep.key);
      const totalSec = currentPacing === 'relaxed' ? (isFreeText ? 3.0 : 2.2) : (isFreeText ? 1.6 : 1.2);
      const totalMs = Math.round(totalSec * 1000);
      let secLeft = Math.ceil(totalSec);
      setAutoAdvanceCountdown(secLeft);

      setFieldCaptureFeedback((prev) => ({
        ...prev,
        [currentStep.id]: {
          status: 'captured',
          message: Array.isArray(finalVal)
            ? `✓ Saved: ${finalVal.join(', ')} → Next field...`
            : `✓ Saved: ${finalVal} → Next field...`,
        },
      }));

      autoAdvanceIntervalRef.current = setInterval(() => {
        secLeft -= 1;
        if (secLeft > 0) {
          setAutoAdvanceCountdown(secLeft);
        } else {
          if (autoAdvanceIntervalRef.current) {
            clearInterval(autoAdvanceIntervalRef.current);
            autoAdvanceIntervalRef.current = null;
          }
          setAutoAdvanceCountdown(null);
        }
      }, 500);

      const currentIdx = activeFieldStepIndexRef.current;
      const totalSteps = currentGuidedStepsRef.current.length;
      if (currentIdx < totalSteps - 1) {
        autoAdvanceTimerRef.current = setTimeout(() => {
          clearAutoAdvanceTimers();
          handleNextFieldStepRef.current();
        }, totalMs);
      }
    } else if (parsed.value !== undefined && !parsed.isValid && parsed.error) {
      clearAutoAdvanceTimers();
      setFieldCaptureFeedback((prev) => ({
        ...prev,
        [currentStep.id]: { status: 'error', message: parsed.error || 'Please repeat' },
      }));
    }
  };
  processCapturedUtteranceRef.current = processCapturedUtterance;

  // Filtered list of existing patients for Mode 2
  const filteredExistingPatients = useMemo(() => {
    const active = patients.filter((p) => !p.deleted);
    if (!patientSearchFilter.trim()) return active;
    const q = patientSearchFilter.toLowerCase().trim();
    return active.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.regNo && p.regNo.toLowerCase().includes(q)) ||
        (p.contact && p.contact.toLowerCase().includes(q)) ||
        (p.diagnosis && p.diagnosis.toLowerCase().includes(q))
    );
  }, [patients, patientSearchFilter]);

  // Detect if transcript mentions an existing patient
  const detectedTranscriptPatient = useMemo(() => {
    if (commandMode !== 'existing' || !transcript.trim()) return null;
    const lower = transcript.toLowerCase();
    const active = patients.filter((p) => !p.deleted);
    return (
      active.find(
        (p) =>
          lower.includes(p.name.toLowerCase().trim()) ||
          (p.regNo && lower.includes(p.regNo.toLowerCase().trim()))
      ) || null
    );
  }, [commandMode, transcript, patients]);

  // Context-aware Quick preset voice commands
  const quickCommands = useMemo(() => {
    if (commandMode === 'new') {
      return [
        {
          label: 'Add New Patient (Frozen Shoulder)',
          text: 'Add patient Ramesh age 45 male phone 9880517715 diagnosis Frozen Shoulder fee 500 payment UPI',
          icon: UserPlus,
          color: 'text-sky-700 bg-sky-50 border-sky-200 hover:bg-sky-100',
        },
        {
          label: 'Add New Patient (Cervical Spondylosis)',
          text: 'Add patient Priya age 38 female phone 9945123456 diagnosis Cervical Spondylosis fee 500 UPI',
          icon: UserPlus,
          color: 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
        },
        {
          label: 'Add Home Visit Patient',
          text: 'Add patient Suresh age 62 male phone 9742112233 visit type Home Visit diagnosis Knee Osteoarthritis fee 800 Cash',
          icon: UserPlus,
          color: 'text-amber-800 bg-amber-50 border-amber-200 hover:bg-amber-100',
        },
        {
          label: 'Go to Patients Directory',
          text: 'Go to patients',
          icon: Navigation,
          color: 'text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100',
        },
      ];
    }

    return [
      {
        label: 'Schedule Multi-Date Follow-ups',
        text: 'Schedule follow-up for 22nd, 24th, and 26th September at 10 AM',
        icon: Calendar,
        color: 'text-indigo-800 bg-indigo-50 border-indigo-200 hover:bg-indigo-100',
      },
      {
        label: 'Add Follow-up Session Today',
        text: 'Add follow up session today pain scale before 6 after 2 IFT notes patient showed progressive relief fee 500 UPI',
        icon: Activity,
        color: 'text-amber-800 bg-amber-50 border-amber-200 hover:bg-amber-100',
      },
      {
        label: 'Update Diagnosis & Pain',
        text: 'Update diagnosis to Cervical Spondylosis and pain scale before 7 and after 3',
        icon: Edit3,
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
      },
      {
        label: 'Set Modalities & Fee',
        text: 'Set treatment modalities to IFT and Ultrasound and treatment fee 600 payment Cash',
        icon: Stethoscope,
        color: 'text-teal-700 bg-teal-50 border-teal-200 hover:bg-teal-100',
      },
      {
        label: 'Edit Phone & Address',
        text: 'Update phone to 9880517715 and address Kuvempunagar Mysuru',
        icon: Phone,
        color: 'text-sky-700 bg-sky-50 border-sky-200 hover:bg-sky-100',
      },
      {
        label: 'Download Case Sheet PDF',
        text: 'Download patient case sheet PDF',
        icon: FileDown,
        color: 'text-purple-700 bg-purple-50 border-purple-200 hover:bg-purple-100',
      },
    ];
  }, [commandMode]);

  if (!isOpen) return null;

  const targetPatient = resolveTargetPatient();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-sky-100 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unified-voice-title"
      >
        {/* Modal Header */}
        <div className="px-4 sm:px-5 py-3.5 bg-gradient-to-r from-sky-700 via-sky-800 to-indigo-800 text-white flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner shrink-0">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="unified-voice-title" className="text-sm sm:text-base font-extrabold tracking-tight">
                  Voice Command AI
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200 border border-emerald-300/30 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                  Gemini Flash AI
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-sky-200/90 font-medium">
                {commandMode === 'new'
                  ? 'Add New Patient mode active • Clean chart creation'
                  : targetPatient
                  ? `Selected Patient: ${targetPatient.name} (${targetPatient.regNo || 'Active'})`
                  : 'Select an existing patient to update or dictate'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1">
          {/* Success Toast */}
          {executedToast && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in zoom-in-95">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{executedToast}</span>
            </div>
          )}

          {/* Microphone Permission Alert Banner (Critical for Android Phone / Tablet / APK) */}
          {micPermissionDenied && (
            <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-2xl text-amber-950 text-xs flex flex-wrap items-center justify-between gap-3 animate-in fade-in shadow-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-200 text-amber-900 flex items-center justify-center shrink-0 font-bold">
                  <Mic className="w-4 h-4 text-amber-800" />
                </div>
                <div className="min-w-0">
                  <p className="font-extrabold text-xs sm:text-sm">Microphone Permission Needed</p>
                  <p className="text-[11px] text-amber-800">
                    Voice command needs microphone access to hear your dictation. Tap to grant permission.
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="btn-grant-mic-permission-modal"
                onClick={handleRequestMicPermission}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-extrabold text-xs shrink-0 cursor-pointer shadow-xs transition-all active:scale-95"
              >
                Allow Microphone Access
              </button>
            </div>
          )}

          {/* User Request Choice: 1. Add New Patients OR 2. Select from Existing Patients */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/90 gap-1.5 shadow-2xs">
              <button
                type="button"
                id="voice-mode-new-btn"
                onClick={handleSwitchToNewMode}
                className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer select-none ${
                  commandMode === 'new'
                    ? 'bg-sky-600 text-white shadow-sm ring-2 ring-sky-300'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                }`}
              >
                <UserPlus className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">1. Add New Patient</span>
              </button>

              <button
                type="button"
                id="voice-mode-existing-btn"
                onClick={() => handleSwitchToExistingMode()}
                className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer select-none ${
                  commandMode === 'existing'
                    ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">2. Existing Patients</span>
              </button>
            </div>

            {/* Input Style Selector: Field-by-Field Guided vs Continuous All-in-One */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  id="voice-style-guided-btn"
                  onClick={() => {
                    setVoiceInputStyle('guided');
                    playChime('click');
                    if (commandMode === 'new' && !commandResult) {
                      setCommandResult({
                        action: 'create_patient',
                        actionSummary: 'Register New Patient (Guided Voice Assistant)',
                        confidence: 1,
                        fields: editableFields,
                      });
                    }
                  }}
                  className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer select-none ${
                    voiceInputStyle === 'guided'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>Ask Field-by-Field (Guided)</span>
                </button>

                <button
                  type="button"
                  id="voice-style-all-btn"
                  onClick={() => {
                    setVoiceInputStyle('all_in_one');
                    playChime('click');
                  }}
                  className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer select-none ${
                    voiceInputStyle === 'all_in_one'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>All-in-One Dictation</span>
                </button>
              </div>

              <span className="text-[10px] text-slate-500 font-semibold px-2">
                {voiceInputStyle === 'guided'
                  ? 'Sequential field prompts with speech'
                  : 'Free-form continuous voice AI'}
              </span>
            </div>

            {/* Field-by-Field Guided Stepper and Assistant Card */}
            {voiceInputStyle === 'guided' && (
              <div className="space-y-2.5">
                {/* Horizontal Step Sequence Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs px-0.5">
                    <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-sky-600" />
                      <span>
                        Field Sequence ({activeFieldStepIndex + 1} of {currentGuidedSteps.length}):
                      </span>
                    </span>
                    <span className="text-[10.5px] text-slate-500 font-medium">Click any field to jump & speak</span>
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                    {currentGuidedSteps.map((step, idx) => {
                      const isActive = idx === activeFieldStepIndex;
                      const val = editableFields[step.key as keyof RecognizedClinicalFields];
                      const isFilled = val !== undefined && String(val).trim().length > 0;
                      return (
                        <button
                          key={step.id}
                          type="button"
                          id={`step-chip-${step.id}`}
                          onClick={() => handleJumpToFieldStep(idx, true)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold shrink-0 transition-all cursor-pointer shadow-2xs ${
                            isActive
                              ? 'bg-sky-600 text-white shadow-sm ring-2 ring-sky-300'
                              : isFilled
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          <span
                            className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                              isActive
                                ? 'bg-white/20 text-white'
                                : isFilled
                                ? 'bg-emerald-200 text-emerald-900'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <span>{step.label}</span>
                          {step.mandatory && (
                            <span className={isActive ? 'text-amber-200 font-black' : 'text-rose-500 font-black'}>
                              *
                            </span>
                          )}
                          {isFilled && !isActive && <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Active Step Voice Assistant Card */}
                <div className="bg-gradient-to-br from-sky-50 via-sky-50/70 to-indigo-50/80 border-2 border-sky-400 rounded-2xl p-3.5 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-sky-600 text-white text-[11px] font-black shadow-2xs">
                        Step {activeFieldStepIndex + 1} / {currentGuidedSteps.length}
                      </span>
                      <span className="font-extrabold text-xs text-sky-950">
                        {activeGuidedStep.label}
                        {activeGuidedStep.mandatory && (
                          <span className="ml-1 text-rose-600 font-black">* Required</span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Auto-Move Pacing Controls */}
                      <div className="flex items-center gap-0.5 p-0.5 bg-white/80 rounded-lg border border-sky-200 text-[10.5px] font-bold shadow-2xs">
                        <button
                          type="button"
                          id="btn-pacing-auto"
                          onClick={() => handleUpdatePacingMode('auto')}
                          className={`px-2 py-0.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                            voicePacingMode === 'auto'
                              ? 'bg-emerald-600 text-white shadow-2xs font-black'
                              : 'text-slate-600 hover:bg-sky-100/70'
                          }`}
                          title="Auto-move to next field in 1.2s"
                        >
                          <Zap className="w-3 h-3 fill-current text-amber-300" />
                          <span>Auto-Move (1.2s)</span>
                        </button>
                        <button
                          type="button"
                          id="btn-pacing-relaxed"
                          onClick={() => handleUpdatePacingMode('relaxed')}
                          className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                            voicePacingMode === 'relaxed'
                              ? 'bg-sky-600 text-white shadow-2xs font-black'
                              : 'text-slate-600 hover:bg-sky-100/70'
                          }`}
                          title="Relaxed pause (2.5s)"
                        >
                          <span>Relaxed (2.5s)</span>
                        </button>
                        <button
                          type="button"
                          id="btn-pacing-manual"
                          onClick={() => handleUpdatePacingMode('manual')}
                          className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                            voicePacingMode === 'manual'
                              ? 'bg-slate-700 text-white shadow-2xs font-black'
                              : 'text-slate-600 hover:bg-sky-100/70'
                          }`}
                          title="Manual (say Next or tap)"
                        >
                          <span>Manual</span>
                        </button>
                      </div>

                      {/* Speech Prompt On/Off Toggle */}
                      <button
                        type="button"
                        id="btn-toggle-voice-prompts"
                        onClick={() => {
                          const next = !isTtsEnabled;
                          setIsTtsEnabled(next);
                          if (next) speakFieldPrompt(activeGuidedStep.prompt);
                          else if (typeof window !== 'undefined' && window.speechSynthesis)
                            window.speechSynthesis.cancel();
                        }}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                          isTtsEnabled
                            ? 'bg-indigo-100 text-indigo-900 border-indigo-200 hover:bg-indigo-200'
                            : 'bg-slate-200 text-slate-600 border-slate-300'
                        }`}
                      >
                        {isTtsEnabled ? (
                          <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
                        ) : (
                          <VolumeX className="w-3.5 h-3.5" />
                        )}
                        <span>{isTtsEnabled ? 'Voice Prompts: ON' : 'Voice: OFF'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Active Question Prompt */}
                  <div className="space-y-1">
                    <p className="text-sm sm:text-base font-extrabold text-slate-900 leading-snug">
                      "{activeGuidedStep.prompt}"
                    </p>
                    <p className="text-xs text-slate-500 font-medium">{activeGuidedStep.hint}</p>
                  </div>

                  {/* Audio Status Strip */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-sky-200/80">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isSpeakingPrompt ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-900 font-bold text-xs animate-pulse">
                          <Volume2 className="w-3.5 h-3.5 text-indigo-600 animate-bounce" />
                          <span>Asking question aloud...</span>
                        </span>
                      ) : isListening ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-100 text-rose-900 font-bold text-xs">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
                          <Mic className="w-3.5 h-3.5 text-rose-600" />
                          <span>Listening... stops after 2s silence</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={toggleListening}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold text-xs cursor-pointer shadow-xs"
                        >
                          <Mic className="w-3.5 h-3.5 text-slate-600" />
                          <span>Mic paused (tap to speak)</span>
                        </button>
                      )}

                      {lastInterimPerField && (
                        <span className="text-xs text-slate-600 italic">Hearing: "{lastInterimPerField}"</span>
                      )}

                      {fieldCaptureFeedback[activeGuidedStep.id] && (
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md ${
                            fieldCaptureFeedback[activeGuidedStep.id].status === 'captured'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {fieldCaptureFeedback[activeGuidedStep.id].message}
                        </span>
                      )}

                      {autoAdvanceCountdown !== null && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-400 text-amber-950 animate-pulse shadow-xs">
                          <Zap className="w-3.5 h-3.5 fill-amber-950" />
                          <span>Advancing in {autoAdvanceCountdown}s...</span>
                        </span>
                      )}
                    </div>

                    {/* Step Navigation Controls */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handlePrevFieldStep}
                        disabled={activeFieldStepIndex === 0}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-300 disabled:opacity-40 cursor-pointer flex items-center gap-1 shadow-2xs"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Prev</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => speakFieldPrompt(activeGuidedStep.prompt)}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-sky-50 text-sky-700 font-bold text-xs border border-sky-300 cursor-pointer flex items-center gap-1 shadow-2xs"
                        title="Repeat question"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Repeat</span>
                      </button>

                      <button
                        type="button"
                        id="btn-guided-next-step"
                        onClick={handleNextFieldStep}
                        className="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs cursor-pointer flex items-center gap-1 shadow-xs"
                      >
                        <span>{activeFieldStepIndex < currentGuidedSteps.length - 1 ? 'Next / Skip' : 'Done'}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Mode 1 Banner: Add New Patient Registration */}
            {commandMode === 'new' && voiceInputStyle === 'all_in_one' && (
              <div className="p-3 bg-gradient-to-r from-sky-50 via-sky-50/70 to-blue-50/50 border border-sky-200 rounded-2xl flex items-start sm:items-center justify-between gap-2.5 text-xs text-sky-950">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-xl bg-sky-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                    1
                  </div>
                  <div className="min-w-0">
                    <p className="font-extrabold text-sky-950">New Patient Registration Active</p>
                    <p className="text-[11px] text-sky-800 leading-tight">
                      Speak new patient details (e.g. name, age, phone, diagnosis, fee). A brand new patient chart will be registered.
                    </p>
                  </div>
                </div>
                <span className="hidden sm:inline-block shrink-0 font-bold text-[10px] bg-white border border-sky-200 text-sky-800 px-2 py-0.5 rounded-full shadow-2xs">
                  Clean Context
                </span>
              </div>
            )}

            {/* Mode 2 Container: Select from Existing Patients */}
            {commandMode === 'existing' && (
              <div className="p-3 bg-gradient-to-r from-indigo-50/90 via-indigo-50/60 to-purple-50/50 border border-indigo-200 rounded-2xl space-y-2.5 text-xs text-indigo-950">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                      2
                    </div>
                    <span className="font-extrabold text-indigo-950 truncate">
                      Select Patient to Dictate or Update:
                    </span>
                  </div>
                  <span className="font-bold text-[10.5px] bg-white border border-indigo-200 text-indigo-800 px-2 py-0.5 rounded-full shrink-0 shadow-2xs">
                    {patients.filter((p) => !p.deleted).length} Total Patients
                  </span>
                </div>

                {/* Search Input Bar with Clear Button */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-indigo-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={patientSearchFilter}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPatientSearchFilter(val);
                      // Auto-select if exactly 1 patient matches and query has at least 3 characters
                      const active = patients.filter((p) => !p.deleted);
                      const q = val.toLowerCase().trim();
                      if (q.length >= 3) {
                        const m = active.filter(
                          (p) =>
                            p.name.toLowerCase().includes(q) ||
                            (p.regNo && p.regNo.toLowerCase().includes(q)) ||
                            (p.contact && p.contact.toLowerCase().includes(q))
                        );
                        if (m.length === 1) {
                          setSelectedPatientId(m[0].id);
                          onSelectActivePatient?.(m[0].id);
                        }
                      }
                    }}
                    placeholder="Type patient name (e.g. Ramesh), ID, or phone to list matches..."
                    className="w-full pl-9 pr-8 py-2 bg-white border border-indigo-300 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-500 outline-none shadow-2xs"
                  />
                  {patientSearchFilter && (
                    <button
                      type="button"
                      onClick={() => setPatientSearchFilter('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 rounded-full cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Dynamic Matching Patient List */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-indigo-900 px-0.5">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-indigo-600" />
                      <span>
                        {patientSearchFilter.trim()
                          ? `Matching Patients (${filteredExistingPatients.length}):`
                          : `Choose Patient (${filteredExistingPatients.length} active):`}
                      </span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {selectedPatientId
                        ? '1 Patient Selected'
                        : 'Click a patient below to select for dictation'}
                    </span>
                  </div>

                  <div className="max-h-52 overflow-y-auto space-y-1.5 p-1.5 bg-white/90 border border-indigo-200/90 rounded-xl shadow-inner scrollbar-thin">
                    {filteredExistingPatients.length > 0 ? (
                      filteredExistingPatients.map((p) => {
                        const isSelected = selectedPatientId === p.id;
                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              setSelectedPatientId(p.id);
                              onSelectActivePatient?.(p.id);
                              setErrorMsg(null);
                              playChime('click');
                            }}
                            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                              isSelected
                                ? 'bg-indigo-50/95 border-indigo-500 ring-2 ring-indigo-200/80 shadow-2xs'
                                : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-indigo-300'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`font-extrabold text-xs truncate ${isSelected ? 'text-indigo-950' : 'text-slate-900'}`}>
                                  {p.name}
                                </span>
                                {p.regNo && (
                                  <span className="font-mono text-[9.5px] font-bold bg-indigo-100/80 text-indigo-900 px-1.5 py-0.2 rounded border border-indigo-200">
                                    {p.regNo}
                                  </span>
                                )}
                                {p.age && (
                                  <span className="text-[10px] font-semibold text-slate-500">
                                    • {p.age}y {p.sex ? `(${p.sex[0]})` : ''}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 mt-1 text-[10.5px] text-slate-500 flex-wrap">
                                {p.contact && (
                                  <span className="flex items-center gap-1 text-slate-600 font-medium">
                                    <Phone className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                    {p.contact}
                                  </span>
                                )}
                                {p.diagnosis && (
                                  <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded text-[10px] font-bold truncate max-w-[160px]">
                                    {p.diagnosis}
                                  </span>
                                )}
                                {p.followUps && p.followUps.length > 0 && (
                                  <span className="text-[10px] font-bold text-emerald-700">
                                    {p.followUps.length} follow-up{p.followUps.length > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="shrink-0">
                              {isSelected ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-2xs">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Selected</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedPatientId(p.id);
                                    onSelectActivePatient?.(p.id);
                                    setErrorMsg(null);
                                    playChime('click');
                                  }}
                                  className="inline-flex items-center px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                >
                                  Select
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center space-y-2">
                        <p className="text-xs font-bold text-slate-600">
                          No existing patient matches "<span className="text-indigo-700 font-extrabold">{patientSearchFilter}</span>"
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setCommandMode('new');
                            setEditableFields((prev) => ({ ...prev, name: patientSearchFilter }));
                            setPatientSearchFilter('');
                            playChime('click');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs transition-all"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Register "{patientSearchFilter}" as New Patient</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Selected Existing Patient Clinical Context Strip */}
                {targetPatient && (
                  <div className="pt-2 border-t border-indigo-200/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <User className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span className="font-extrabold text-indigo-950 truncate">{targetPatient.name}</span>
                      {targetPatient.regNo && (
                        <span className="font-mono text-[10px] bg-white border border-indigo-200 text-indigo-800 px-1.5 py-0.2 rounded shadow-2xs">
                          {targetPatient.regNo}
                        </span>
                      )}
                      {targetPatient.contact && (
                        <span className="text-slate-500 font-medium">({targetPatient.contact})</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="bg-white text-indigo-900 border border-indigo-200 px-2 py-0.5 rounded-md font-bold text-[10.5px] truncate max-w-[180px]">
                        {targetPatient.diagnosis || 'No Diagnosis Recorded'}
                      </span>
                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-bold text-[10.5px]">
                        {targetPatient.followUps?.length || 0} Follow-ups
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

            {/* Dictation Box with Visualizer (shown in All-in-One continuous mode) */}
            {voiceInputStyle === 'all_in_one' && (
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        isListening ? 'bg-rose-500 animate-pulse' : 'bg-slate-400'
                      }`}
                    />
                    <span className="text-xs font-bold text-slate-700">
                      {isListening ? 'Listening... Speak your command now' : 'Microphone Ready'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
                      isListening
                        ? 'bg-rose-600 hover:bg-rose-700 text-white ring-2 ring-rose-200'
                        : 'bg-sky-600 hover:bg-sky-700 text-white'
                    }`}
                  >
                    {isListening ? (
                      <>
                        <MicOff className="w-3.5 h-3.5 animate-bounce" />
                        <span>Stop Listening</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5" />
                        <span>Start Dictation</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Spoken Text Box */}
                <div className="relative">
                  <textarea
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder={
                      hasSpeechSupport
                        ? 'Say "Add patient Ramesh age 45 male diagnosis frozen shoulder" or "Update diagnosis to cervical spondylosis"...'
                        : 'Type your clinical command here...'
                    }
                    rows={3}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs sm:text-sm font-medium focus:border-sky-500 focus:ring-1 focus:ring-sky-200 outline-none resize-none leading-relaxed"
                  />

                  {interimTranscript && (
                    <div className="absolute bottom-2 left-3 right-3 text-xs text-slate-400 italic truncate pointer-events-none">
                      Hearing: {interimTranscript}
                    </div>
                  )}
                </div>

                {/* Error Message */}
                {errorMsg && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Action Bar for Command */}
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setTranscript('');
                      setInterimTranscript('');
                      setCommandResult(null);
                      setEditableFields({});
                    }}
                    disabled={!transcript && !commandResult}
                    className="text-slate-500 hover:text-slate-800 text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Clear</span>
                  </button>

                  <button
                    type="button"
                    id="btn-process-voice-ai-command"
                    onClick={() => handleProcessCommand()}
                    disabled={!transcript.trim() || isProcessing}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white text-xs font-extrabold cursor-pointer shadow-xs disabled:opacity-50 transition-all"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Analyzing Command...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>Process Command</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Error Message in Guided Mode */}
            {voiceInputStyle === 'guided' && errorMsg && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{errorMsg}</span>
              </div>
            )}

          {/* Result Action Card */}
          {commandResult && (
            <div className="bg-white rounded-2xl border-2 border-sky-300 p-4 space-y-4 shadow-sm animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between pb-2 border-b border-sky-100">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-sky-100 text-sky-800">
                    {commandResult.action === 'create_patient' && <UserPlus className="w-4 h-4" />}
                    {commandResult.action === 'update_patient' && <Edit3 className="w-4 h-4" />}
                    {(commandResult.action === 'add_followup' || commandResult.action === 'update_followup') && <Activity className="w-4 h-4" />}
                    {commandResult.action === 'navigate' && <Navigation className="w-4 h-4" />}
                    {commandResult.action === 'search' && <Search className="w-4 h-4" />}
                    {commandResult.action === 'download_pdf' && <FileDown className="w-4 h-4" />}
                    {commandResult.action === 'create_receipt' && <Receipt className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                      Detected Action: {commandResult.action.replace('_', ' ')}
                    </h3>
                    <p className="text-xs text-sky-800 font-medium">{commandResult.actionSummary}</p>
                  </div>
                </div>

                <span className="text-[10px] font-bold text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md">
                  {commandResult.source === 'gemini' ? 'Gemini 3.8 Flash' : 'Fast Local NLP'}
                </span>
              </div>

              {/* ACTION SPECIFIC EDITING / PREVIEWS */}
              {commandResult.action === 'create_patient' && (
                <div className="space-y-3">
                  {/* Missing Mandatory Fields Alert Banner */}
                  {missingMandatoryFields.length > 0 && (
                    <div className="p-3 bg-rose-50 border-2 border-rose-300 rounded-xl text-rose-900 text-xs flex items-start gap-2.5 animate-in fade-in">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <span className="font-extrabold text-rose-950 block">
                          Mandatory Registration Fields Required:
                        </span>
                        <p className="text-[11px] text-rose-800 leading-tight mt-0.5">
                          Voice command cannot bypass required fields. Please fill in:{' '}
                          <strong className="text-rose-900 underline font-bold">
                            {missingMandatoryFields.join(', ')}
                          </strong>{' '}
                          below before confirming.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* All Mandatory Fields Captured Banner - Immediate Registration Access */}
                  {missingMandatoryFields.length === 0 && (
                    <div className="p-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 rounded-2xl text-white text-xs flex flex-wrap items-center justify-between gap-3 shadow-md animate-in fade-in">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-bold text-white shrink-0 shadow-inner">
                          <Check className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-extrabold text-xs sm:text-sm">✓ Mandatory Fields Complete!</p>
                          <p className="text-[11px] text-emerald-100">
                            You can register <strong>{editableFields.name || 'this patient'}</strong> right now. Say <em>"Register Patient"</em> or tap Register.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        id="btn-voice-register-patient-top-bar"
                        onClick={handleConfirmAndExecute}
                        className="px-4 py-2 bg-white text-emerald-900 hover:bg-emerald-50 rounded-xl font-extrabold text-xs shrink-0 cursor-pointer shadow-md transition-all active:scale-95"
                      >
                        Register Patient Record
                      </button>
                    </div>
                  )}

                  <PatientVoiceGuidedForm
                    activeMenu={activeMenu}
                    onSelectMenu={(menuId) => handleGoToMenu(menuId)}
                    activeFieldStepIndex={activeFieldStepIndex}
                    currentGuidedSteps={currentGuidedSteps}
                    editableFields={editableFields}
                    setEditableFields={setEditableFields}
                    formErrors={formErrors}
                    setFormErrors={setFormErrors}
                    touchedForm={touchedForm}
                    voiceInputStyle={voiceInputStyle}
                    onJumpToStep={(idx, speak) => handleJumpToFieldStep(idx, speak)}
                    onNextMenu={handleNextMenu}
                    onPrevMenu={handlePrevMenu}
                    onConfirmAndExecute={handleConfirmAndExecute}
                    missingMandatoryFields={missingMandatoryFields}
                    voicePacingMode={voicePacingMode}
                    setVoicePacingMode={handleUpdatePacingMode}
                    autoAdvanceCountdown={autoAdvanceCountdown}
                    onCancelCountdown={clearAutoAdvanceTimers}
                  />
                </div>
              )}

              {/* Existing Patient Flow: Dedicated 3-Menu Voice Guided Form (Progress, Modalities, Follow-up Scheduler) */}
              {commandMode === 'existing' && (
                <ExistingPatientVoiceGuidedForm
                  activeMenu={activeMenu}
                  onSelectMenu={(menuId) => handleGoToMenu(menuId)}
                  targetPatient={targetPatient}
                  editableFields={editableFields}
                  setEditableFields={setEditableFields}
                  onConfirmAndSchedule={handleConfirmAndExecute}
                  isListening={isListening}
                  toggleListening={toggleListening}
                />
              )}

              {/* Follow-up Session Review Block (for non-existing patient modes) */}
              {commandMode !== 'existing' &&
                (commandResult.action === 'add_followup' ||
                  commandResult.action === 'update_followup' ||
                  editableFields.followUp ||
                  (Array.isArray(editableFields.followUps) && editableFields.followUps.length > 0)) && (
                <div className="space-y-3 bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-amber-200/80">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-lg bg-amber-600 text-white text-[10px] font-extrabold uppercase tracking-wide">
                        {commandResult.action === 'update_followup'
                          ? 'Edit Follow-up Session'
                          : Array.isArray(editableFields.followUps) && editableFields.followUps.length > 1
                          ? `Schedule ${editableFields.followUps.length} Follow-ups`
                          : 'New Follow-up Session'}
                      </span>
                      <span className="font-bold text-amber-950">
                        {Array.isArray(editableFields.followUps) && editableFields.followUps.length > 1
                          ? `${editableFields.followUps.length} Sessions for `
                          : `Session #${
                              editableFields.followUp?.sessionNumber ||
                              (targetPatient?.followUps?.length ? targetPatient.followUps.length + 1 : 1)
                            } for `}
                        <strong className="text-amber-900">{targetPatient?.name || 'Selected Patient'}</strong>
                      </span>
                    </div>
                    {targetPatient?.regNo && (
                      <span className="font-mono text-[10px] text-amber-800 bg-white px-2 py-0.5 rounded border border-amber-200">
                        {targetPatient.regNo}
                      </span>
                    )}
                  </div>

                  {/* Multi-Date Schedule Preview and Editor */}
                  {Array.isArray(editableFields.followUps) && editableFields.followUps.length > 1 ? (
                    <div className="space-y-2 bg-white/95 p-3 rounded-xl border border-amber-200/90 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold text-amber-950 flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-amber-600" />
                          <span>Dates to Schedule ({editableFields.followUps.length} Sessions):</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditableFields((prev) => {
                              const list = [...(prev.followUps || [])];
                              const lastDate = list[list.length - 1]?.date || new Date().toISOString().split('T')[0];
                              const nextD = new Date(lastDate);
                              nextD.setDate(nextD.getDate() + 1);
                              const nextIso = nextD.toISOString().split('T')[0];
                              list.push({
                                action: 'add',
                                date: nextIso,
                                time: list[0]?.time || '10:00:00',
                                notes: 'Scheduled follow-up session',
                                fee: prev.treatmentFee !== undefined && prev.treatmentFee !== '' ? prev.treatmentFee : '500',
                                paymentMethod: prev.paymentMethod || 'UPI',
                                visitType: prev.visitType || 'Clinic',
                                seenBy: prev.seenBy || 'Dr. Vinay',
                              });
                              return { ...prev, followUps: list, followUp: list[0] };
                            });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-[11px] cursor-pointer transition-colors border border-amber-300"
                        >
                          + Add Another Date
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                        {Array.isArray(editableFields.followUps) &&
                          editableFields.followUps.map((fu, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-1.5 p-2 bg-amber-50/60 rounded-xl border border-amber-200 text-xs shadow-2xs"
                            >
                              <span className="w-6 h-6 rounded-full bg-amber-600 text-white font-black text-[10px] flex items-center justify-center shrink-0">
                                #{idx + 1}
                              </span>
                              <div className="flex-1 min-w-0 grid grid-cols-5 gap-1.5">
                                <input
                                  type="date"
                                  value={fu.date || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditableFields((prev) => {
                                      const list = [...(Array.isArray(prev.followUps) ? prev.followUps : [])];
                                      list[idx] = { ...list[idx], date: val };
                                      return { ...prev, followUps: list, followUp: list[0] };
                                    });
                                  }}
                                  className="col-span-3 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:border-amber-500 outline-none"
                                />
                                <input
                                  type="time"
                                  value={(fu.time || '10:00').slice(0, 5)}
                                  onChange={(e) => {
                                    const val = `${e.target.value}:00`;
                                    setEditableFields((prev) => {
                                      const list = [...(Array.isArray(prev.followUps) ? prev.followUps : [])];
                                      list[idx] = { ...list[idx], time: val };
                                      return { ...prev, followUps: list };
                                    });
                                  }}
                                  className="col-span-2 px-1.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:border-amber-500 outline-none"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditableFields((prev) => {
                                    const list = (Array.isArray(prev.followUps) ? prev.followUps : []).filter((_, i) => i !== idx);
                                    return {
                                      ...prev,
                                      followUps: list,
                                      followUp: list[0] || undefined,
                                    };
                                  });
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer transition-colors"
                                title="Remove this date"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {(!Array.isArray(editableFields.followUps) || editableFields.followUps.length <= 1) && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Session Date</label>
                        <input
                          type="date"
                          value={editableFields.followUp?.date || editableFields.date || new Date().toISOString().split('T')[0]}
                          onChange={(e) =>
                            setEditableFields((prev) => ({
                              ...prev,
                              date: e.target.value,
                              followUp: { ...(prev.followUp || {}), date: e.target.value },
                            }))
                          }
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:border-amber-500 outline-none"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Pain Before (0-10)</label>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={editableFields.followUp?.painScaleBefore ?? editableFields.painScaleBefore ?? ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? undefined : Number(e.target.value);
                            setEditableFields((prev) => ({
                              ...prev,
                              painScaleBefore: val,
                              followUp: { ...(prev.followUp || {}), painScaleBefore: val },
                            }));
                          }}
                          placeholder="e.g. 7"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-rose-700 focus:border-amber-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Pain After (0-10)</label>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={editableFields.followUp?.painScaleAfter ?? editableFields.painScaleAfter ?? ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? undefined : Number(e.target.value);
                            setEditableFields((prev) => ({
                              ...prev,
                              painScaleAfter: val,
                              followUp: { ...(prev.followUp || {}), painScaleAfter: val },
                            }));
                          }}
                          placeholder="e.g. 3"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-emerald-700 focus:border-amber-500 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Session Fee (₹)</label>
                      <input
                        type="number"
                        value={editableFields.followUp?.fee ?? editableFields.treatmentFee ?? targetPatient?.treatmentFee ?? '500'}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditableFields((prev) => ({
                            ...prev,
                            treatmentFee: val,
                            followUp: { ...(prev.followUp || {}), fee: val },
                          }));
                        }}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-emerald-800 focus:border-amber-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Payment Mode</label>
                      <select
                        value={editableFields.followUp?.paymentMethod || editableFields.paymentMethod || targetPatient?.paymentMethod || 'UPI'}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          setEditableFields((prev) => ({
                            ...prev,
                            paymentMethod: val,
                            followUp: { ...(prev.followUp || {}), paymentMethod: val },
                          }));
                        }}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:border-amber-500 outline-none"
                      >
                        <option value="UPI">UPI / GPay / PhonePe</option>
                        <option value="Cash">Cash</option>
                        <option value="Card">Card</option>
                        <option value="Due">Due / Pending</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Progress & Clinical Notes</label>
                      <textarea
                        rows={2}
                        value={editableFields.followUp?.notes || editableFields.history || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditableFields((prev) => ({
                            ...prev,
                            followUp: { ...(prev.followUp || {}), notes: val },
                          }));
                        }}
                        placeholder="e.g. Patient showed progressive relief in lumbar mobility. Advised core strengthening exercises."
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:border-amber-500 outline-none resize-none"
                      />
                    </div>

                    {editableFields.modalities && editableFields.modalities.length > 0 && (
                      <div className="sm:col-span-2 flex items-center gap-2 p-2 bg-white rounded-lg border border-amber-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0">Treatments Given:</span>
                        <span className="text-xs font-bold text-sky-800 truncate">{editableFields.modalities.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Patient Fields Update Block */}
              {commandMode !== 'existing' && commandResult.action === 'update_patient' && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>
                      Applying Updates to: <strong>{targetPatient?.name || 'Active Chart'}</strong>
                    </span>
                    {targetPatient?.regNo && (
                      <span className="font-mono text-[10px] text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                        {targetPatient.regNo}
                      </span>
                    )}
                  </div>

                  {/* Comprehensive list of recognized fields with editable inputs */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                    {/* Patient Name */}
                    {editableFields.name && (
                      <div className="border-b border-slate-200/70 pb-2 space-y-1">
                        <label className="block text-[11px] font-bold text-slate-700">Patient Name:</label>
                        <input
                          type="text"
                          value={editableFields.name}
                          onChange={(e) => setEditableFields((p) => ({ ...p, name: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold text-xs focus:ring-1 focus:ring-sky-500 outline-none"
                          placeholder="Patient full name"
                        />
                      </div>
                    )}

                    {/* Age & Sex */}
                    {(editableFields.age !== undefined || editableFields.sex) && (
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                        <span className="font-bold text-slate-600">Age / Gender:</span>
                        <div className="flex items-center gap-2 justify-end">
                          {editableFields.age !== undefined && (
                            <input
                              type="number"
                              value={editableFields.age}
                              onChange={(e) => setEditableFields((p) => ({ ...p, age: e.target.value }))}
                              className="px-2 py-1 bg-white border border-slate-300 rounded text-slate-900 font-semibold text-xs text-right w-20"
                              placeholder="Age"
                            />
                          )}
                          {editableFields.sex && (
                            <select
                              value={editableFields.sex}
                              onChange={(e) => setEditableFields((p) => ({ ...p, sex: e.target.value as any }))}
                              className="px-2 py-1 bg-white border border-slate-300 rounded text-slate-900 font-semibold text-xs text-right"
                            >
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                              <option value="Other">Other</option>
                            </select>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Contact & Address */}
                    {editableFields.contact && (
                      <div className="border-b border-slate-200/70 pb-2 space-y-1">
                        <label className="block text-[11px] font-bold text-slate-700">Contact Phone:</label>
                        <input
                          type="text"
                          value={editableFields.contact}
                          onChange={(e) => setEditableFields((p) => ({ ...p, contact: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-semibold text-xs focus:ring-1 focus:ring-sky-500 outline-none"
                        />
                      </div>
                    )}

                    {editableFields.address && (
                      <div className="border-b border-slate-200/70 pb-2 space-y-1">
                        <label className="block text-[11px] font-bold text-slate-700">Address:</label>
                        <input
                          type="text"
                          value={editableFields.address}
                          onChange={(e) => setEditableFields((p) => ({ ...p, address: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-semibold text-xs focus:ring-1 focus:ring-sky-500 outline-none"
                        />
                      </div>
                    )}

                    {/* Clinical Diagnosis */}
                    {editableFields.diagnosis && (
                      <div className="border-b border-slate-200/70 pb-2 space-y-1">
                        <label className="block text-[11px] font-bold text-slate-700">Clinical Diagnosis:</label>
                        <input
                          type="text"
                          value={editableFields.diagnosis}
                          onChange={(e) => setEditableFields((p) => ({ ...p, diagnosis: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold text-xs text-sky-950 focus:ring-1 focus:ring-sky-500 outline-none"
                          placeholder="e.g. Cervical Spondylosis"
                        />
                      </div>
                    )}

                    {/* Pain Scales */}
                    {editableFields.painScaleBefore !== undefined && (
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                        <span className="font-bold text-slate-600">Pain Scale (Before):</span>
                        <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          {editableFields.painScaleBefore} / 10
                        </span>
                      </div>
                    )}
                    {editableFields.painScaleAfter !== undefined && (
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                        <span className="font-bold text-slate-600">Pain Scale (After):</span>
                        <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {editableFields.painScaleAfter} / 10
                        </span>
                      </div>
                    )}

                    {/* Treatment Fee & Payment */}
                    {editableFields.treatmentFee !== undefined && (
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                        <span className="font-bold text-slate-600">Treatment Fee:</span>
                        <span className="font-bold text-emerald-700">₹{editableFields.treatmentFee}</span>
                      </div>
                    )}
                    {editableFields.paymentMethod && (
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                        <span className="font-bold text-slate-600">Payment Method:</span>
                        <span className="font-bold text-sky-700">{editableFields.paymentMethod}</span>
                      </div>
                    )}

                    {/* Modalities */}
                    {editableFields.modalities && editableFields.modalities.length > 0 && (
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                        <span className="font-bold text-slate-600">Modalities:</span>
                        <span className="font-semibold text-slate-800">{editableFields.modalities.join(', ')}</span>
                      </div>
                    )}

                    {/* Comorbidities */}
                    {editableFields.comorbid && (
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                        <span className="font-bold text-slate-600">Comorbidities:</span>
                        <span className="font-semibold text-purple-700">
                          {[
                            editableFields.comorbid.diabetes && 'Diabetes',
                            editableFields.comorbid.bp && 'Hypertension/BP',
                            editableFields.comorbid.thyroid && 'Thyroid',
                            editableFields.comorbid.other && (editableFields.comorbid.otherText || 'Other'),
                          ]
                            .filter(Boolean)
                            .join(', ') || 'None noted'}
                        </span>
                      </div>
                    )}

                    {/* History Notes */}
                    {editableFields.history && (
                      <div className="pt-1">
                        <span className="font-bold text-slate-600 block mb-1">Clinical Assessment / History:</span>
                        <p className="text-slate-800 bg-white p-2 rounded border border-slate-200 italic text-[11px]">
                          {editableFields.history}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Confirmation Button (for non-existing patient modes) */}
              {commandMode !== 'existing' && (
                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setCommandResult(null)}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    id="btn-confirm-unified-voice-action"
                    onClick={handleConfirmAndExecute}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-extrabold cursor-pointer shadow-xs transition-all"
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      {commandResult.action === 'create_patient' && 'Register Patient Now'}
                      {commandResult.action === 'add_followup' && 'Add Follow-up Session to Record'}
                      {commandResult.action === 'update_followup' && 'Update Follow-up Session'}
                      {commandResult.action === 'update_patient' && (editableFields.followUp ? 'Save Follow-up & Record' : 'Save Updates to Chart')}
                      {commandResult.action === 'navigate' && `Go to ${commandResult.targetView}`}
                      {commandResult.action === 'search' && 'Search Directory'}
                      {commandResult.action === 'download_pdf' && 'Download PDF'}
                      {commandResult.action === 'create_receipt' && 'Generate Receipt'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Quick Command Suggestions */}
          <div className="pt-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-2">
              <HelpCircle className="w-3.5 h-3.5 text-sky-600" />
              <span>Try these Voice Commands (click any to load):</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {quickCommands.map((cmd, idx) => {
                const Icon = cmd.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setTranscript(cmd.text);
                      handleProcessCommand(cmd.text);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold cursor-pointer transition-all text-left ${cmd.color}`}
                  >
                    <Icon className="w-3 h-3 shrink-0" />
                    <span>{cmd.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[11px]">Powered by Google Gemini 3.8 Flash • Unified Voice Recognition</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
