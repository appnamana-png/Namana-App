import React, { useState } from 'react';
import { Search, X, Check, Filter } from 'lucide-react';
import { SearchFilter } from '../types';

interface SearchFilterModalProps {
  filter: SearchFilter;
  onApply: (filter: SearchFilter) => void;
  onClose: () => void;
}

export const SearchFilterModal: React.FC<SearchFilterModalProps> = ({ filter, onApply, onClose }) => {
  const [localFilter, setLocalFilter] = useState<SearchFilter>({ ...filter });

  const handleReset = () => {
    const resetVal: SearchFilter = {
      field: 'all',
      query: '',
      status: 'active',
      visitType: 'all',
    };
    setLocalFilter(resetVal);
    onApply(resetVal);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onApply(localFilter);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-sky-100 overflow-hidden text-slate-800">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-sky-100 flex items-center justify-between bg-sky-50/60">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-sky-600" />
            <h3 className="text-sm font-bold text-sky-950">Search & Filter Records</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Query input */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
              Search Keywords
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={localFilter.query}
                onChange={(e) => setLocalFilter({ ...localFilter, query: e.target.value })}
                placeholder="Search patient name, reg no, phone, diagnosis..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-200 outline-none transition-all shadow-2xs"
                autoFocus
              />
            </div>
          </div>

          {/* Search field selector */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
              Search Within Field
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { id: 'all', label: 'All Fields' },
                { id: 'name', label: 'Patient Name' },
                { id: 'serial', label: 'Reg No / Serial' },
                { id: 'diagnosis', label: 'Diagnosis' },
                { id: 'contact', label: 'Contact Phone' },
                { id: 'referredBy', label: 'Referring Doctor' },
              ].map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setLocalFilter({ ...localFilter, field: item.id as any })}
                  className={`px-3 py-2 rounded-xl text-left font-medium transition-colors border cursor-pointer ${
                    localFilter.field === item.id
                      ? 'bg-sky-50 border-sky-400 text-sky-950 font-bold shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Record Status Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
              Record Status
            </label>
            <div className="flex items-center gap-2">
              {[
                { id: 'all', label: 'All Records' },
                { id: 'active', label: 'Active Directory' },
                { id: 'deleted', label: 'Trash / Deleted' },
              ].map((st) => (
                <button
                  type="button"
                  key={st.id}
                  onClick={() => setLocalFilter({ ...localFilter, status: st.id as any })}
                  className={`flex-1 py-1.5 text-xs rounded-xl border text-center font-medium transition-colors cursor-pointer ${
                    (localFilter.status || 'active') === st.id
                      ? 'bg-sky-600 border-sky-600 text-white font-bold shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Visit Type Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
              Visit Type
            </label>
            <div className="flex items-center gap-2">
              {[
                { id: 'all', label: 'All Modes' },
                { id: 'Clinic', label: 'Clinic Visit' },
                { id: 'Home Visit', label: 'Home Visit' },
              ].map((vt) => (
                <button
                  type="button"
                  key={vt.id}
                  onClick={() => setLocalFilter({ ...localFilter, visitType: vt.id as any })}
                  className={`flex-1 py-1.5 text-xs rounded-xl border text-center font-medium transition-colors cursor-pointer ${
                    (localFilter.visitType || 'all') === vt.id
                      ? 'bg-sky-600 border-sky-600 text-white font-bold shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {vt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Apply</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
