import React, { useState, useEffect } from 'react';
import { UserCheck, Plus, Minus, Trash2, Edit2, Phone, Mail, Award, CheckCircle2, AlertCircle } from 'lucide-react';
import { LocumPhysiotherapist } from '../types';
import { getLocumPhysiotherapists, saveLocumPhysiotherapists } from '../utils/storage';

interface LocumTenensManagerProps {
  onUpdate?: () => void;
}

export const LocumTenensManager: React.FC<LocumTenensManagerProps> = ({ onUpdate }) => {
  const [locums, setLocums] = useState<LocumPhysiotherapist[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [idType, setIdType] = useState<'IAP ID' | 'A&H Enrolment ID'>('IAP ID');
  const [idNumber, setIdNumber] = useState('');
  const [email, setEmail] = useState('');
  const [qualification, setQualification] = useState('BPT, MIAP');
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadList();
  }, []);

  const loadList = () => {
    const list = getLocumPhysiotherapists();
    setLocums(list);
  };

  const handleResetForm = () => {
    setName('');
    setPhone('');
    setIdType('IAP ID');
    setIdNumber('');
    setEmail('');
    setQualification('BPT, MIAP');
    setEditingId(null);
    setFormError('');
    setShowAddForm(false);
  };

  const handleEdit = (pt: LocumPhysiotherapist) => {
    setEditingId(pt.id);
    setName(pt.name);
    setPhone(pt.phone);
    setIdType(pt.idType);
    setIdNumber(pt.idNumber);
    setEmail(pt.email);
    setQualification(pt.qualification || 'BPT, MIAP');
    setShowAddForm(true);
    setFormError('');
  };

  const handleDelete = (id: string, ptName: string) => {
    if (id === 'locum-chief-consultant') {
      alert('The primary clinic consultant record cannot be deleted.');
      return;
    }
    if (window.confirm(`Are you sure you want to remove physiotherapist "${ptName}" from Locum Tenens?`)) {
      const updated = locums.filter((pt) => pt.id !== id);
      saveLocumPhysiotherapists(updated);
      setLocums(updated);
      onUpdate?.();
      setSuccessMessage(`Removed "${ptName}" successfully.`);
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Please enter the physiotherapist name.');
      return;
    }
    if (!phone.trim()) {
      setFormError('Please enter contact phone number.');
      return;
    }
    if (!idNumber.trim()) {
      setFormError(`Please enter the ${idType} registration/enrolment number.`);
      return;
    }

    setFormError('');

    if (editingId) {
      // Update existing
      const updated = locums.map((pt) => {
        if (pt.id === editingId) {
          return {
            ...pt,
            name: name.trim(),
            phone: phone.trim(),
            idType,
            idNumber: idNumber.trim(),
            email: email.trim(),
            qualification: qualification.trim(),
          };
        }
        return pt;
      });
      saveLocumPhysiotherapists(updated);
      setLocums(updated);
      setSuccessMessage(`Updated physiotherapist "${name.trim()}" successfully.`);
    } else {
      // Add new
      const newPt: LocumPhysiotherapist = {
        id: `locum_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: name.trim(),
        phone: phone.trim(),
        idType,
        idNumber: idNumber.trim(),
        email: email.trim(),
        qualification: qualification.trim(),
        status: 'Active',
        createdAt: new Date().toISOString().slice(0, 10),
      };
      const updated = [...locums, newPt];
      saveLocumPhysiotherapists(updated);
      setLocums(updated);
      setSuccessMessage(`Added "${newPt.name}" to Locum Tenens list.`);
    }

    onUpdate?.();
    handleResetForm();
    setTimeout(() => setSuccessMessage(''), 3500);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 bg-slate-50 text-slate-800">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Card */}
        <div className="bg-white p-5 rounded-3xl border border-sky-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-700 shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-sky-950 flex items-center gap-2">
                <span>Locum Tenens</span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                  {locums.length} Physiotherapists
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Register on-duty or locum physiotherapists. Once added, they will appear in the{' '}
                <b className="text-sky-800">"Seen by:"</b> dropdown in the Patient Demographics tab.
              </p>
            </div>
          </div>

          <button
            type="button"
            id="locum-toggle-add-btn"
            onClick={() => {
              if (showAddForm) {
                handleResetForm();
              } else {
                handleResetForm();
                setShowAddForm(true);
              }
            }}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0 self-start sm:self-auto ${
              showAddForm
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-200'
                : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-200'
            }`}
          >
            {showAddForm ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{showAddForm ? 'Close Form' : 'Add Physiotherapist'}</span>
          </button>
        </div>

        {/* Notifications */}
        {successMessage && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-xs font-bold text-emerald-800 shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Add / Edit Form Card */}
        {showAddForm && (
          <div className="bg-white p-5 sm:p-6 rounded-3xl border-2 border-sky-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-sky-50 pb-3">
              <h3 className="text-sm font-extrabold text-sky-950 flex items-center gap-2">
                <Award className="w-4 h-4 text-sky-600" />
                <span>{editingId ? 'Edit Physiotherapist Details' : 'Add New Locum Physiotherapist'}</span>
              </h3>
              <span className="text-[11px] text-slate-500 font-medium">All clinical credentials are strictly recorded</span>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                {/* Full Name */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Physiotherapist Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Dr. Kavya Sharma / R. Chandrashekar"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-1 focus:ring-sky-200 outline-none"
                  />
                </div>

                {/* Contact Phone */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Phone Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +91 98451 18788"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-1 focus:ring-sky-200 outline-none"
                  />
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="physio@example.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-1 focus:ring-sky-200 outline-none"
                  />
                </div>

                {/* ID Type: Choose between IAP ID or A&H Enrolment ID */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Registration ID Type <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setIdType('IAP ID')}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        idType === 'IAP ID'
                          ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      IAP ID
                    </button>
                    <button
                      type="button"
                      onClick={() => setIdType('A&H Enrolment ID')}
                      className={`px-2 py-2 rounded-xl text-[11px] font-bold transition-all border cursor-pointer truncate ${
                        idType === 'A&H Enrolment ID'
                          ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                      title="Allied and Healthcare Professionals Enrolment ID"
                    >
                      A&H Enrolment ID
                    </button>
                  </div>
                </div>

                {/* ID Number */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {idType} Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    placeholder={idType === 'IAP ID' ? 'e.g. MIAP-4421 / L-18920' : 'e.g. AHP-KAR-2024-0089'}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-1 focus:ring-sky-200 outline-none"
                  />
                </div>

                {/* Qualifications / Degree */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Qualification / Degrees
                  </label>
                  <input
                    type="text"
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    placeholder="e.g. BPT, MPT (Neuro), MIAP"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-1 focus:ring-sky-200 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-sky-50">
                <button
                  type="button"
                  id="locum-form-close-btn"
                  onClick={handleResetForm}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors cursor-pointer shadow-xs"
                >
                  <Minus className="w-3.5 h-3.5" />
                  <span>Close Form</span>
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white transition-colors cursor-pointer shadow-xs"
                >
                  {editingId ? 'Save Changes' : 'Save Physiotherapist'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Registered Physiotherapists List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
              Registered Duty Physiotherapists
            </h3>
            <span className="text-[11px] text-slate-400">
              Selectable in Patient Case Sheet & Demographics
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {locums.map((pt) => {
              const isChief = pt.id === 'locum-chief-consultant';
              return (
                <div
                  key={pt.id}
                  className="bg-white p-4 sm:p-5 rounded-3xl border border-sky-100 shadow-xs hover:border-sky-300 transition-all space-y-3 relative group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-extrabold text-sky-950 truncate">
                          {pt.name}
                        </h4>
                        {isChief && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-100 text-sky-800 border border-sky-200">
                            Chief Consultant
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {pt.idType}: {pt.idNumber}
                        </span>
                      </div>
                      {pt.qualification && (
                        <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                          {pt.qualification}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEdit(pt)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-sky-700 hover:bg-sky-50 transition-colors cursor-pointer"
                        title="Edit physiotherapist details"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {!isChief && (
                        <button
                          type="button"
                          onClick={() => handleDelete(pt.id, pt.name)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Remove from Locum Tenens"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                    <div className="flex items-center gap-1.5 truncate">
                      <Phone className="w-3 h-3 text-sky-600 shrink-0" />
                      <span className="font-semibold truncate">{pt.phone || 'No phone'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <Mail className="w-3 h-3 text-sky-600 shrink-0" />
                      <span className="truncate">{pt.email || 'No email'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
