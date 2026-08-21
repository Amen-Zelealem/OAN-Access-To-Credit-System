'use client';

import LoanTable, { LoanTableRow } from '@/features/loans/components/LoanTable';
import LoanApplicationModal from '@/features/loans/components/modals/LoanApplicationModal';
import {
  fetchLoans,
  selectAdvancedFilters,
  selectIsLoansLoading,
  selectLoansError,
  selectPagedRows,
  selectQueryParams,
  selectSearchQuery,
  selectTableStatusFilters,
  selectTableTypeFilters,
  selectTotalCount,
  setSearchQuery,
  updateLoanStatus
} from '@/features/loans/store/loanDashboardSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { AlertCircle, FileOutput, Inbox, Loader2, RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import SellerAdvancedFilters from './SellerAdvancedFilters';
export function LoanApplicationsTable() {
  const dispatch = useAppDispatch();
  const rows = useAppSelector(selectPagedRows);
  const totalCount = useAppSelector(selectTotalCount);
  const isLoading = useAppSelector(selectIsLoansLoading);
  const error = useAppSelector(selectLoansError);
  const queryParams = useAppSelector(selectQueryParams);
  const searchQuery = useAppSelector(selectSearchQuery);
  const tableStatusFilters = useAppSelector(selectTableStatusFilters);
  const tableTypeFilters = useAppSelector(selectTableTypeFilters);
  const advancedFilters = useAppSelector(selectAdvancedFilters);
  // Same active-filters check LoanTable itself uses (plus search) — keeps the
  // "no data at all" empty state from also covering "filters just match nothing",
  // which would otherwise hide the table header along with the illustration.
  const hasActiveFilters = Boolean(searchQuery) || tableStatusFilters.length > 0 || tableTypeFilters.length > 0
    || advancedFilters.minLoan !== null || Boolean(advancedFilters.dateFrom);

  const [selectedRow, setSelectedRow] = useState<LoanTableRow | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');

  // Re-fetch whenever the derived query params change (advanced filters, search,
  // pagination, etc.). Filtering is server-side, so the params must be passed to
  // fetchLoans — an argument-less call ignores all active filters.
  const loadLoans = useCallback(() => {
    return dispatch(fetchLoans(queryParams));
  }, [dispatch, queryParams]);

  useEffect(() => {
    // Abort the in-flight request when queryParams change (or on unmount) so a
    // slower earlier response can't overwrite the results for a newer query.
    const promise = loadLoans();
    return () => {
      promise.abort();
    };
  }, [loadLoans]);

  const handleRetry = () => {
    loadLoans();
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Updates searchQuery in the store; the query-params effect re-fetches.
    dispatch(setSearchQuery(searchInput));
  };

  const handleExportCsv = () => {
    if (!rows.length) return;
    const headers = ['Application ID', 'Applicant', 'Phone', 'Loan Product', 'Amount (ETB)', 'Status', 'Date'];
    const csvContent = [
      headers.join(','),
      ...rows.map(r => [
        `"${r.id}"`,
        `"${r.applicant}"`,
        `"${r.phone}"`,
        `"${r.productName || r.type}"`,
        `"${r.loanAmount}"`,
        `"${r.status}"`,
        `"${r.updated}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `loan_applications_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white border border-[#F1F3F4] rounded-xl shadow-sm flex flex-col min-h-[500px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.05),0px_2px_4px_-1px_rgba(0,0,0,0.03)] hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
      {/* Table Header */}
      <div className="p-6 border-b border-[#E5E7EB]">
        <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
          <div>
            <h3 className="text-[18px] font-bold text-[#1F2937] mb-1">Loan Applications</h3>
            <p className="text-[14px] text-[#6B7280]">
              Farmers who applied against your published loan products – via OAN Farmer Profiling System
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {/* Search Toggle Button */}
            <button
              type="button"
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className={`w-[42px] h-[42px] rounded-xl border flex items-center justify-center transition-all shadow-2xs ${isSearchOpen || searchInput
                  ? 'bg-gray-100 border-gray-300 text-gray-800'
                  : 'bg-white border-[#E5E7EB] text-[#6B7280] hover:bg-gray-50'
                }`}
              title="Toggle Search"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Export CSV */}
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-4 py-2.5 text-sm font-semibold text-[#4B5563] bg-white border border-[#E5E7EB] rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2 shadow-2xs"
            >
              <FileOutput className="w-4 h-4 text-[#6B7280]" />
              <span>Export CSV</span>
            </button>

            {/* Advanced Filters */}
            <button
              type="button"
              onClick={() => setIsFilterOpen(true)}
              className="px-4 py-2.5 text-sm font-semibold text-[#4B5563] bg-white border border-[#E5E7EB] rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2 shadow-2xs"
            >
              <SlidersHorizontal className="w-4 h-4 text-[#6B7280]" />
              <span>Advanced Filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Search Input Bar (Placed on top of table columns) */}
      {isSearchOpen && (
        <div className="p-4 bg-white border-b border-[#E5E7EB] animate-in fade-in slide-in-from-top-2 duration-200">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by applicant name / ID / product..."
                className="w-full pl-12 pr-4 py-3 text-sm bg-[#F8FAFC] border border-gray-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20 focus:border-[#16A34A] focus:bg-white text-gray-800 placeholder-gray-400 transition-all"
              />
            </div>
            <button
              type="submit"
              className="bg-[#16A34A] hover:bg-[#15803d] text-white px-7 py-3 rounded-xl text-sm font-bold transition-all shadow-sm shrink-0"
            >
              Search
            </button>
          </form>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 flex flex-col">
        {isLoading && rows.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-4">
            <Loader2 className="w-8 h-8 text-[#00C48C] animate-spin" />
            <p className="text-sm font-medium text-gray-500">Loading loan applications...</p>
          </div>
        ) : error && rows.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4 text-red-500">
              <AlertCircle size={24} />
            </div>
            <h4 className="text-base font-bold text-gray-900 mb-1">Failed to load applications</h4>
            <p className="text-sm text-gray-500 mb-4 max-w-md">{error}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#16A34A] text-white text-sm font-semibold rounded-lg hover:bg-[#10883c] transition-colors"
            >
              <RefreshCw size={16} />
              Retry
            </button>
          </div>
        ) : rows.length === 0 && !hasActiveFilters ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
              <div
                className="absolute inset-0 bg-[#00C48C]/20 rounded-full animate-ping opacity-75"
                style={{ animationDuration: '3s' }}
              />
              <div className="relative w-16 h-16 bg-[#E6F9F3] rounded-full flex items-center justify-center border-4 border-white shadow-sm z-10">
                <Inbox className="w-8 h-8 text-[#00C48C] animate-bounce" style={{ animationDuration: '2s' }} />
              </div>
            </div>
            <h3 className="text-[#1F2937] text-[18px] font-bold mb-2">No applications yet</h3>
            <p className="text-[#6B7280] text-[14px] max-w-[380px] text-center leading-relaxed">
              Farmer loan applications routed through the OAN Farmer Profiling System will appear here once your loan products are active and published.
            </p>
          </div>
        ) : (
          /* Table of applications */
          <div className="p-4 overflow-x-auto">
            <LoanTable onView={(row) => setSelectedRow(row)} totalCount={totalCount} />
          </div>
        )}
      </div>

      {/* Modal for full application details */}
      {selectedRow && (
        <LoanApplicationModal
          isOpen={!!selectedRow}
          onClose={() => setSelectedRow(null)}
          data={selectedRow}
          onStatusChange={(id, status, reason, note) => {
            const payload: { id: string; status: string; reason?: string; notes?: string } = { id, status };
            if (reason) payload.reason = reason;
            if (note) payload.notes = note;
            dispatch(updateLoanStatus(payload));
          }}
        />
      )}

      {/* Advanced Filters Sidebar */}
      <SellerAdvancedFilters
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
      />
    </div>
  );
}
