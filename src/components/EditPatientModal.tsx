import React, { useState } from 'react';
import {
  X,
  Edit3,
  AlertCircle,
  Stethoscope,
  ClipboardList,
  Phone,
  MapPin,
  Calendar,
  IndianRupee,
  Check,
  UserCheck,
  Plus,
  Settings2,
  Sparkles,
  Save,
  Clock,
  Loader2,
} from 'lucide-react';
import { Patient, VisitType, PaymentMethod } from '../types';
import { BLOOD_GROUPS, COMMON_DIAGNOSES, HEIGHT_PRESETS } from '../constants';
import { calculateBMI } from '../utils/bmi';
import {
  getLocumPhysiotherapists,
  getCommonReferralDoctors,
  saveCommonReferralDoctors,
  formatTime24Hour,
} from '../utils/storage';
import { ManageReferralDoctorsModal } from './ManageReferralDoctorsModal';
import { PainScaleComponent } from './PainScaleComponent';
import { FieldVoiceMicButton } from './FieldVoiceMicButton';

interface EditPatientModalProps {
  patient: Patient;
  existingPatients?: Patient[];
  onSave: (updated: Patient) => void;
  onClose: () => void;
}

export const EditPatientModal: React.FC<EditPatientModalProps> = ({
  patient,
  existingPatients = [],
  onSave,
  onClose,
}) => {
  // Form states pre-filled with the patient's existing details
  const [name, setName] = useState(patient.name || '');
  const [regNo, setRegNo] = useState(patient.regNo || '');
  const [age, setAge] = useState<string | number>(patient.age ?? '');
  const [sex, setSex] = useState<'Male' | 'Female' | 'Other'>(
    patient.sex === 'Female' || patient.sex === 'Other' ? patient.sex : 'Male'
  );
  const [contact, setContact] = useState(patient.contact || '');
  const [address, setAddress] = useState(patient.address || 'Mysuru, Karnataka');
  const [diagnosis, setDiagnosis] = useState(patient.diagnosis || '');
  const [history, setHistory] = useState(patient.history || '');
  const [date, setDate] = useState(patient.date || new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(patient.time || formatTime24Hour(patient.createdAt));
  const [visitType, setVisitType] = useState<VisitType>(patient.visitType || 'Clinic');
  const [height, setHeight] = useState(patient.height || "5'6\"");
  const [weight, setWeight] = useState(patient.weight || '65');
  const [bloodGroup, setBloodGroup] = useState(patient.bloodGroup || 'O+');
  const [referredBy, setReferredBy] = useState(patient.referredBy || 'Self');
  const [treatmentFee, setTreatmentFee] = useState<string>(
    patient.treatmentFee !== undefined && patient.treatmentFee !== null && patient.treatmentFee !== ''
      ? String(patient.treatmentFee)
      : '500'
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(patient.paymentMethod || 'Cash');
  const [painScaleBefore, setPainScaleBefore] = useState<number | undefined>(
    patient.painScaleBefore ?? patient.painScale ?? 6
  );
  const [painScaleAfter, setPainScaleAfter] = useState<number | undefined>(
    patient.painScaleAfter ?? 3
  );

  // Locum Tenens & Referral Doctors state
  const [locums] = useState(() => getLocumPhysiotherapists());
  const [seenBy, setSeenBy] = useState(() => patient.seenBy || getLocumPhysiotherapists()[0]?.name || 'R. Chandrashekar');
  const [referralDocs, setReferralDocs] = useState(() => getCommonReferralDoctors());
  const [isAddingNewDoc, setIsAddingNewDoc] = useState(false);
  const [showManageDocsModal, setShowManageDocsModal] = useState(false);
  const [newDocInput, setNewDocInput] = useState('');

  // Validation state
  const [touched, setTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  const handleAddNewReferralDoc = () => {
    const doc = newDocInput.trim();
    if (!doc) return;
    if (!referralDocs.includes(doc)) {
      const updated = [...referralDocs, doc];
      setReferralDocs(updated);
      saveCommonReferralDoctors(updated);
    }
    setReferredBy(doc);
    setNewDocInput('');
    setIsAddingNewDoc(false);
  };

  /**
   * Handles Clinical Diagnosis selection:
   * Appends or toggles diagnosis condition.
   */
  const handleDiagnosisSelect = (chosen: string) => {
    if (!chosen || chosen === '__custom__') return;
    const current = (diagnosis || '').trim();
    if (!current) {
      setDiagnosis(chosen);
    } else if (current.endsWith('+')) {
      const updated = `${current} ${chosen}`.replace(/\s+/g, ' ').trim();
      setDiagnosis(updated);
    } else {
      const parts = current.split(/\s*\+\s*/).map((p) => p.trim().toLowerCase());
      if (!parts.includes(chosen.toLowerCase())) {
        setDiagnosis(`${current} + ${chosen}`);
      } else {
        // Toggle off if already present
        const updated = current
          .split(/\s*\+\s*/)
          .filter((p) => p.trim().toLowerCase() !== chosen.toLowerCase())
          .join(' + ');
        setDiagnosis(updated);
      }
    }
    if (errors.diagnosis) setErrors((prev) => ({ ...prev, diagnosis: '' }));
  };

  const handleAddAnotherCondition = () => {
    const current = (diagnosis || '').trim();
    if (current && !current.endsWith('+')) {
      setDiagnosis(`${current} + `);
    } else if (!current) {
      setDiagnosis('+ ');
    }
    const inputEl = document.getElementById('edit-patient-diagnosis-input') as HTMLInputElement;
    if (inputEl) {
      inputEl.focus();
    }
  };

  const bmi = calculateBMI(height, weight);

  const validate = () => {
    const errs: Record<string, string> = {};

    if (!name.trim()) {
      errs.name = 'Patient Full Name is required';
    } else if (name.trim().length < 2) {
      errs.name = 'Please enter a valid patient name (at least 2 characters)';
    }

    if (!age || String(age).trim() === '') {
      errs.age = 'Age is required';
    } else if (Number(age) <= 0 || Number(age) > 120) {
      errs.age = 'Please enter a valid age (1 - 120)';
    }

    if (!contact.trim()) {
      errs.contact = 'Contact phone number is required';
    } else if (contact.replace(/\D/g, '').length < 7) {
      errs.contact = 'Please enter a valid contact phone number (at least 7 digits)';
    }

    if (!address.trim()) {
      errs.address = 'Residential address is required';
    }

    if (!diagnosis.trim()) {
      errs.diagnosis = 'Clinical diagnosis / primary complaint is required';
    }

    if (!date) {
      errs.date = 'Date of consultation is required';
    }

    // Check for duplicate patient record among other patients
    const cleanPhone = contact.replace(/\D/g, '');
    const duplicate = existingPatients.find(
      (p) =>
        p.id !== patient.id &&
        !p.deleted &&
        cleanPhone.length >= 8 &&
        (p.contact || '').replace(/\D/g, '') === cleanPhone &&
        p.name.trim().toLowerCase() === name.trim().toLowerCase()
    );

    if (duplicate) {
      errs.name = `Duplicate patient warning: Another record for "${duplicate.name}" exists (ID: ${duplicate.regNo}).`;
    }

    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);

    const validationErrors = validate();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsSaving(true);

    const updatedPatient: Patient = {
      ...patient,
      name: name.trim(),
      regNo: regNo.trim() || patient.regNo,
      date,
      time: time.trim() || patient.time || formatTime24Hour(),
      age: Number(age) || age,
      sex,
      contact: contact.trim(),
      address: address.trim(),
      height,
      weight,
      bloodGroup,
      referredBy: referredBy.trim() || 'Self',
      seenBy: seenBy.trim() || 'R. Chandrashekar',
      diagnosis: diagnosis.trim(),
      history: history.trim(),
      painScaleBefore,
      painScaleAfter,
      painScale: painScaleBefore ?? patient.painScale,
      visitType,
      paymentMethod,
      treatmentFee: (treatmentFee !== undefined && treatmentFee !== null && treatmentFee !== '') ? treatmentFee : '500',
      updatedAt: Date.now(),
    };

    try {
      await onSave(updatedPatient);
      setSaveSuccessNotice(true);
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err) {
      console.warn('Error saving patient changes:', err);
      setIsSaving(false);
    }
  };

  const hasErrors = touched && Object.keys(errors).length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 lg:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-none lg:rounded-3xl w-full h-full lg:h-auto lg:max-h-[94vh] lg:max-w-3xl shadow-2xl border-0 lg:border border-sky-100 overflow-hidden my-0 lg:my-auto text-slate-800 flex flex-col">
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-sky-100 flex items-center justify-between bg-sky-50/80 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 bg-sky-700 rounded-2xl text-white shadow-xs shrink-0">
              <Edit3 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-extrabold text-sky-950 truncate">
                  Edit Patient Details & Demographics
                </h3>
                <span className="font-mono text-xs font-bold text-sky-800 bg-sky-100 border border-sky-200 px-2 py-0.5 rounded-lg shrink-0">
                  {regNo || patient.regNo}
                </span>
              </div>
              <p className="text-[10.5px] sm:text-[11px] text-slate-500 truncate">
                Update patient name, contact phone numbers, clinical diagnosis, and all initial registration data
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 active:bg-slate-300/60 transition-colors cursor-pointer shrink-0"
              title="Close (ESC)"
              aria-label="Close"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* Validation Alert Banner if submitted with missing details */}
          {hasErrors && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl text-xs flex items-start gap-2.5 shadow-2xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Please check highlighted details</p>
                <p className="text-[11px] text-rose-700 mt-0.5">
                  All mandatory demographics must be valid before saving updates.
                </p>
              </div>
            </div>
          )}

          {/* SECTION 1: Patient Primary Demographics */}
          <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-200/60">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-sky-950 flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5 text-sky-600" />
                <span>1. Patient Profile & Demographics</span>
              </h4>
              <div className="flex items-center gap-1.5 w-full sm:w-auto min-w-0">
                <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1 whitespace-nowrap shrink-0">
                  <UserCheck className="w-3.5 h-3.5 text-sky-600" />
                  <span>Seen by:</span>
                </label>
                <select
                  value={seenBy}
                  onChange={(e) => setSeenBy(e.target.value)}
                  className="flex-1 sm:flex-initial min-w-0 w-full sm:w-auto max-w-full sm:max-w-xs px-2.5 py-1 bg-white border border-sky-200 text-sky-950 rounded-xl text-xs font-bold outline-none cursor-pointer shadow-2xs truncate"
                >
                  {locums.map((pt) => (
                    <option key={pt.id} value={pt.name}>
                      {pt.name} {pt.qualification ? `• ${pt.qualification}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 0: Patient Full Name & Registration Number */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-700">
                    Patient Full Name <span className="text-rose-500">*</span>
                  </label>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
                    }}
                    placeholder="e.g. Ramesh Kumar / Smt. Meenakshi"
                    className={`w-full pl-3.5 pr-9 py-2.5 bg-white border rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:ring-1 outline-none font-bold shadow-2xs transition-all ${
                      errors.name
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200 bg-rose-50/30'
                        : 'border-slate-200 focus:border-sky-500 focus:ring-sky-200'
                    }`}
                    autoFocus
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <FieldVoiceMicButton
                      fieldKey="name"
                      fieldName="Patient Name"
                      onValueCaptured={(val) => {
                        setName(String(val));
                        if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
                      }}
                    />
                  </div>
                </div>
                {errors.name && <p className="text-[11px] font-semibold text-rose-600 mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Patient ID / Reg No
                </label>
                <input
                  type="text"
                  value={regNo}
                  onChange={(e) => setRegNo(e.target.value)}
                  placeholder="e.g. NPC/26/10/001"
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-sky-950 outline-none focus:border-sky-500 shadow-2xs"
                />
              </div>
            </div>

            {/* Age, Sex, Contact, Consultation Date Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {/* Age */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Age (Years) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => {
                      setAge(e.target.value);
                      if (errors.age) setErrors((prev) => ({ ...prev, age: '' }));
                    }}
                    placeholder="e.g. 48"
                    min="1"
                    max="120"
                    className={`w-full pl-3 pr-8 py-2 bg-white border rounded-xl text-xs font-semibold text-slate-900 outline-none shadow-2xs ${
                      errors.age
                        ? 'border-rose-400 focus:border-rose-500 bg-rose-50/30'
                        : 'border-slate-200 focus:border-sky-500'
                    }`}
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2">
                    <FieldVoiceMicButton
                      fieldKey="age"
                      fieldName="Age"
                      size="xs"
                      onValueCaptured={(val, extra) => {
                        setAge(String(val));
                        if (extra?.sex) {
                          setSex(extra.sex as any);
                        }
                        if (errors.age) setErrors((prev) => ({ ...prev, age: '' }));
                      }}
                    />
                  </div>
                </div>
                {errors.age && <p className="text-[10px] font-semibold text-rose-600 mt-0.5">{errors.age}</p>}
              </div>

              {/* Sex */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Sex <span className="text-rose-500">*</span>
                </label>
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 outline-none focus:border-sky-500 shadow-2xs cursor-pointer"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Contact Phone */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Contact Phone <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="tel"
                    value={contact}
                    onChange={(e) => {
                      setContact(e.target.value);
                      if (errors.contact) setErrors((prev) => ({ ...prev, contact: '' }));
                    }}
                    placeholder="e.g. 9880517715"
                    className={`w-full pl-8 pr-8 py-2 bg-white border rounded-xl text-xs font-mono font-semibold text-slate-900 outline-none shadow-2xs ${
                      errors.contact
                        ? 'border-rose-400 focus:border-rose-500 bg-rose-50/30'
                        : 'border-slate-200 focus:border-sky-500'
                    }`}
                  />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                    <FieldVoiceMicButton
                      fieldKey="contact"
                      fieldName="Contact Phone"
                      size="xs"
                      onValueCaptured={(val) => {
                        setContact(String(val));
                        if (errors.contact) setErrors((prev) => ({ ...prev, contact: '' }));
                      }}
                    />
                  </div>
                </div>
                {errors.contact && (
                  <p className="text-[10px] font-semibold text-rose-600 mt-0.5">{errors.contact}</p>
                )}
              </div>

              {/* Consultation Date */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Consultation Date <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      if (errors.date) setErrors((prev) => ({ ...prev, date: '' }));
                    }}
                    className={`w-full pl-8 pr-3 py-2 bg-white border rounded-xl text-xs font-semibold text-slate-900 outline-none shadow-2xs ${
                      errors.date
                        ? 'border-rose-400 focus:border-rose-500 bg-rose-50/30'
                        : 'border-slate-200 focus:border-sky-500'
                    }`}
                  />
                </div>
                {errors.date && <p className="text-[10px] font-semibold text-rose-600 mt-0.5">{errors.date}</p>}
              </div>
            </div>

            {/* Residential Address & Consultation Time */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Residential Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      if (errors.address) setErrors((prev) => ({ ...prev, address: '' }));
                    }}
                    placeholder="Street, Layout, Landmark, Mysuru"
                    className={`w-full pl-8 pr-8 py-2 bg-white border rounded-xl text-xs font-medium text-slate-900 outline-none shadow-2xs ${
                      errors.address
                        ? 'border-rose-400 focus:border-rose-500 bg-rose-50/30'
                        : 'border-slate-200 focus:border-sky-500'
                    }`}
                  />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                    <FieldVoiceMicButton
                      fieldKey="address"
                      fieldName="Address"
                      size="xs"
                      onValueCaptured={(val) => {
                        setAddress(String(val));
                        if (errors.address) setErrors((prev) => ({ ...prev, address: '' }));
                      }}
                    />
                  </div>
                </div>
                {errors.address && (
                  <p className="text-[10px] font-semibold text-rose-600 mt-0.5">{errors.address}</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Time (HH:MM)
                </label>
                <div className="relative">
                  <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    placeholder="e.g. 10:30"
                    className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-900 outline-none focus:border-sky-500 shadow-2xs"
                  />
                </div>
              </div>
            </div>

            {/* Height, Weight, Blood Group, Referred By */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Height</label>
                <div className="relative">
                  <input
                    type="text"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="5'6&quot;"
                    list="edit-pt-height-presets"
                    className="w-full pl-3 pr-7 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-sky-500 shadow-2xs"
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2">
                    <FieldVoiceMicButton
                      fieldKey="height"
                      fieldName="Height"
                      size="xs"
                      onValueCaptured={(val) => setHeight(String(val))}
                    />
                  </div>
                </div>
                <datalist id="edit-pt-height-presets">
                  {HEIGHT_PRESETS.map((h) => (
                    <option key={h} value={h} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Weight (kg)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="65"
                    className="w-full pl-3 pr-7 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-sky-500 shadow-2xs"
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2">
                    <FieldVoiceMicButton
                      fieldKey="weight"
                      fieldName="Weight"
                      size="xs"
                      onValueCaptured={(val) => setWeight(String(val))}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Blood Group</label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-sky-500 shadow-2xs cursor-pointer"
                >
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-bold text-slate-600">Referred By</label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowManageDocsModal(true)}
                      className="text-[10px] font-bold text-slate-500 hover:text-sky-700 transition-colors flex items-center gap-0.5 cursor-pointer"
                      title="Manage referral doctors (Add or Remove)"
                    >
                      <Settings2 className="w-2.5 h-2.5" />
                      <span>Manage</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingNewDoc(!isAddingNewDoc)}
                      className="text-[10px] font-bold text-sky-600 hover:text-sky-800 transition-colors flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{isAddingNewDoc ? 'Cancel' : '+ Add'}</span>
                    </button>
                  </div>
                </div>

                {isAddingNewDoc ? (
                  <div className="flex items-center gap-1">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={newDocInput}
                        onChange={(e) => setNewDocInput(e.target.value)}
                        placeholder="e.g. Dr. Kumar"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddNewReferralDoc();
                          }
                        }}
                        className="w-full pl-2.5 pr-7 py-1 bg-white border border-sky-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-sky-300 outline-none shadow-2xs"
                      />
                      <div className="absolute right-1 top-1/2 -translate-y-1/2">
                        <FieldVoiceMicButton
                          fieldKey="referredBy"
                          fieldName="Doctor Name"
                          size="xs"
                          onValueCaptured={(val) => setNewDocInput(String(val))}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddNewReferralDoc}
                      className="px-2 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-2xs cursor-pointer"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <select
                    value={referredBy || 'Self / Direct'}
                    onChange={(e) => {
                      if (e.target.value === '__add_new__') {
                        setIsAddingNewDoc(true);
                      } else if (e.target.value === '__manage_docs__') {
                        setShowManageDocsModal(true);
                      } else {
                        setReferredBy(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-sky-500 shadow-2xs cursor-pointer"
                  >
                    {referredBy && !referralDocs.includes(referredBy) && (
                      <option value={referredBy}>{referredBy}</option>
                    )}
                    {referralDocs.map((doc) => (
                      <option key={doc} value={doc}>
                        {doc}
                      </option>
                    ))}
                    <option value="__add_new__">+ Add New Referral Doctor...</option>
                    <option value="__manage_docs__">⚙️ Manage Doctor List (Add/Remove)...</option>
                  </select>
                )}
              </div>
            </div>

            {/* BMI Live Preview */}
            {bmi && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Calculated BMI:</span>
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-lg border border-sky-200 bg-sky-50 text-sky-900">
                  {bmi.bmi} kg/m² ({bmi.category})
                </span>
              </div>
            )}
          </div>

          {/* SECTION 2: Clinical Assessment & Chief Diagnosis */}
          <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-sky-950 flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5 text-sky-600" />
              <span>2. Clinical Diagnosis & Consultation Fee</span>
            </h4>

            {/* Diagnosis Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="edit-patient-diagnosis-select" className="block text-[11px] font-bold text-slate-700">
                  Field 1: Choose Diagnosis Preset
                </label>
                <span className="text-[10px] text-sky-700 font-semibold bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                  Copies to Field 2 • '+' adds next condition
                </span>
              </div>

              {/* Field 1: Preset Selector Dropdown */}
              <div className="relative">
                <select
                  id="edit-patient-diagnosis-select"
                  value=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__custom__') {
                      const el = document.getElementById('edit-patient-diagnosis-input') as HTMLInputElement;
                      if (el) el.focus();
                    } else if (val) {
                      handleDiagnosisSelect(val);
                    }
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-sky-500 shadow-2xs cursor-pointer"
                >
                  <option value="">+ Add Condition from Common Diagnoses...</option>
                  {COMMON_DIAGNOSES.map((d) => (
                    <option key={d} value={d}>
                      + {d}
                    </option>
                  ))}
                  <option value="__custom__">✎ Type Custom Diagnosis...</option>
                </select>
              </div>

              {/* Field 2 Header with '+' Action */}
              <div className="flex items-center justify-between pt-1">
                <label htmlFor="edit-patient-diagnosis-input" className="block text-[11px] font-bold text-slate-700">
                  Field 2: Clinical Diagnosis (Copies Field 1, or appends when '+' entered) <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleAddAnotherCondition}
                  className="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 cursor-pointer flex items-center gap-1 transition-colors"
                  title="Enter '+' to append another diagnosis from Field 1"
                >
                  <span>+ Add Another Condition</span>
                </button>
              </div>

              {/* Field 2 Custom Text Input */}
              <div className="relative">
                <input
                  type="text"
                  id="edit-patient-diagnosis-input"
                  value={diagnosis}
                  onChange={(e) => {
                    setDiagnosis(e.target.value);
                    if (errors.diagnosis) setErrors((prev) => ({ ...prev, diagnosis: '' }));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddAnotherCondition();
                    }
                  }}
                  placeholder="e.g. Cervical Spondylosis, Lumbar Disc Herniation, Frozen Shoulder..."
                  className={`w-full pl-3.5 pr-9 py-2.5 bg-white border rounded-xl text-xs text-slate-900 outline-none font-bold shadow-2xs ${
                    errors.diagnosis
                      ? 'border-rose-400 focus:border-rose-500 bg-rose-50/30'
                      : 'border-slate-200 focus:border-sky-500'
                  }`}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <FieldVoiceMicButton
                    fieldKey="diagnosis"
                    fieldName="Clinical Diagnosis"
                    onValueCaptured={(val) => {
                      setDiagnosis(String(val));
                      if (errors.diagnosis) setErrors((prev) => ({ ...prev, diagnosis: '' }));
                    }}
                  />
                </div>
              </div>
              {errors.diagnosis && (
                <p className="text-[11px] font-semibold text-rose-600 mt-1">{errors.diagnosis}</p>
              )}

              {/* Helper notice when '+' is entered */}
              {(diagnosis || '').trim().endsWith('+') && (
                <div className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 animate-pulse">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>'+' entered: Now choose a condition from Field 1 dropdown or chips below to add it!</span>
                </div>
              )}

              {/* Quick Preset Diagnosis Chips */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[10px] text-slate-400 font-bold">Quick Chips:</span>
                {COMMON_DIAGNOSES.slice(0, 5).map((d) => (
                  <button
                    type="button"
                    key={d}
                    onClick={() => handleDiagnosisSelect(d)}
                    className={`text-[10.5px] font-medium px-2 py-0.5 rounded-lg border transition-colors cursor-pointer ${
                      diagnosis === d
                        ? 'bg-sky-600 text-white border-sky-600 font-bold'
                        : (diagnosis || '').includes(d)
                        ? 'bg-sky-100 text-sky-900 border-sky-300 font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-sky-50'
                    }`}
                  >
                    {d}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleAddAnotherCondition}
                  className="text-[10.5px] font-bold px-2 py-0.5 rounded-lg border border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 cursor-pointer"
                  title="Append ' + ' to add next condition"
                >
                  + Add (+)
                </button>
              </div>
            </div>

            {/* Clinical Notes / Symptoms */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Chief Complaints / Clinical Notes
              </label>
              <div className="relative">
                <textarea
                  value={history}
                  onChange={(e) => setHistory(e.target.value)}
                  rows={2}
                  placeholder="Brief description of onset, pain radiation, duration, functional limitations..."
                  className="w-full pl-3 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-sky-500 shadow-2xs resize-none"
                />
                <div className="absolute right-2 top-2">
                  <FieldVoiceMicButton
                    fieldKey="history"
                    fieldName="Clinical Notes"
                    appendMode
                    currentValue={history}
                    onValueCaptured={(val) => setHistory(String(val))}
                  />
                </div>
              </div>
            </div>

            {/* Visual Analogue Pain Scale (Before & After Initial Treatment) */}
            <PainScaleComponent
              labelBefore="Initial Pain Before Treatment (VAS)"
              labelAfter="Initial Pain After Treatment (VAS)"
              beforeValue={painScaleBefore}
              afterValue={painScaleAfter}
              onChangeBefore={setPainScaleBefore}
              onChangeAfter={setPainScaleAfter}
            />

            {/* Visit Mode, Fee & Payment */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Visit Type</label>
                <select
                  value={visitType}
                  onChange={(e) => setVisitType(e.target.value as VisitType)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 outline-none focus:border-sky-500 shadow-2xs cursor-pointer"
                >
                  <option value="Clinic">Clinic Visit</option>
                  <option value="Home Visit">Home Visit</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Consultation Fee (₹)
                </label>
                <div className="relative">
                  <IndianRupee className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="number"
                    value={treatmentFee}
                    onChange={(e) => setTreatmentFee(e.target.value)}
                    placeholder="500"
                    className="w-full pl-8 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none focus:border-sky-500 shadow-2xs"
                  />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                    <FieldVoiceMicButton
                      fieldKey="treatmentFee"
                      fieldName="Consultation Fee"
                      size="xs"
                      onValueCaptured={(val) => setTreatmentFee(String(val))}
                    />
                  </div>
                </div>
                <div className="flex gap-1 pt-1.5 flex-wrap">
                  {['0', '300', '500', '700', '1000'].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTreatmentFee(amt)}
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border cursor-pointer ${
                        String(treatmentFee) === amt
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      ₹{amt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 outline-none focus:border-sky-500 shadow-2xs cursor-pointer"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI / GPay / PhonePe</option>
                  <option value="Card">Credit / Debit Card</option>
                  <option value="Bank Transfer">Bank Transfer / NEFT</option>
                </select>
              </div>
            </div>
          </div>
        </form>

        {/* Modal Sticky Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500">
            <span className="text-rose-600 font-bold">*</span> Mandatory fields for patient record
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSubmit}
              className="flex items-center gap-1.5 px-5 py-2 bg-sky-700 hover:bg-sky-800 disabled:bg-sky-400 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Syncing with Google Spreadsheet...</span>
                </>
              ) : saveSuccessNotice ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Saved & Synced!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Manage Referral Doctors Modal */}
      {showManageDocsModal && (
        <ManageReferralDoctorsModal
          isOpen={showManageDocsModal}
          doctors={referralDocs}
          onClose={() => setShowManageDocsModal(false)}
          onAddDoctor={(newDoc) => {
            const trimmed = newDoc.trim();
            if (trimmed && !referralDocs.includes(trimmed)) {
              const updated = [...referralDocs, trimmed];
              setReferralDocs(updated);
              saveCommonReferralDoctors(updated);
              setReferredBy(trimmed);
            }
          }}
          onDeleteDoctor={(docToDelete) => {
            const updated = referralDocs.filter((d) => d !== docToDelete);
            setReferralDocs(updated);
            saveCommonReferralDoctors(updated);
            if (referredBy === docToDelete) {
              setReferredBy('Self');
            }
          }}
        />
      )}
    </div>
  );
};
