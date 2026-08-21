'use client';

import { useModalA11y } from '@/hooks/useModalA11y';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { Check, Eye, Filter, Phone } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  selectActivityPage, selectAdvancedFilters, selectPagedRows, selectPageSize,
  selectTableStatusFilters, selectTableTypeFilters,
  setActivityPage,
  setAdvancedFilters, setPageSize,
  setTableStatusFilters,
  setTableTypeFilters
} from '../store/loanDashboardSlice';
import LoanEmptyState from './LoanEmptyState';

export interface LoanTableRow {
  id: string;
  applicant: string;
  initials?: string;
  productName?: string;
  phone: string;
  loanAmount: string;
  amount?: string;
  type: string;
  status: string;
  statusTone: string;
  updated: string;
  action: string;
  timestamp: number;
  application_id?: string;
  creation?: string;
  region?: string;
  loanTerm?: string;
}

interface LoanTableProps {
  onView?: (row: LoanTableRow) => void;
  totalCount?: number;
}

const RANGE_STEPS = [
  { label: '0 - 25,000', value: '0-25000', min: 0, max: 25000, display: 'ETB 25000' },
  { label: '25,001 - 50,000', value: '25001-50000', min: 25001, max: 50000, display: 'ETB 50000' },
  { label: '50,001 - 1,00,000', value: '50001-100000', min: 50001, max: 100000, display: 'ETB 100000' },
  { label: '1,00,000 and above', value: '100000+', min: 100001, max: 10000000, display: 'ETB 350000' },
  { label: 'All Amounts', value: '', min: null, max: null, display: 'All Amounts' },
] as const;

const LoanTable = memo(({ onView, totalCount = 0 }: LoanTableProps) => {
  const dispatch = useAppDispatch();
  const rows: LoanTableRow[] = useAppSelector(selectPagedRows);


  const selectedStatuses = useAppSelector(selectTableStatusFilters);
  const selectedLoanTypes = useAppSelector(selectTableTypeFilters);
  const currentAdvancedFilters = useAppSelector(selectAdvancedFilters);

  const currentPage = useAppSelector(selectActivityPage);
  const pageSize = useAppSelector(selectPageSize);


  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [loanTypeFilterOpen, setLoanTypeFilterOpen] = useState(false);
  const [amountFilterOpen, setAmountFilterOpen] = useState(false);
  const [dateFilterOpen, setDateFilterOpen] = useState(false);

  const [localStatuses, setLocalStatuses] = useState<string[]>([]);
  const [localLoanTypes, setLocalLoanTypes] = useState<string[]>([]);
  const [tempAmountIndex, setTempAmountIndex] = useState<number>(4);
  const [tempQuickDate, setTempQuickDate] = useState<string>('');
  const [tempDateFrom, setTempDateFrom] = useState<string>(currentAdvancedFilters.dateFrom || '');
  const [tempDateTo, setTempDateTo] = useState<string>(currentAdvancedFilters.dateTo || '');

  const statusRef = useRef<HTMLButtonElement>(null);
  const loanTypeRef = useRef<HTMLButtonElement>(null);
  const amountRef = useRef<HTMLButtonElement>(null);
  const dateRef = useRef<HTMLButtonElement>(null);

  const statusDialogRef = useModalA11y<HTMLDivElement>(statusFilterOpen, () => setStatusFilterOpen(false));
  const loanTypeDialogRef = useModalA11y<HTMLDivElement>(loanTypeFilterOpen, () => setLoanTypeFilterOpen(false));
  const amountDialogRef = useModalA11y<HTMLDivElement>(amountFilterOpen, () => setAmountFilterOpen(false));
  const dateDialogRef = useModalA11y<HTMLDivElement>(dateFilterOpen, () => setDateFilterOpen(false));

  useEffect(() => {
    if (statusFilterOpen) setLocalStatuses(selectedStatuses);
  }, [statusFilterOpen, selectedStatuses]);

  useEffect(() => {
    if (loanTypeFilterOpen) setLocalLoanTypes(selectedLoanTypes);
  }, [loanTypeFilterOpen, selectedLoanTypes]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if ((target as Element).closest?.('.loan-filter-popup')) return;
      if (statusRef.current && !statusRef.current.contains(target)) setStatusFilterOpen(false);
      if (loanTypeRef.current && !loanTypeRef.current.contains(target)) setLoanTypeFilterOpen(false);
      if (amountRef.current && !amountRef.current.contains(target)) setAmountFilterOpen(false);
      if (dateRef.current && !dateRef.current.contains(target)) setDateFilterOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleLocalStatus = (val: string) =>
    setLocalStatuses(prev => prev.includes(val) ? prev.filter(s => s !== val) : [...prev, val]);

  const toggleLocalLoanType = (val: string) =>
    setLocalLoanTypes(prev => prev.includes(val) ? prev.filter(s => s !== val) : [...prev, val]);

  const handleApplyStatus = () => { dispatch(setTableStatusFilters(localStatuses)); setStatusFilterOpen(false); };
  const handleApplyLoanType = () => { dispatch(setTableTypeFilters(localLoanTypes)); setLoanTypeFilterOpen(false); };

  const handleApplyAmount = (idx: number) => {
    setTempAmountIndex(idx);
    const range = RANGE_STEPS[idx];
    dispatch(setAdvancedFilters({
      ...currentAdvancedFilters,
      minLoan: range ? range.min : null,
      maxLoan: range ? range.max : null,
    }));
    setAmountFilterOpen(false);
  };

  const handleApplyDate = () => {
    dispatch(setAdvancedFilters({
      ...currentAdvancedFilters,
      dateFrom: tempDateFrom,
      dateTo: tempDateTo,
    }));
    setDateFilterOpen(false);
  };

  const hasFilters = selectedStatuses.length > 0 || selectedLoanTypes.length > 0 || currentAdvancedFilters.minLoan !== null || Boolean(currentAdvancedFilters.dateFrom);
  const handleClearFilters = () => {
    dispatch(setTableStatusFilters([]));
    dispatch(setTableTypeFilters([]));
    setLocalStatuses([]);
    setLocalLoanTypes([]);
    setTempAmountIndex(4);
    setTempDateFrom('');
    setTempDateTo('');
    setTempQuickDate('');
  };

  const effectiveTotal = totalCount || rows.length;
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / pageSize));

  return (
    <div className="flex flex-col min-h-[400px]">
      <div className="overflow-x-auto flex-1">
        <table className="w-full border-collapse text-left text-base text-gray-500 whitespace-nowrap">
          <thead className="bg-[#fafafa] text-[13px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 font-semibold">Application ID</th>
              <th className="px-6 py-4 font-semibold">Phone Number</th>

              {/* Status */}
              <th className="px-6 py-4 font-semibold">
                <div className="relative inline-flex items-center gap-2">
                  <span>Status</span>
                  <button
                    ref={statusRef}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setStatusFilterOpen(!statusFilterOpen); }}
                    className={`p-1 rounded transition hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 ${statusFilterOpen || selectedStatuses.length > 0 ? 'text-emerald-600' : 'text-gray-400'}`}
                  >
                    <Filter size={15} strokeWidth={2} />
                  </button>
                  {statusFilterOpen && typeof document !== 'undefined' && createPortal(
                    <div
                      ref={statusDialogRef}
                      role="dialog"
                      aria-modal="true"
                      aria-label="Status filter"
                      tabIndex={-1}
                      className="loan-filter-popup fixed z-[9999] w-64 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 normal-case font-normal text-sm text-gray-800"
                      style={{
                        top: (statusRef.current?.getBoundingClientRect().bottom ?? 0) + 8,
                        left: Math.max(16, statusRef.current?.getBoundingClientRect().left ?? 0),
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="px-4 py-2 font-semibold text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100">
                        Status Filter
                      </div>
                      <div className="max-h-60 overflow-y-auto py-1">
                        {['All', 'In Underwriting', 'Review', 'Approved', 'Pending', 'Rejected'].map((opt) => {
                          const isAll = opt === 'All';
                          const isChecked = isAll ? localStatuses.length === 0 : localStatuses.includes(opt);
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => {
                                if (isAll) {
                                  setLocalStatuses([]);
                                } else {
                                  toggleLocalStatus(opt);
                                }
                              }}
                              className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer text-gray-700 text-left focus:outline-none focus-visible:bg-gray-50"
                            >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isChecked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-gray-300'}`}>
                                {isChecked && <Check size={12} strokeWidth={3} />}
                              </div>
                              <span className="text-sm font-medium">{opt}</span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="p-3 border-t border-gray-100 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => { setLocalStatuses([]); dispatch(setTableStatusFilters([])); setStatusFilterOpen(false); }}
                          className="text-xs font-semibold text-gray-500 hover:text-gray-700"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={handleApplyStatus}
                          className="px-3.5 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                          Apply
                        </button>
                      </div>
                    </div>,
                    document.body
                  )}
                </div>
              </th>

              {/* Loan Product / Type */}
              <th className="px-6 py-4 font-semibold">
                <div className="relative inline-flex items-center gap-2">
                  <span>Loan Product</span>
                  <button
                    ref={loanTypeRef}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setLoanTypeFilterOpen(!loanTypeFilterOpen); }}
                    className={`p-1 rounded transition hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 ${loanTypeFilterOpen || selectedLoanTypes.length > 0 ? 'text-emerald-600' : 'text-gray-400'}`}
                  >
                    <Filter size={15} strokeWidth={2} />
                  </button>
                  {loanTypeFilterOpen && typeof document !== 'undefined' && createPortal(
                    <div
                      ref={loanTypeDialogRef}
                      role="dialog"
                      aria-modal="true"
                      aria-label="Loan product filter"
                      tabIndex={-1}
                      className="loan-filter-popup fixed z-[9999] w-72 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 normal-case font-normal text-sm text-gray-800"
                      style={{
                        top: (loanTypeRef.current?.getBoundingClientRect().bottom ?? 0) + 8,
                        left: Math.max(16, loanTypeRef.current?.getBoundingClientRect().left ?? 0),
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="px-4 py-2 font-semibold text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100">
                        Loan Product
                      </div>
                      <div className="max-h-60 overflow-y-auto py-1">
                        {['All', 'CBE Smallholder Seed Loan', 'CBE Agri Input Finance', 'CBE Pastoralist Livestock Loan'].map((opt) => {
                          const isAll = opt === 'All';
                          const isChecked = isAll ? localLoanTypes.length === 0 : localLoanTypes.includes(opt);
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => {
                                if (isAll) {
                                  setLocalLoanTypes([]);
                                } else {
                                  toggleLocalLoanType(opt);
                                }
                              }}
                              className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer text-gray-700 text-left focus:outline-none focus-visible:bg-gray-50"
                            >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isChecked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-gray-300'}`}>
                                {isChecked && <Check size={12} strokeWidth={3} />}
                              </div>
                              <span className="text-sm font-medium">{opt}</span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="p-3 border-t border-gray-100 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => { setLocalLoanTypes([]); dispatch(setTableTypeFilters([])); setLoanTypeFilterOpen(false); }}
                          className="text-xs font-semibold text-gray-500 hover:text-gray-700"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={handleApplyLoanType}
                          className="px-3.5 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                          Apply
                        </button>
                      </div>
                    </div>,
                    document.body
                  )}
                </div>
              </th>

              {/* Amount */}
              <th className="px-6 py-4 font-semibold">
                <div className="relative inline-flex items-center gap-2">
                  <span>Amount (ETB)</span>
                  <button
                    ref={amountRef}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setAmountFilterOpen(!amountFilterOpen); }}
                    className={`p-1 rounded transition hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 ${amountFilterOpen || currentAdvancedFilters.minLoan !== null ? 'text-emerald-600' : 'text-gray-400'}`}
                  >
                    <Filter size={15} strokeWidth={2} />
                  </button>
                  {amountFilterOpen && typeof document !== 'undefined' && createPortal(
                    <div
                      ref={amountDialogRef}
                      role="dialog"
                      aria-modal="true"
                      aria-label="Loan amount filter"
                      tabIndex={-1}
                      className="loan-filter-popup fixed z-[9999] w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 normal-case font-normal text-sm text-gray-800"
                      style={{
                        top: (amountRef.current?.getBoundingClientRect().bottom ?? 0) + 8,
                        left: Math.max(16, amountRef.current?.getBoundingClientRect().left ?? 0),
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                        Loan Amount
                      </div>

                      {/* Slider */}
                      <div className="space-y-4 mb-5">
                        <div className="relative w-full">
                          <div className="h-2 w-full bg-gray-200 rounded-full relative">
                            <div
                              className="absolute left-0 top-0 h-full bg-emerald-500 rounded-full"
                              style={{ width: `${(tempAmountIndex / 4) * 100}%` }}
                            />
                            <input
                              type="range"
                              min="0"
                              max="4"
                              step="1"
                              value={tempAmountIndex}
                              onChange={(e) => handleApplyAmount(Number(e.target.value))}
                              className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div
                              className="absolute w-5 h-5 bg-white border-2 border-emerald-600 rounded-full -top-1.5 -ml-2.5 pointer-events-none shadow-sm"
                              style={{ left: `${(tempAmountIndex / 4) * 100}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs font-bold text-gray-500">
                          <div>
                            <span className="block text-[10px] text-gray-400">ETB</span>
                            <span>0</span>
                          </div>
                          <div className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-md border border-emerald-100 font-extrabold">
                            {RANGE_STEPS[tempAmountIndex]?.display || 'ETB 350000'}
                          </div>
                          <div className="text-right">
                            <span className="block text-[10px] text-gray-400">ETB</span>
                            <span>1000000</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5 border-t border-gray-100 pt-3">
                        {RANGE_STEPS.slice(0, 4).map((opt, idx) => {
                          const isSel = tempAmountIndex === idx;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => handleApplyAmount(idx)}
                              className="flex w-full items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-left focus:outline-none focus-visible:bg-gray-50"
                            >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSel ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-gray-300'}`}>
                                {isSel && <Check size={12} strokeWidth={3} />}
                              </div>
                              <span className="text-xs font-medium text-gray-700">{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>,
                    document.body
                  )}
                </div>
              </th>

              {/* Applied (Date Filter) */}
              <th className="px-6 py-4 font-semibold text-center">
                <div className="relative inline-flex items-center gap-2">
                  <span>Applied</span>
                  <button
                    ref={dateRef}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setDateFilterOpen(!dateFilterOpen); }}
                    className={`p-1 rounded transition hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 ${dateFilterOpen || currentAdvancedFilters.dateFrom ? 'text-emerald-600' : 'text-gray-400'}`}
                  >
                    <Filter size={15} strokeWidth={2} />
                  </button>
                  {dateFilterOpen && typeof document !== 'undefined' && createPortal(
                    <div
                      ref={dateDialogRef}
                      role="dialog"
                      aria-modal="true"
                      aria-label="Date filter"
                      tabIndex={-1}
                      className="loan-filter-popup fixed z-[9999] w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 normal-case font-normal text-sm text-gray-800"
                      style={{
                        top: (dateRef.current?.getBoundingClientRect().bottom ?? 0) + 8,
                        left: Math.max(16, (dateRef.current?.getBoundingClientRect().right ?? 0) - 288),
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                        Date Filter
                      </div>

                      <div className="space-y-2 mb-4">
                        {[
                          { label: 'Today', days: 0 },
                          { label: 'Yesterday', days: 1 },
                          { label: 'Last 7 Days', days: 7 },
                          { label: 'Last 30 Days', days: 30 },
                          { label: 'Last 90 Days', days: 90 },
                        ].map((o) => {
                          const isChecked = tempQuickDate === o.label;
                          return (
                            <button
                              key={o.label}
                              type="button"
                              onClick={() => {
                                setTempQuickDate(o.label);
                                const to = new Date();
                                const from = new Date();
                                if (o.days === 1) {
                                  from.setDate(from.getDate() - 1);
                                  to.setDate(to.getDate() - 1);
                                } else {
                                  from.setDate(from.getDate() - o.days);
                                }
                                setTempDateFrom(from.toISOString().split('T')[0] ?? '');
                                setTempDateTo(to.toISOString().split('T')[0] ?? '');
                              }}
                              className="flex w-full items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-left focus:outline-none focus-visible:bg-gray-50"
                            >
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${isChecked ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-300'}`}>
                                {isChecked && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                              </div>
                              <span className="text-xs font-medium text-gray-700">{o.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="border-t border-gray-100 pt-3 space-y-2">
                        <span className="block text-xs font-bold text-gray-500">Default Date</span>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="block text-[10px] text-gray-400 mb-1">From</span>
                            <input
                              type="date"
                              value={tempDateFrom}
                              onChange={(e) => setTempDateFrom(e.target.value)}
                              className="w-full border border-gray-200 rounded-lg p-1.5 text-xs text-gray-700"
                            />
                          </div>
                          <div>
                            <span className="block text-[10px] text-gray-400 mb-1">To</span>
                            <input
                              type="date"
                              value={tempDateTo}
                              onChange={(e) => setTempDateTo(e.target.value)}
                              className="w-full border border-gray-200 rounded-lg p-1.5 text-xs text-gray-700"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleApplyDate}
                          className="w-full mt-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                          Apply Search
                        </button>
                      </div>
                    </div>,
                    document.body
                  )}
                </div>
              </th>

              <th className="px-6 py-4 font-semibold text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.length === 0 ? (
              <LoanEmptyState hasFilters={hasFilters} onClearFilters={handleClearFilters} />
            ) : (
              rows.map((row, i) => {
                let badgeColor = 'bg-gray-100 text-gray-600 border-gray-200';
                let dotColor = 'bg-gray-400';

                const statusLower = row.status.toLowerCase();
                if (statusLower.includes('processing') || statusLower.includes('active') || row.statusTone === 'info') {
                  badgeColor = 'bg-cyan-100 text-cyan-600 border border-cyan-300';
                  dotColor = 'bg-cyan-600';
                } else if (statusLower.includes('approved') || statusLower.includes('granted') || statusLower.includes('verified') || row.statusTone === 'success') {
                  badgeColor = 'bg-emerald-50 text-emerald-600 border border-emerald-200';
                  dotColor = 'bg-emerald-500';
                } else if (statusLower.includes('rejected') || row.statusTone === 'danger') {
                  badgeColor = 'bg-red-50 text-red-500 border border-red-200';
                  dotColor = 'bg-red-500';
                }

                const updatedParts = row.updated.split(' · ');
                const datePart = updatedParts[0];
                const timePart = updatedParts[1];

                return (
                  <tr
                    key={`${row.id}-${i}`}
                    className="transition-colors hover:bg-gray-50/50 group"
                  >
                    <td className="px-6 py-5">
                      <strong className="block text-base font-semibold text-[#16A34A]">{row.application_id || row.id}</strong>
                      {row.applicant !== 'Unknown Applicant' && (
                        <span className="mt-1 block text-sm text-gray-400">{row.applicant}</span>
                      )}
                    </td>
                    <td className="px-6 py-5 font-medium text-gray-700">
                      <div className="flex items-center gap-2.5">
                        <Phone size={16} className="text-gray-400" />
                        {row.phone}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold ${badgeColor}`}>
                        <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
                        {row.status.replace(/Verified|Approved/gi, 'Granted').replace(/Active/gi, 'Processing')}
                      </span>
                    </td>
                    <td className="px-6 py-5 font-medium text-gray-700">{row.productName || row.type}</td>
                    <td className="px-6 py-5 font-medium text-gray-700">{row.loanAmount}</td>
                    <td className="px-6 py-5 text-center">
                      <div className="flex flex-col text-sm text-gray-500">
                        <span>{datePart}</span>
                        {timePart && <span className="text-xs text-gray-400">{timePart}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => onView?.(row)}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 active:scale-95"
                        >
                          <Eye size={16} className="text-gray-400" />
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100 px-6 py-4 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <span>Showing</span>
          <select
            value={pageSize}
            onChange={(e) => dispatch(setPageSize(Number(e.target.value)))}
            aria-label="Items per page"
            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-bold text-gray-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <span>of {effectiveTotal} Applications</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => dispatch(setActivityPage(currentPage - 1))}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            &lt; Prev
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }).map((_, idx) => {
            const pageNum = idx + 1;
            const isActive = pageNum === currentPage;
            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => dispatch(setActivityPage(pageNum))}
                className={`h-8 w-8 rounded-lg text-xs font-bold transition ${isActive ? 'bg-[#16A34A] text-white shadow-sm' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                {pageNum}
              </button>
            );
          })}
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => dispatch(setActivityPage(currentPage + 1))}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next &gt;
          </button>
        </div>
      </div>
    </div>
  );
});

LoanTable.displayName = 'LoanTable';
export default LoanTable;
