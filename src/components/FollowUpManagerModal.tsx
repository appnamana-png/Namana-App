import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Search,
  User,
  Phone,
  ArrowRight,
  Plus,
  X,
  FileText,
  Trash2,
  CheckCircle2,
  CalendarDays,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Mic,
  Edit3,
} from 'lucide-react';
import { Patient, FollowUpVisit } from '../types';
import { formatPatientId, formatTime24Hour, defaultTreatmentModalities } from '../utils/storage';

interface ScheduledFollowUpItem {
  patient: Patient;
  followUp: FollowUpVisit;
  sessionIndex: number;
  isToday: boolean;
  isUpcoming: boolean;
  isPast: boolean;
}

interface FollowUpManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  onSelectPatient: (patientId: string) => void;
  onUpdateFollowUp: (patientId: string, sessionIndex: number, updated: Partial<FollowUpVisit>) => void;
  onAddFollowUp: (patientId: string, newFollowUp: FollowUpVisit) => void;
  onDeleteFollowUp: (patientId: string, sessionIndex: number) => void;
  onVoiceEditPatient?: (patientId: string) => void;
  onEditPatient?: (patient: Patient) => void;
}

export const FollowUpManagerModal: React.FC<FollowUpManagerModalProps> = ({
  isOpen,
  onClose,
  patients,
  onSelectPatient,
  onUpdateFollowUp,
  onAddFollowUp,
  onDeleteFollowUp,
  onVoiceEditPatient,
  onEditPatient,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'today' | 'upcoming' | 'past'>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingSessionKey, setEditingSessionKey] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [isSchedulingNew, setIsSchedulingNew] = useState(false);

  // New follow up form state
  const [newPatientId, setNewPatientId] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [newTime, setNewTime] = useState('10:00');
  const [newNotes, setNewNotes] = useState('Scheduled follow-up consultation');
  const [newFee, setNewFee] = useState('500');

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Collect all follow-ups across active patients
  const allFollowUps = useMemo(() => {
    const list: ScheduledFollowUpItem[] = [];

    patients.forEach((patient) => {
      if (patient.deleted) return;
      (patient.followUps || []).forEach((fu, sessionIndex) => {
        if (!fu.date) return;
        const isToday = fu.date === todayISO;
        const isUpcoming = fu.date > todayISO;
        const isPast = fu.date < todayISO;

        list.push({
          patient,
          followUp: fu,
          sessionIndex,
          isToday,
          isUpcoming,
          isPast,
        });
      });
    });

    // Chronological sort: Date, then Time
    list.sort((a, b) => {
      const dateCmp = a.followUp.date.localeCompare(b.followUp.date);
      if (dateCmp !== 0) return dateCmp;
      const timeA = a.followUp.time || '10:00:00';
      const timeB = b.followUp.time || '10:00:00';
      return timeA.localeCompare(timeB);
    });

    return list;
  }, [patients, todayISO]);

  // Counts
  const counts = useMemo(() => {
    let today = 0;
    let upcoming = 0;
    let past = 0;
    allFollowUps.forEach((item) => {
      if (item.isToday) today++;
      else if (item.isUpcoming) upcoming++;
      else if (item.isPast) past++;
    });
    return {
      all: allFollowUps.length,
      today,
      upcoming,
      past,
    };
  }, [allFollowUps]);

  // Filtered by tab and search
  const filteredList = useMemo(() => {
    return allFollowUps.filter((item) => {
      if (activeTab === 'today' && !item.isToday) return false;
      if (activeTab === 'upcoming' && !item.isUpcoming) return false;
      if (activeTab === 'past' && !item.isPast) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const p = item.patient;
        const fu = item.followUp;
        const matchName = (p.name || '').toLowerCase().includes(q);
        const matchReg = (p.regNo || '').toLowerCase().includes(q);
        const matchPhone = (p.contact || '').includes(q);
        const matchDiag = (p.diagnosis || '').toLowerCase().includes(q);
        const matchNotes = (fu.notes || '').toLowerCase().includes(q);
        return matchName || matchReg || matchPhone || matchDiag || matchNotes;
      }
      return true;
    });
  }, [allFollowUps, activeTab, searchQuery]);

  if (!isOpen) return null;

  const handleStartEdit = (key: string, date: string, time?: string) => {
    setEditingSessionKey(key);
    setEditDate(date);
    setEditTime(time ? time.slice(0, 5) : '10:00');
  };

  const handleSaveEdit = (patientId: string, sessionIndex: number) => {
    if (!editDate) return;
    onUpdateFollowUp(patientId, sessionIndex, {
      date: editDate,
      time: editTime ? `${editTime}:00` : '10:00:00',
    });
    setEditingSessionKey(null);
  };

  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientId) return;

    const targetPatient = patients.find((p) => p.id === newPatientId);
    if (!targetPatient) return;

    const nextSessionNum = (targetPatient.followUps?.length || 0) + 1;
    const newFollowUpItem: FollowUpVisit = {
      id: `fu_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      date: newDate || todayISO,
      time: newTime ? `${newTime}:00` : formatTime24Hour(),
      notes: newNotes || `Scheduled Session #${nextSessionNum}`,
      painScale: 5,
      treatment: { ...(targetPatient.treatment || defaultTreatmentModalities()) },
      fee: newFee !== undefined && newFee !== '' ? newFee : (targetPatient.treatmentFee !== undefined ? targetPatient.treatmentFee : '500'),
      visitType: targetPatient.visitType || 'Clinic',
      paymentMethod: targetPatient.paymentMethod || 'UPI',
      seenBy: targetPatient.seenBy || 'Dr. Vinay',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    onAddFollowUp(newPatientId, newFollowUpItem);
    setIsSchedulingNew(false);
    setNewPatientId('');
    setNewNotes('Scheduled follow-up consultation');
  };

  // Human readable time formatter
  const formatTimeDisplay = (timeStr?: string) => {
    if (!timeStr) return '10:00 AM';
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
      let hours = parseInt(parts[0], 10);
      const mins = parts[1];
      const meridiem = hours >= 12 ? 'PM' : 'AM';
      if (hours > 12) hours -= 12;
      if (hours === 0) hours = 12;
      return `${hours}:${mins} ${meridiem}`;
    }
    return timeStr;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs">
      <div
        className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-sky-100 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-sky-900 via-sky-800 to-teal-800 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shadow-xs">
              <CalendarDays className="w-5 h-5 text-sky-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
                  Follow-Up & Appointment Manager
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400 text-slate-950">
                  {counts.today} Today
                </span>
              </div>
              <p className="text-xs text-sky-200">
                Scheduled clinical follow-up sessions date & time wise
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSchedulingNew(!isSchedulingNew)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs transition-all cursor-pointer border border-white/20 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Schedule New</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/15 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Schedule New Drawer / Inline Form */}
        {isSchedulingNew && (
          <form
            onSubmit={handleScheduleSubmit}
            className="p-4 bg-sky-50/80 border-b border-sky-200/80 shrink-0 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-sky-950 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                <span>Schedule New Follow-up Appointment</span>
              </span>
              <button
                type="button"
                onClick={() => setIsSchedulingNew(false)}
                className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Select Patient *</label>
                <select
                  required
                  value={newPatientId}
                  onChange={(e) => setNewPatientId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-sky-300 rounded-xl font-semibold text-slate-800 shadow-2xs outline-none"
                >
                  <option value="">-- Choose Patient --</option>
                  {patients
                    .filter((p) => !p.deleted)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name || 'Unnamed'} (ID: {p.regNo || p.id.slice(0, 8)}) {p.contact ? `• ${p.contact}` : ''}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Appointment Date *</label>
                <input
                  type="date"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-sky-300 rounded-xl font-semibold text-slate-800 shadow-2xs outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Appointment Time *</label>
                <input
                  type="time"
                  required
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-sky-300 rounded-xl font-semibold text-slate-800 shadow-2xs outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs pt-1">
              <div className="sm:col-span-3">
                <label className="block font-bold text-slate-700 mb-1">Session Plan / Clinical Notes</label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="e.g. Range of motion assessment, cervical traction"
                  className="w-full px-3 py-1.5 bg-white border border-sky-300 rounded-xl font-medium text-slate-800 shadow-2xs outline-none"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2 bg-sky-700 hover:bg-sky-800 text-white font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Schedule</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Filter Tabs & Search Bar */}
        <div className="p-3 sm:px-5 sm:py-3 bg-slate-50 border-b border-slate-200 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs overflow-x-auto text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('today')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'today'
                  ? 'bg-amber-500 text-slate-950 font-extrabold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Today's ({counts.today})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('upcoming')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'upcoming'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Upcoming ({counts.upcoming})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'all'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({counts.all})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('past')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'past'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Past ({counts.past})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patient, diagnosis..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-sky-500 shadow-2xs"
            />
          </div>
        </div>

        {/* Follow-up List Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3 min-h-0">
          {filteredList.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Calendar className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
              <p className="text-xs font-bold text-slate-600">
                {activeTab === 'today'
                  ? 'No follow-up sessions scheduled for today'
                  : activeTab === 'upcoming'
                  ? 'No upcoming future follow-up sessions scheduled'
                  : 'No scheduled follow-up visits matching criteria'}
              </p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Schedule follow-up sessions through voice dictation ("Follow up date tomorrow at 4 PM") or using the Schedule New button above.
              </p>
            </div>
          ) : (
            filteredList.map((item) => {
              const { patient, followUp, sessionIndex, isToday, isUpcoming } = item;
              const sessionKey = `${patient.id}_${sessionIndex}`;
              const isEditing = editingSessionKey === sessionKey;

              return (
                <div
                  key={sessionKey}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition-all shadow-xs ${
                    isToday
                      ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-200'
                      : isUpcoming
                      ? 'bg-white border-sky-200 hover:border-sky-300'
                      : 'bg-slate-50/80 border-slate-200 opacity-90'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    {/* Date & Time Header */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {isToday ? (
                        <span className="px-2.5 py-0.5 rounded-lg bg-amber-400 text-slate-950 font-black text-xs shadow-2xs flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-950" />
                          <span>TODAY</span>
                        </span>
                      ) : isUpcoming ? (
                        <span className="px-2 py-0.5 rounded-lg bg-sky-100 text-sky-900 font-extrabold text-xs border border-sky-200">
                          UPCOMING
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-lg bg-slate-200 text-slate-700 font-bold text-[11px]">
                          COMPLETED
                        </span>
                      )}

                      {/* Scheduled Date & Time */}
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-sky-300 shadow-xs">
                          <input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className="px-2 py-0.5 text-xs font-bold text-slate-800 border rounded"
                          />
                          <input
                            type="time"
                            value={editTime}
                            onChange={(e) => setEditTime(e.target.value)}
                            className="px-2 py-0.5 text-xs font-bold text-slate-800 border rounded"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(patient.id, sessionIndex)}
                            className="px-2 py-0.5 bg-emerald-600 text-white rounded text-xs font-bold"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingSessionKey(null)}
                            className="px-1.5 py-0.5 text-slate-500 hover:text-slate-800 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-extrabold text-slate-900 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-sky-700" />
                            <span>{followUp.date}</span>
                          </span>
                          <span className="font-bold text-sky-800 bg-sky-100/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Clock className="w-3 h-3 text-sky-600" />
                            <span>{formatTimeDisplay(followUp.time)}</span>
                          </span>
                        </div>
                      )}

                      <span className="text-[11px] font-bold text-slate-500">
                        Session #{sessionIndex + 1}
                      </span>
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                      {!isEditing && (
                        <button
                          type="button"
                          onClick={() => handleStartEdit(sessionKey, followUp.date, followUp.time)}
                          className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                          title="Reschedule Date or Time"
                        >
                          Reschedule
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onSelectPatient(patient.id);
                        }}
                        className="px-2.5 py-1 bg-sky-700 hover:bg-sky-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                        title="Open full patient chart"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Case Sheet</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteFollowUp(patient.id, sessionIndex)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Cancel / delete this session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Patient Info Row */}
                  <div className="mt-2.5 pt-2 border-t border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-slate-900 text-sm">
                          {patient.name || 'Unnamed Patient'}
                        </span>
                        {onEditPatient && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditPatient(patient);
                            }}
                            className="px-1.5 py-0.5 rounded-lg text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors cursor-pointer inline-flex items-center gap-1 text-[10px] font-bold"
                            title="Edit patient name, details & phone number"
                          >
                            <Edit3 className="w-2.5 h-2.5 text-sky-600" />
                            <span>Edit</span>
                          </button>
                        )}
                        <span className="text-[10px] font-mono font-bold text-sky-900 bg-sky-50 px-1.5 py-0.2 rounded border border-sky-200">
                          {patient.regNo || formatPatientId(patient.date, patient.serial)}
                        </span>
                        {patient.age && <span className="text-slate-500">{patient.age}y</span>}
                        {patient.sex && <span className="text-slate-500">• {patient.sex}</span>}
                      </div>

                      {patient.diagnosis && (
                        <p className="text-[11px] text-slate-600 line-clamp-1 italic">
                          Dx: {patient.diagnosis}
                        </p>
                      )}
                    </div>

                    {/* Contact details */}
                    <div className="flex items-center gap-2 text-[11px] text-slate-600 shrink-0">
                      {patient.contact ? (
                        <a
                          href={`tel:${patient.contact}`}
                          className="flex items-center gap-1 text-sky-700 hover:text-sky-900 bg-white px-2 py-0.5 rounded-lg border border-slate-200 shadow-2xs font-semibold"
                        >
                          <Phone className="w-3 h-3 text-sky-600" />
                          <span>{patient.contact}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400 italic">No phone</span>
                      )}

                      {followUp.fee && (
                        <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          ₹{followUp.fee}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Clinical Session Notes if any */}
                  {followUp.notes && (
                    <div className="mt-2 text-[11px] bg-white/70 p-2 rounded-xl border border-slate-200/60 text-slate-700">
                      <span className="font-bold text-slate-800">Plan / Notes: </span>
                      <span>{followUp.notes}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0 text-xs">
          <span className="text-slate-500">
            Total {counts.all} recorded follow-up sessions across clinic database
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-colors cursor-pointer shadow-2xs"
          >
            Close Manager
          </button>
        </div>
      </div>
    </div>
  );
};
