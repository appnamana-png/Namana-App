import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Plus,
  UserPlus,
  RefreshCw,
  AlertCircle,
  Phone,
  Calendar,
  RotateCcw,
  CheckCircle2,
  Trash2,
  ArrowUpDown,
  ArrowDownAZ,
  X,
  ChevronLeft,
  CheckSquare,
  Square,
  AlertOctagon,
  Cloud,
  Download,
  Clock,
  Mic,
  Sparkles,
  Edit3,
} from 'lucide-react';
import { Patient, SearchFilter } from '../types';
import { deduplicatePatients, formatPatientId } from '../utils/storage';
import { generatePdfCaseSheet } from '../utils/pdfCaseSheet';
import { PermanentDeleteModal } from './PermanentDeleteModal';
import { PatientPhoneDirectoryModal } from './PatientPhoneDirectoryModal';

export type PatientSortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc';

interface PatientDirectoryProps {
  patients: Patient[];
  activePatientId: string | null;
  onSelectPatient: (id: string) => void;
  onAddNewPatient: () => void;
  searchFilter: SearchFilter;
  onUpdateSearchFilter?: (filter: SearchFilter) => void;
  onRestorePatient?: (id: string) => void;
  onDeletePatient?: (id: string) => void;
  onDeletePatients?: (ids: string[]) => void;
  onRestorePatients?: (ids: string[]) => void;
  onPermanentDeletePatients?: (ids: string[]) => void;
  onOpenSearchModal: () => void;
  onOpenBackup?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  onCloseDirectory?: () => void;
  onVoiceEditPatient?: (id: string) => void;
  onEditPatient?: (patient: Patient) => void;
  onOpenFollowUpManager?: () => void;
  onOpenVoiceCommand?: () => void;
}

export const PatientDirectory: React.FC<PatientDirectoryProps> = ({
  patients,
  activePatientId,
  onSelectPatient,
  onAddNewPatient,
  searchFilter,
  onUpdateSearchFilter,
  onRestorePatient,
  onDeletePatient,
  onDeletePatients,
  onRestorePatients,
  onPermanentDeletePatients,
  onOpenSearchModal,
  onOpenBackup,
  isMobileOpen,
  onCloseMobile,
  onCloseDirectory,
  onVoiceEditPatient,
  onEditPatient,
  onOpenFollowUpManager,
  onOpenVoiceCommand,
}) => {
  const currentStatus = searchFilter.status || 'active';
  const [sortBy, setSortBy] = useState<PatientSortOption>('date-desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showPermanentDeleteModal, setShowPermanentDeleteModal] = useState(false);
  const [isPhoneDirectoryOpen, setIsPhoneDirectoryOpen] = useState(false);

  // Distinct patients guaranteeing unique Patient IDs across all calculations
  const distinctPatients = useMemo(() => {
    return deduplicatePatients(patients);
  }, [patients]);

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Compute scheduled follow-ups across active patients
  const { todayFollowUpsCount, upcomingFollowUpsCount } = useMemo(() => {
    let todayCount = 0;
    let upcomingCount = 0;
    distinctPatients.forEach((p) => {
      if (p.deleted) return;
      (p.followUps || []).forEach((fu) => {
        if (!fu.date) return;
        if (fu.date === todayISO) {
          todayCount++;
        } else if (fu.date > todayISO) {
          upcomingCount++;
        }
      });
    });
    return { todayFollowUpsCount: todayCount, upcomingFollowUpsCount: upcomingCount };
  }, [distinctPatients, todayISO]);

  // Total, Active, Deleted counts
  const totalCount = distinctPatients.length;
  const activeCount = distinctPatients.filter((p) => !p.deleted).length;
  const deletedCount = distinctPatients.filter((p) => p.deleted).length;

  // Filter patients based on search query, field, status, and visit type
  const filteredPatients = useMemo(() => {
    const q = searchFilter.query.trim().toLowerCase();
    const status = searchFilter.status || 'active';
    const visitType = searchFilter.visitType || 'all';

    return distinctPatients.filter((p) => {
      // Status filter: 'all' shows everything; 'active' shows non-deleted; 'deleted' shows only deleted
      if (status === 'active' && p.deleted) return false;
      if (status === 'deleted' && !p.deleted) return false;

      // Visit type filter
      if (visitType !== 'all' && p.visitType !== visitType) return false;

      // Query filter
      if (!q) return true;

      const f = searchFilter.field;
      if (f === 'name') return (p.name || '').toLowerCase().includes(q);
      if (f === 'serial') return String(p.serial || '').includes(q) || (p.regNo || '').toLowerCase().includes(q);
      if (f === 'contact') return (p.contact || '').toLowerCase().includes(q);
      if (f === 'diagnosis') return (p.diagnosis || '').toLowerCase().includes(q);
      if (f === 'referredBy') return (p.referredBy || '').toLowerCase().includes(q);

      // 'all' field search
      return (
        (p.name || '').toLowerCase().includes(q) ||
        String(p.serial || '').includes(q) ||
        (p.regNo || '').toLowerCase().includes(q) ||
        (p.contact || '').toLowerCase().includes(q) ||
        (p.diagnosis || '').toLowerCase().includes(q) ||
        (p.address || '').toLowerCase().includes(q)
      );
    });
  }, [distinctPatients, searchFilter]);

  // Sort patients through name and date across all three categories
  const sortedPatients = useMemo(() => {
    const list = [...filteredPatients];
    list.sort((a, b) => {
      if (sortBy === 'name-asc') {
        const res = (a.name || '').localeCompare(b.name || '');
        if (res !== 0) return res;
        return (a.serial || 0) - (b.serial || 0);
      }
      if (sortBy === 'name-desc') {
        const res = (b.name || '').localeCompare(a.name || '');
        if (res !== 0) return res;
        return (b.serial || 0) - (a.serial || 0);
      }
      if (sortBy === 'date-asc') {
        const res = (a.date || '').localeCompare(b.date || '');
        if (res !== 0) return res;
        return (a.serial || 0) - (b.serial || 0);
      }
      // date-desc (default)
      const res = (b.date || '').localeCompare(a.date || '');
      if (res !== 0) return res;
      return (b.serial || 0) - (a.serial || 0);
    });
    return list;
  }, [filteredPatients, sortBy]);

  // Multi-selection helper methods
  const toggleSelectPatient = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isAllSelected =
    sortedPatients.length > 0 && sortedPatients.every((p) => selectedIds.has(p.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      // Deselect all currently sorted
      setSelectedIds((prev) => {
        const next = new Set(prev);
        sortedPatients.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      // Select all currently sorted
      setSelectedIds((prev) => {
        const next = new Set(prev);
        sortedPatients.forEach((p) => next.add(p.id));
        return next;
      });
    }
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (onDeletePatients) {
      onDeletePatients(ids);
    } else if (onDeletePatient) {
      ids.forEach((id) => onDeletePatient(id));
    }
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  const handleBulkRestore = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (onRestorePatients) {
      onRestorePatients(ids);
    } else if (onRestorePatient) {
      ids.forEach((id) => onRestorePatient(id));
    }
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  const handleConfirmPermanentDelete = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (onPermanentDeletePatients) {
      onPermanentDeletePatients(ids);
    }
    setSelectedIds(new Set());
    setShowPermanentDeleteModal(false);
    setIsSelectionMode(false);
  };

  // Handle switching status between 'all' (Total), 'active', and 'deleted'
  const handleStatusChange = (newStatus: 'all' | 'active' | 'deleted') => {
    setSelectedIds(new Set());
    if (onUpdateSearchFilter) {
      onUpdateSearchFilter({
        ...searchFilter,
        status: newStatus,
      });
    }

    // Auto-select the first patient matching the new status filter
    const matching = patients.filter((p) => {
      if (newStatus === 'active') return !p.deleted;
      if (newStatus === 'deleted') return p.deleted;
      return true;
    });

    if (matching.length > 0) {
      const isCurrentInList = matching.some((p) => p.id === activePatientId);
      if (!isCurrentInList) {
        onSelectPatient(matching[0].id);
      }
    }
  };

  const closeHandler = onCloseDirectory || onCloseMobile;

  return (
    <aside className="w-full md:w-80 lg:w-96 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 h-full select-none z-10 text-slate-800 shadow-sm md:shadow-none overflow-hidden">
      {/* Directory Top Header */}
      <div className="p-3 sm:p-3.5 border-b border-slate-200 space-y-2 bg-white">
        {/* Line 1: Patient Directory Title + Close Button when active */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-900 whitespace-nowrap truncate">
              Patient Directory
            </h2>
            <span className="text-[11px] font-mono font-medium text-slate-400 tabular-nums">
              ({sortedPatients.length})
            </span>
          </div>

          {/* Close Directory Button - Clean & subtle */}
          {closeHandler && (isMobileOpen === undefined || isMobileOpen === true) && (
            <button
              type="button"
              id="close-directory-btn"
              onClick={closeHandler}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              title="Close Directory"
              aria-label="Close Directory"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Row 1: Primary Add Patient CTA + Search Input */}
        <div className="flex items-center gap-1.5">
          {/* Add Patient Primary Button */}
          <button
            id="add-patient-btn"
            onClick={onAddNewPatient}
            className="py-1.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center text-center gap-1.5 shrink-0"
            title="Add Patient"
          >
            <UserPlus className="w-3.5 h-3.5 shrink-0" />
            <span>Add Patient</span>
          </button>

          {/* Integrated Search Input */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              id="directory-search-input"
              value={searchFilter.query}
              onChange={(e) => {
                if (onUpdateSearchFilter) {
                  onUpdateSearchFilter({ ...searchFilter, query: e.target.value });
                }
              }}
              onClick={onOpenSearchModal}
              placeholder="Search patients..."
              className="w-full pl-7 pr-6 py-1.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl text-xs text-slate-900 placeholder-slate-400 cursor-pointer transition-colors shadow-2xs truncate outline-none"
              title="Search & Filter Patients"
            />
            {onOpenSearchModal && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSearchModal();
                }}
                className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-xs transition-colors cursor-pointer ${
                  searchFilter.query || searchFilter.field !== 'all' || searchFilter.status === 'deleted'
                    ? 'text-sky-600'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Search & Filter options"
              >
                <Filter className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Secondary Utilities - Cohesive Neutral Palette (Follow-up, Phone, Select) */}
        <div className="grid grid-cols-3 gap-1.5">
          {/* Follow-Up Schedule Button */}
          <button
            type="button"
            id="directory-followup-schedule-btn"
            onClick={onOpenFollowUpManager}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl border text-xs font-semibold shadow-2xs transition-colors cursor-pointer ${
              todayFollowUpsCount > 0
                ? 'bg-amber-50/80 hover:bg-amber-100/90 text-amber-900 border-amber-200'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/90'
            }`}
            title="Follow-Up Schedule Manager • View today and upcoming patient sessions"
          >
            <Clock className={`w-3.5 h-3.5 shrink-0 ${todayFollowUpsCount > 0 ? 'text-amber-600' : 'text-slate-500'}`} />
            <span className="truncate">Follow-up</span>
            {todayFollowUpsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[9.5px] font-bold font-mono shrink-0">
                {todayFollowUpsCount}
              </span>
            )}
          </button>

          {/* Patient Phone Directory Button */}
          <button
            type="button"
            id="directory-phone-btn"
            onClick={() => setIsPhoneDirectoryOpen(true)}
            className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/90 text-xs font-semibold shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
            title="Open Patient Phone Directory & WhatsApp/SMS Broadcaster"
          >
            <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="truncate">Phone</span>
          </button>

          {/* Select Multiple Patients Button */}
          <button
            type="button"
            id="toggle-select-mode-btn"
            onClick={() => {
              const nextMode = !isSelectionMode;
              setIsSelectionMode(nextMode);
              if (!nextMode) {
                setSelectedIds(new Set());
              }
            }}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer whitespace-nowrap border ${
              isSelectionMode || selectedIds.size > 0
                ? 'bg-sky-50 hover:bg-sky-100 text-sky-800 border-sky-300 font-bold'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/90'
            }`}
            title={isSelectionMode ? "Exit Selection Mode" : "Select Multiple Patients / Select All"}
          >
            <CheckSquare className={`w-3.5 h-3.5 shrink-0 ${isSelectionMode || selectedIds.size > 0 ? 'text-sky-600' : 'text-slate-500'}`} />
            <span className="truncate">{isSelectionMode ? "Cancel" : "Select"}</span>
          </button>
        </div>

        {/* Categories Tabs: All (Navy/Sky), Active (Emerald), Trash (Rose) */}
        <div
          id="patient-directory-metrics"
          className="flex items-center p-1 bg-slate-100 rounded-xl gap-1 text-xs"
          role="tablist"
          aria-label="Filter patient records by category"
        >
          {/* All / Total Tab */}
          <button
            type="button"
            id="tab-status-total"
            onClick={() => handleStatusChange('all')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center gap-1 font-bold ${
              currentStatus === 'all'
                ? 'bg-sky-900 text-white shadow-xs'
                : 'text-slate-700 hover:text-sky-950 hover:bg-sky-50'
            }`}
            title="Access all patient records (Active & Deleted)"
          >
            <span>All</span>
            <span className="text-[11px] font-mono opacity-90 tabular-nums">({totalCount})</span>
          </button>

          {/* Active Tab */}
          <button
            type="button"
            id="tab-status-active"
            onClick={() => handleStatusChange('active')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center gap-1 font-bold ${
              currentStatus === 'active'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-800 hover:text-emerald-950 hover:bg-emerald-50'
            }`}
            title="Access active patient records"
          >
            <span>Active</span>
            <span className="text-[11px] font-mono opacity-90 tabular-nums">({activeCount})</span>
          </button>

          {/* Deleted / Trash Tab */}
          <button
            type="button"
            id="tab-status-deleted"
            onClick={() => handleStatusChange('deleted')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center gap-1 font-bold ${
              currentStatus === 'deleted'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-700 hover:text-rose-950 hover:bg-rose-50'
            }`}
            title="Access deleted / trash patient records"
          >
            <span>Trash</span>
            <span className="text-[11px] font-mono opacity-90 tabular-nums">({deletedCount})</span>
          </button>
        </div>

        {/* Multi-Selection Sticky Action Bar */}
        {(isSelectionMode || selectedIds.size > 0) && (
          <div className="p-2.5 bg-slate-900 text-white rounded-2xl shadow-md space-y-2 border border-slate-700 animate-fade-in">
            <div className="flex items-center justify-between gap-2 text-xs">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 font-bold hover:text-sky-300 transition-colors cursor-pointer"
              >
                {isAllSelected ? (
                  <CheckSquare className="w-4 h-4 text-sky-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>Select All ({sortedPatients.length})</span>
              </button>

              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-sky-300 border border-slate-700">
                {selectedIds.size} selected
              </span>
            </div>

            {/* Action buttons depending on active status */}
            <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
              {currentStatus !== 'deleted' ? (
                <button
                  type="button"
                  disabled={selectedIds.size === 0}
                  onClick={handleBulkDelete}
                  className="flex-1 py-1.5 px-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected ({selectedIds.size})</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={selectedIds.size === 0}
                    onClick={handleBulkRestore}
                    className="flex-1 py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:cursor-not-allowed shadow-xs whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore ({selectedIds.size})</span>
                  </button>

                  <button
                    type="button"
                    disabled={selectedIds.size === 0}
                    onClick={() => setShowPermanentDeleteModal(true)}
                    className="flex-1 py-1.5 px-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:cursor-not-allowed shadow-xs whitespace-nowrap"
                    title="Permanently Delete Selected Records with Passkey"
                  >
                    <AlertOctagon className="w-3.5 h-3.5" />
                    <span>Delete Perm. ({selectedIds.size})</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Manage Trash Records banner when viewing Deleted tab without selection active */}
        {currentStatus === 'deleted' && !isSelectionMode && selectedIds.size === 0 && sortedPatients.length > 0 && (
          <div className="flex items-center justify-between p-2 rounded-xl bg-rose-50 border border-rose-200 text-xs">
            <span className="text-rose-900 font-semibold text-[11px]">Trash records actions:</span>
            <button
              type="button"
              onClick={() => setIsSelectionMode(true)}
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold shadow-2xs flex items-center gap-1 cursor-pointer"
            >
              <CheckSquare className="w-3 h-3" />
              <span>Select Multiple / All</span>
            </button>
          </div>
        )}

        {/* Sort Bar - Clean & Uncluttered for Date and Name */}
        <div className="flex items-center justify-between text-xs pt-0.5">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
            <ArrowUpDown className="w-3 h-3 text-slate-400" />
            <span>Sort</span>
          </span>

          <div className="flex items-center gap-1 shrink-0">
            {/* Sort by Date Toggle */}
            <button
              type="button"
              onClick={() => setSortBy(sortBy === 'date-desc' ? 'date-asc' : 'date-desc')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer border ${
                sortBy.startsWith('date')
                  ? 'bg-slate-100 text-slate-900 border-slate-300 font-bold'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
              title={`Sort by Date (${sortBy === 'date-desc' ? 'Newest First' : 'Oldest First'})`}
            >
              <Calendar className="w-3 h-3 text-slate-500" />
              <span>Date {sortBy === 'date-desc' ? '↓' : sortBy === 'date-asc' ? '↑' : ''}</span>
            </button>

            {/* Sort by Name Toggle */}
            <button
              type="button"
              onClick={() => setSortBy(sortBy === 'name-asc' ? 'name-desc' : 'name-asc')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer border ${
                sortBy.startsWith('name')
                  ? 'bg-slate-100 text-slate-900 border-slate-300 font-bold'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
              title={`Sort by Patient Name (${sortBy === 'name-asc' ? 'A to Z' : 'Z to A'})`}
            >
              <ArrowDownAZ className="w-3 h-3 text-slate-500" />
              <span>Name {sortBy === 'name-asc' ? 'A-Z' : sortBy === 'name-desc' ? 'Z-A' : ''}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Patients Scrollable List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 min-h-0">
        {sortedPatients.length === 0 ? (
          <div className="p-6 text-center text-slate-500 space-y-3">
            <AlertCircle className="w-8 h-8 mx-auto text-slate-400" />
            <p className="text-xs font-bold text-slate-700">
              {currentStatus === 'deleted'
                ? 'No deleted records in trash'
                : currentStatus === 'active'
                ? 'No active patient records found'
                : 'No patient records found'}
            </p>
            <p className="text-[11px] text-slate-500 max-w-[220px] mx-auto">
              {currentStatus === 'deleted'
                ? 'Deleted records will appear here and can be reviewed or restored.'
                : 'Register a new patient chart to populate the directory.'}
            </p>
            <div className="flex flex-col gap-2 pt-2">
              {currentStatus === 'deleted' ? (
                <button
                  onClick={() => handleStatusChange('active')}
                  className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>View Active Patients ({activeCount})</span>
                </button>
              ) : (
                <button
                  onClick={onAddNewPatient}
                  className="w-full py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Register New Patient</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          sortedPatients.map((patient) => {
            const isSelected = patient.id === activePatientId;
            const isDeleted = !!patient.deleted;
            const isChecked = selectedIds.has(patient.id);

            return (
              <div
                key={patient.id}
                onClick={() => {
                  if (isSelectionMode || selectedIds.size > 0) {
                    toggleSelectPatient(patient.id);
                  } else {
                    onSelectPatient(patient.id);
                    if (onCloseMobile) {
                      onCloseMobile();
                    }
                  }
                }}
                className={`p-3 sm:p-3.5 cursor-pointer transition-all border-l-4 relative group ${
                  isChecked
                    ? isDeleted
                      ? 'bg-rose-100/80 border-l-rose-600 ring-1 ring-rose-400 shadow-2xs'
                      : 'bg-sky-100/80 border-l-sky-600 ring-1 ring-sky-400 shadow-2xs'
                    : isSelected
                    ? isDeleted
                      ? 'bg-rose-50/90 border-l-rose-500 shadow-2xs'
                      : 'bg-sky-50/90 border-l-sky-600 shadow-2xs'
                    : isDeleted
                    ? 'bg-rose-50/40 border-l-rose-300 hover:bg-rose-50/70'
                    : 'bg-white border-l-transparent hover:bg-sky-50/40'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {/* Selection Checkbox */}
                  {(isSelectionMode || selectedIds.size > 0) && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectPatient(patient.id);
                      }}
                      className="pt-0.5 shrink-0"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                      />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      {/* Name, Reg No, Demographics */}
                      <div className="min-w-0 flex-1">
                        {/* Patient Name & Patient ID - Appears next to name; wraps to next line if name is long */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-sm text-sky-950 group-hover:text-sky-700">
                            {patient.name || 'Unnamed Patient'}
                          </span>
                          {!isDeleted && onEditPatient && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditPatient(patient);
                              }}
                              className="px-1.5 py-0.5 rounded-lg text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors cursor-pointer shrink-0 inline-flex items-center gap-1 text-[10px] font-bold"
                              title={`Edit ${patient.name || 'patient'}'s details & phone number`}
                              aria-label="Edit patient details"
                            >
                              <Edit3 className="w-2.5 h-2.5 text-sky-600" />
                              <span>Edit</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              generatePdfCaseSheet(patient);
                            }}
                            className="font-mono font-bold text-sky-800 hover:text-sky-950 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-1.5 py-0.5 rounded text-[10px] inline-flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                            title="Download Complete Case Sheet PDF for this patient"
                          >
                            <Download className="w-2.5 h-2.5 text-sky-600 shrink-0" />
                            <span>ID: {patient.regNo || formatPatientId(patient.date, patient.serial)}</span>
                          </button>
                          {isDeleted && (
                            <span className="px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[9.5px] font-extrabold border border-rose-200 shrink-0">
                              DELETED
                            </span>
                          )}
                        </div>

                        {/* Demographics & Visit Type */}
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                          {patient.age && <span>{patient.age}y</span>}
                          {patient.sex && <span>• {patient.sex}</span>}
                          {patient.visitType && (
                            <span
                              className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded ${
                                patient.visitType === 'Home Visit'
                                  ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                  : 'bg-sky-100 text-sky-900 border border-sky-200'
                              }`}
                            >
                              {patient.visitType}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Date & Follow-up count */}
                      <div className="text-right text-[10px] text-slate-400 shrink-0 font-mono">
                        <div>{patient.date || '—'}</div>
                        {patient.followUps && patient.followUps.length > 0 && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[9.5px]">
                            +{patient.followUps.length} follow-up
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Clinical Diagnosis Snippet */}
                    {patient.diagnosis && (
                      <p className="text-[11px] text-slate-600 mt-1 line-clamp-1 italic">
                        {patient.diagnosis}
                      </p>
                    )}

                    {/* Contact phone snippet & action pills */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5">
                      <div className="flex items-center gap-1 truncate text-slate-500">
                        {patient.contact ? (
                          <>
                            <Phone className="w-3 h-3 text-sky-600 shrink-0" />
                            <span className="truncate">{patient.contact}</span>
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">No phone logged</span>
                        )}
                      </div>

                      {/* Deleted Patient Restore Option right on list card */}
                      {isDeleted && onRestorePatient && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRestorePatient(patient.id);
                          }}
                          className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                          title="Restore patient to active status"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restore</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Permanent Deletion Caution Passkey Modal */}
      <PermanentDeleteModal
        isOpen={showPermanentDeleteModal}
        count={selectedIds.size}
        patientNames={distinctPatients
          .filter((p) => selectedIds.has(p.id))
          .map((p) => `${p.name || 'Unnamed'} (Patient ID: ${p.regNo || formatPatientId(p.date, p.serial)})`)}
        onSuccess={handleConfirmPermanentDelete}
        onClose={() => setShowPermanentDeleteModal(false)}
      />

      {/* Patient Phone Directory & WhatsApp/SMS Broadcaster Modal */}
      <PatientPhoneDirectoryModal
        isOpen={isPhoneDirectoryOpen}
        onClose={() => setIsPhoneDirectoryOpen(false)}
        patients={patients}
        onEditPatient={onEditPatient}
      />

      {/* Directory Footer (Total/Active/Deleted counters removed per instructions) */}
      <div className="p-2.5 border-t border-sky-100 bg-sky-50/50 flex items-center justify-between text-[11px] px-3 font-semibold text-slate-600">
        <div className="text-[10.5px] text-slate-500 truncate">
          {sortedPatients.length} of {patients.length} records in directory
        </div>

        {deletedCount > 0 && currentStatus !== 'deleted' && (
          <button
            type="button"
            onClick={() => handleStatusChange('deleted')}
            className="text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 cursor-pointer text-[10px] bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200"
          >
            <Trash2 className="w-3 h-3" />
            <span>Trash ({deletedCount})</span>
          </button>
        )}
      </div>
    </aside>
  );
};
