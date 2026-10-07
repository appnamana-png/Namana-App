import React, { useState, useMemo } from 'react';
import {
  X,
  Phone,
  MessageSquare,
  Send,
  CheckSquare,
  Square,
  Search,
  Copy,
  Check,
  Users,
  Smartphone,
  Sparkles,
  ExternalLink,
  Edit3,
} from 'lucide-react';
import { Patient } from '../types';
import { formatPatientId, comparePatientsByIdDesc, comparePatientsByIdAsc } from '../utils/storage';
import { getCleanPhone, openWhatsApp } from '../utils/whatsappHelper';

interface PatientPhoneDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  onEditPatient?: (patient: Patient) => void;
}

type MessageChannel = 'whatsapp' | 'sms';

export const PatientPhoneDirectoryModal: React.FC<PatientPhoneDirectoryModalProps> = ({
  isOpen,
  onClose,
  patients,
  onEditPatient,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'withPhone'>('withPhone');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [messageChannel, setMessageChannel] = useState<MessageChannel>('whatsapp');
  const [customMessage, setCustomMessage] = useState(
    'Dear {name}, this is a gentle reminder from Namana Physiotherapy Clinic regarding your ongoing rehabilitation and posture care. Please stay regular with your prescribed home exercises. For appointments or assistance, contact 9880517715.'
  );
  const [copiedNumbersNotice, setCopiedNumbersNotice] = useState(false);
  const [broadcastIndex, setBroadcastIndex] = useState(0);
  const [sortBy, setSortBy] = useState<'id-desc' | 'id-asec'>('id-desc');

  // Filter and sort patients based on query and mode (newest Patient ID first by default)
  const filteredPatients = useMemo(() => {
    const list = patients.filter((p) => {
      // Exclude deleted patients (only show active data from the backup sheet, never archives)
      if (p.deleted || p.status === 'Deleted') return false;
      if (filterMode === 'withPhone' && (!p.contact || !p.contact.trim())) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const pId = p.regNo || formatPatientId(p.date, p.serial);
        const name = (p.name || '').toLowerCase();
        const contact = (p.contact || '').toLowerCase();
        const diagnosis = (p.diagnosis || '').toLowerCase();
        return name.includes(q) || contact.includes(q) || pId.toLowerCase().includes(q) || diagnosis.includes(q);
      }

      return true;
    });

    return list.sort(sortBy === 'id-desc' ? comparePatientsByIdDesc : comparePatientsByIdAsc);
  }, [patients, filterMode, searchQuery, sortBy]);

  // Selected patients array
  const selectedPatients = useMemo(() => {
    return filteredPatients.filter((p) => selectedIds.has(p.id));
  }, [filteredPatients, selectedIds]);

  // Handle Select All / Deselect All
  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredPatients.length && filteredPatients.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPatients.map((p) => p.id)));
    }
  };

  const handleTogglePatient = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Preset Message Templates
  const applyPreset = (template: string) => {
    setCustomMessage(template);
  };

  // Get substituted message for a specific patient
  const getPatientMessage = (p: Patient) => {
    const patientName = p.name ? p.name.trim() : 'Patient';
    return customMessage.replace(/\{name\}/g, patientName);
  };

  // Copy phone numbers
  const handleCopyPhoneNumbers = () => {
    const targetList = selectedPatients.length > 0 ? selectedPatients : filteredPatients;
    const numbers = targetList
      .map((p) => p.contact)
      .filter(Boolean)
      .map((num) => num.replace(/\D/g, ''))
      .filter((n) => n.length >= 10);

    if (numbers.length === 0) {
      alert('No valid phone numbers found in selection.');
      return;
    }

    navigator.clipboard.writeText(numbers.join(', '));
    setCopiedNumbersNotice(true);
    setTimeout(() => setCopiedNumbersNotice(false), 3000);
  };

  // Send WhatsApp to single patient
  const handleSendWhatsAppSingle = (p: Patient) => {
    if (!p.contact) {
      alert(`Patient ${p.name} does not have a recorded contact number.`);
      return;
    }
    const msg = getPatientMessage(p);
    openWhatsApp(p.contact, msg);
  };

  // Send SMS to single patient
  const handleSendSmsSingle = (p: Patient) => {
    if (!p.contact) {
      alert(`Patient ${p.name} does not have a recorded contact number.`);
      return;
    }
    const msg = getPatientMessage(p);
    const cleanPhone = p.contact.replace(/\D/g, '');
    window.open(`sms:${cleanPhone}?body=${encodeURIComponent(msg)}`, '_blank');
  };

  // Broadcast WhatsApp to next selected patient
  const handleBroadcastNextWhatsApp = () => {
    const list = selectedPatients.length > 0 ? selectedPatients : filteredPatients;
    if (list.length === 0) return;

    const safeIndex = broadcastIndex % list.length;
    const current = list[safeIndex];
    handleSendWhatsAppSingle(current);

    setBroadcastIndex((prev) => (prev + 1) % list.length);
  };

  // Bulk SMS
  const handleBulkSms = () => {
    const targetList = selectedPatients.length > 0 ? selectedPatients : filteredPatients;
    const numbers = targetList
      .map((p) => p.contact)
      .filter(Boolean)
      .map((n) => n.replace(/\D/g, ''))
      .filter((n) => n.length >= 10);

    if (numbers.length === 0) {
      alert('Please select at least one patient with a valid phone number.');
      return;
    }

    // Default message with generic greeting if sending to multiple
    const genericMsg = customMessage.replace(/\{name\}/g, 'Valued Patient');
    const numbersStr = numbers.join(',');
    window.open(`sms:${numbersStr}?body=${encodeURIComponent(genericMsg)}`, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-slate-900 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-800 overflow-hidden text-slate-200">
        {/* Top Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-cyan-600/30 text-cyan-400 border border-cyan-500/40 flex items-center justify-center shadow-inner shrink-0">
              <Phone className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2 flex-wrap">
                <span>Patient Phone Number Directory</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 font-mono font-bold border border-cyan-800/80">
                  {patients.filter((p) => p.contact && p.contact.trim()).length} Contacts
                </span>
              </h2>
              <p className="text-xs text-slate-400 truncate">
                1-Click WhatsApp &amp; Call actions, SMS text composer, and instant contact directory.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0 ml-2"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Main Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
          {/* Message Broadcast Composer Panel */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-cyan-400 shrink-0" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Message Broadcaster &amp; SMS Composer
                </h3>
              </div>

              {/* Message Channel Selector */}
              <div className="flex items-center p-1 bg-slate-900 border border-slate-700/80 rounded-xl shadow-inner self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setMessageChannel('whatsapp')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    messageChannel === 'whatsapp'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMessageChannel('sms')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    messageChannel === 'sms'
                      ? 'bg-cyan-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>SMS Text</span>
                </button>
              </div>
            </div>

            {/* Quick Preset Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-slate-400">Templates:</span>
              <button
                type="button"
                onClick={() =>
                  applyPreset(
                    'Dear {name}, this is a gentle reminder from Namana Physiotherapy Clinic regarding your ongoing rehabilitation. Please stay regular with your prescribed home exercises. Contact 9880517715 for queries.'
                  )
                }
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-medium border border-slate-700/80 transition-colors cursor-pointer"
              >
                🏃 Exercise Reminder
              </button>
              <button
                type="button"
                onClick={() =>
                  applyPreset(
                    'Dear {name}, greeting from Namana Physiotherapy Clinic. Please schedule your follow-up rehabilitation session to ensure continuous pain relief and mobility recovery.'
                  )
                }
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-medium border border-slate-700/80 transition-colors cursor-pointer"
              >
                📅 Follow-up Notice
              </button>
              <button
                type="button"
                onClick={() =>
                  applyPreset(
                    'Dear {name}, thank you for choosing Namana Physiotherapy Clinic for your treatment. We wish you sound health and active mobility.'
                  )
                }
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-medium border border-slate-700/80 transition-colors cursor-pointer"
              >
                🌟 Wellness Greeting
              </button>
            </div>

            {/* Textarea */}
            <div className="space-y-1">
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={3}
                placeholder="Type custom message. Tip: use {name} to auto-insert patient name..."
                className="w-full p-3 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-100 font-medium focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none resize-none placeholder:text-slate-500"
              />
              <p className="text-[10.5px] text-slate-400 flex items-center justify-between">
                <span>
                  Tip: <b className="text-cyan-400">{'{name}'}</b> dynamically inserts patient name.
                </span>
                <span>{customMessage.length} characters</span>
              </p>
            </div>

            {/* Broadcast Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-300">
                  Recipients:{' '}
                  <b className="text-cyan-400">
                    {selectedPatients.length > 0
                      ? `${selectedPatients.length} Selected`
                      : `All ${filteredPatients.length} Patients`}
                  </b>
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Copy Numbers Button */}
                <button
                  type="button"
                  onClick={handleCopyPhoneNumbers}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-bold transition-colors cursor-pointer"
                  title="Copy telephone numbers to clipboard"
                >
                  {copiedNumbersNotice ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy Numbers</span>
                    </>
                  )}
                </button>

                {/* Send WhatsApp Broadcast Button */}
                {messageChannel === 'whatsapp' ? (
                  <button
                    type="button"
                    onClick={handleBroadcastNextWhatsApp}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {selectedPatients.length === 1
                        ? `Send WhatsApp to ${selectedPatients[0].name}`
                        : `Launch WhatsApp (${
                            (broadcastIndex % (selectedPatients.length || filteredPatients.length || 1)) + 1
                          }/${selectedPatients.length || filteredPatients.length})`}
                    </span>
                  </button>
                ) : (
                  /* Send SMS Broadcast Button */
                  <button
                    type="button"
                    onClick={handleBulkSms}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      Send SMS to {selectedPatients.length > 0 ? selectedPatients.length : filteredPatients.length} Patients
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Directory Search & Filter Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
              >
                {selectedIds.size === filteredPatients.length && filteredPatients.length > 0 ? (
                  <>
                    <CheckSquare className="w-4 h-4 text-cyan-400" />
                    <span>Deselect All</span>
                  </>
                ) : (
                  <>
                    <Square className="w-4 h-4 text-slate-400" />
                    <span>Select All ({filteredPatients.length})</span>
                  </>
                )}
              </button>

              {selectedIds.size > 0 && (
                <span className="text-xs font-bold text-cyan-300 bg-cyan-950/80 px-2.5 py-1 rounded-lg border border-cyan-800/80">
                  {selectedIds.size} Selected
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* Dedicated ID Sort Buttons */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-700/80">
                <button
                  type="button"
                  onClick={() => setSortBy('id-desc')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    sortBy === 'id-desc'
                      ? 'bg-cyan-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Sort by Patient ID: Newest Entry at Top (NPC/26/09/016 → NPC/26/09/001)"
                >
                  <span>↓</span>
                  <span className="font-mono text-[11px]">id-desc</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy('id-asec')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    sortBy === 'id-asec'
                      ? 'bg-cyan-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Sort by Patient ID: Oldest Entry at Top (NPC/26/09/001 → NPC/26/09/016)"
                >
                  <span>↑</span>
                  <span className="font-mono text-[11px]">id-asec</span>
                </button>
              </div>

              {/* Filter mode */}
              <select
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value as any)}
                className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-semibold text-slate-200 outline-none cursor-pointer"
              >
                <option value="withPhone">With Phone Only</option>
                <option value="active">Active Patients</option>
                <option value="all">All Patients</option>
              </select>

              {/* Search */}
              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, phone, ID..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Patients Contact List Table / Cards */}
          <div className="bg-slate-950/80 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900 text-[11px] font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3 pl-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === filteredPatients.length && filteredPatients.length > 0}
                        onChange={handleToggleSelectAll}
                        className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 cursor-pointer accent-cyan-500"
                      />
                    </th>
                    <th className="p-3 min-w-[140px]">Patient Details</th>
                    <th className="p-3 min-w-[120px]">Phone Number</th>
                    <th className="p-3 min-w-[120px]">Attending Physiotherapist</th>
                    <th className="p-3 min-w-[100px]">Consultation Date</th>
                    <th className="p-3 pr-4 text-right min-w-[200px]">1-Click Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-medium">
                  {filteredPatients.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500 text-xs">
                        No patient phone records match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredPatients.map((p) => {
                      const isSelected = selectedIds.has(p.id);
                      const hasPhone = !!(p.contact && p.contact.trim());
                      const regId = p.regNo || formatPatientId(p.date, p.serial);

                      return (
                        <tr
                          key={p.id}
                          className={`transition-colors ${
                            isSelected ? 'bg-cyan-950/40 text-cyan-100' : 'hover:bg-slate-900/60'
                          }`}
                        >
                          <td className="p-3 pl-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleTogglePatient(p.id)}
                              className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 cursor-pointer accent-cyan-500"
                            />
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-100">{p.name || 'Unnamed Patient'}</span>
                              {onEditPatient && (
                                <button
                                  type="button"
                                  onClick={() => onEditPatient(p)}
                                  className="p-1 rounded text-cyan-400 hover:text-cyan-200 hover:bg-cyan-950/60 transition-colors cursor-pointer"
                                  title="Edit patient name, phone number, and details"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            <div className="font-mono text-[10px] text-cyan-400">
                              ID: {regId} {p.age ? `• ${p.age} Yrs` : ''} {p.gender ? `• ${p.gender}` : ''}
                            </div>
                          </td>
                          <td className="p-3">
                            {hasPhone ? (
                              <a
                                href={`tel:${p.contact}`}
                                className="font-mono font-bold text-slate-200 hover:text-cyan-300 flex items-center gap-1.5"
                              >
                                <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                                <span>{p.contact}</span>
                              </a>
                            ) : (
                              <span className="text-slate-500 italic text-[11px]">No contact added</span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className="text-slate-300 font-semibold">{p.seenBy || 'R. Chandrashekar'}</span>
                          </td>
                          <td className="p-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                            {p.date || '—'}
                          </td>
                          <td className="p-3 pr-4 text-right">
                            {hasPhone ? (
                              <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                                {/* Send WhatsApp */}
                                <button
                                  type="button"
                                  onClick={() => handleSendWhatsAppSingle(p)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/80 text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap min-h-[28px]"
                                  title={`Send WhatsApp to ${p.name}`}
                                >
                                  <MessageSquare className="w-3 h-3 text-emerald-400" />
                                  <span>WhatsApp</span>
                                </button>

                                {/* Direct Call */}
                                <a
                                  href={`tel:${p.contact}`}
                                  className="px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/80 text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap min-h-[28px]"
                                  title={`Direct call to ${p.contact}`}
                                >
                                  <Phone className="w-3 h-3 text-cyan-400" />
                                  <span>Call</span>
                                </a>

                                {/* Copy Phone */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (p.contact) {
                                      navigator.clipboard.writeText(p.contact);
                                    }
                                  }}
                                  className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap min-h-[28px]"
                                  title={`Copy ${p.contact}`}
                                >
                                  <Copy className="w-3 h-3 text-slate-400" />
                                  <span>Copy</span>
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-500">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs text-slate-400">
            Showing <b className="text-cyan-400">{filteredPatients.length}</b> of {patients.length} total patient directory records
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
          >
            Close Directory
          </button>
        </div>
      </div>
    </div>
  );
};
