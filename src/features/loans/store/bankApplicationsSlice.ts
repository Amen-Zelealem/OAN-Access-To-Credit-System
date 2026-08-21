import {
  GetLoansParams,
  LoanApplicationSummary,
  loanService,
  LoanSummaryMetrics,
} from '@/features/loans/api/loan.service';
import type { ApiResponse } from '@/types/api';
import { createAsyncThunk, createSelector, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../../../store';

// The bank-side Applications List reads the same `get_all_loans` endpoint as the
// Development Agent's dashboard, but it is deliberately NOT the loanDashboard
// slice:
//
//  - loanDashboard defaults `dateRange` to 'last30' and owns the "All / My /
//    Unassigned" officer tabs. Both are Development Agent concepts; a bank has
//    no officer queue, and a silent 30-day window on a list with no date control
//    would hide applications with nothing on screen to explain why.
//  - Two dashboards sharing one slice means one role's filters survive into the
//    other's screen for anyone holding both roles.
//
// Tenant isolation itself is NOT done here. `get_all_loans` goes through
// `frappe.get_list`, which applies the backend's `loan_application_scope_query`
// hook: a bank user only ever receives their own bank's non-Draft applications.
// Nothing on this page can widen that, and nothing here should try to enforce it
// — the client just renders what the scoped endpoint returned.

/** Backend status -> the label the business uses for it on bank screens. */
const STATUS_LABELS: Record<string, string> = {
  Approved: 'Granted',
  Processing: 'Processing',
  Rejected: 'Rejected',
  Draft: 'Draft',
};

export function bankStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/**
 * The statuses a bank can actually see, in lifecycle order.
 *
 * `Draft` is absent on purpose: it is the Development Agent's private stage and
 * the backend refuses it to bank users (`loan_application_scope_query`), so
 * offering it as a filter would only ever return nothing.
 */
export const BANK_STATUS_OPTIONS: ReadonlyArray<{ value: string; label: string; color: string }> = [
  { value: 'Processing', label: 'Processing', color: 'bg-cyan-500' },
  { value: 'Approved', label: 'Granted', color: 'bg-emerald-500' },
  { value: 'Rejected', label: 'Rejected', color: 'bg-red-500' },
];

/** Amount buckets offered by LoanAmountFilter / AdvancedFilters, in ETB. */
const AMOUNT_BUCKETS: Record<string, { min: number; max: number | null }> = {
  '0 - 25,000': { min: 0, max: 25000 },
  '25,001 - 50,000': { min: 25001, max: 50000 },
  '50,001 - 1,00,000': { min: 50001, max: 100000 },
  '1,00,000 and above': { min: 100001, max: null },
};

// Deterministic avatar tints, picked by application id so a row keeps the same
// colour across pages and refetches.
const AVATAR_TINTS = [
  'bg-green-100 text-green-700',
  'bg-blue-100 text-blue-700',
  'bg-orange-100 text-orange-700',
  'bg-purple-100 text-purple-700',
  'bg-red-100 text-red-700',
  'bg-teal-100 text-teal-700',
] as const;

function tintFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return AVATAR_TINTS[hash % AVATAR_TINTS.length] as string;
}

export interface BankApplicationFilters {
  status: string[];
  loanType: string[];
  /** Bucket labels from AMOUNT_BUCKETS; translated to min/max for the API. */
  loanAmount: string[];
  location: string;
  dateFrom: string;
  dateTo: string;
}

/**
 * A table row. Structurally a superset of `LoanTableRow`, so the read-only
 * application modal the Development Agent uses accepts one unchanged.
 */
export interface BankApplicationRow {
  id: string;
  application_id: string;
  applicant: string;
  initials: string;
  initialsColor: string;
  location: string;
  region: string;
  phone: string;
  type: string;
  productName: string;
  loanAmount: string;
  /** Raw backend status — what filters and the API speak. */
  status: string;
  /** What the badge shows (`Approved` reads as "Granted"). */
  statusLabel: string;
  statusTone: 'success' | 'danger' | 'neutral' | 'info';
  appliedDate: string;
  appliedTime: string;
  updated: string;
  timestamp: number;
  action: string;
}

interface BankApplicationsState {
  raw: ApiResponse<LoanApplicationSummary[]> | null;
  isLoading: boolean;
  error: string | null;
  /**
   * The most recently dispatched fetch. Gates the settled handlers so a slower
   * earlier response can never overwrite a newer query's results.
   */
  latestRequestId: string | null;

  summary: ApiResponse<LoanSummaryMetrics> | null;
  isSummaryLoading: boolean;
  summaryError: string | null;

  /**
   * Every `loan_type` seen so far, unioned across fetches and never pruned.
   *
   * The column filter cannot be derived from the rows on screen: filtering is
   * server-side, so picking "Crop Loan" would shrink the option list to exactly
   * "Crop Loan" and leave no way back to another type short of Clear Filters.
   * Accumulating instead means the list only ever grows as pages are visited,
   * and a chosen value is always still selectable.
   */
  knownLoanTypes: string[];

  page: number;
  pageSize: number;
  searchQuery: string;
  filters: BankApplicationFilters;
}

const DEFAULT_FILTERS: BankApplicationFilters = {
  status: [],
  loanType: [],
  loanAmount: [],
  location: '',
  dateFrom: '',
  dateTo: '',
};

const initialState: BankApplicationsState = {
  raw: null,
  isLoading: false,
  error: null,
  latestRequestId: null,

  summary: null,
  isSummaryLoading: false,
  summaryError: null,

  knownLoanTypes: [],

  page: 1,
  pageSize: 10,
  searchQuery: '',
  filters: { ...DEFAULT_FILTERS },
};

export const fetchBankApplications = createAsyncThunk(
  'bankApplications/fetch',
  async (params: GetLoansParams | undefined, { signal, rejectWithValue }) => {
    try {
      return await loanService.getLoans(params, { signal });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Failed to fetch applications';
      return rejectWithValue(message);
    }
  }
);

export const fetchBankApplicationSummary = createAsyncThunk(
  'bankApplications/fetchSummary',
  async (_, { rejectWithValue }) => {
    try {
      return await loanService.getLoanSummary();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch summary';
      return rejectWithValue(message);
    }
  }
);

const bankApplicationsSlice = createSlice({
  name: 'bankApplications',
  initialState,
  reducers: {
    setBankPage: (state, action: PayloadAction<number>) => {
      state.page = action.payload;
    },
    setBankPageSize: (state, action: PayloadAction<number>) => {
      state.pageSize = action.payload;
      state.page = 1;
    },
    setBankSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
      state.page = 1;
    },
    setBankFilters: (state, action: PayloadAction<BankApplicationFilters>) => {
      state.filters = action.payload;
      state.page = 1;
    },
    // One "Clear Filters" must reset every filter surface — the column dropdowns,
    // the advanced-filters drawer AND the search box — or a value cleared in the
    // UI keeps filtering the request.
    clearBankFilters: (state) => {
      state.filters = { ...DEFAULT_FILTERS };
      state.searchQuery = '';
      state.page = 1;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBankApplications.pending, (state, action) => {
        state.latestRequestId = action.meta.requestId;
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchBankApplications.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.latestRequestId) return;
        state.isLoading = false;
        state.raw = action.payload;

        for (const row of action.payload?.data ?? []) {
          const loanType = row.loan_type;
          if (loanType && !state.knownLoanTypes.includes(loanType)) {
            state.knownLoanTypes.push(loanType);
          }
        }
      })
      .addCase(fetchBankApplications.rejected, (state, action) => {
        if (action.meta.aborted) return;
        if (action.meta.requestId !== state.latestRequestId) return;
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchBankApplicationSummary.pending, (state) => {
        state.isSummaryLoading = true;
        state.summaryError = null;
      })
      .addCase(fetchBankApplicationSummary.fulfilled, (state, action) => {
        state.isSummaryLoading = false;
        state.summary = action.payload;
      })
      .addCase(fetchBankApplicationSummary.rejected, (state, action) => {
        state.isSummaryLoading = false;
        state.summaryError = action.payload as string;
      });
  },
});

export const {
  setBankPage,
  setBankPageSize,
  setBankSearchQuery,
  setBankFilters,
  clearBankFilters,
} = bankApplicationsSlice.actions;

// --- Basic selectors ---
const selectRaw = (state: RootState) => state.bankApplications.raw;
export const selectBankApplicationsLoading = (state: RootState) => state.bankApplications.isLoading;
export const selectBankApplicationsError = (state: RootState) => state.bankApplications.error;
export const selectBankPage = (state: RootState) => state.bankApplications.page;
export const selectBankPageSize = (state: RootState) => state.bankApplications.pageSize;
export const selectBankSearchQuery = (state: RootState) => state.bankApplications.searchQuery;
export const selectBankFilters = (state: RootState) => state.bankApplications.filters;
const selectSummary = (state: RootState) => state.bankApplications.summary;

function toneFor(status: string): BankApplicationRow['statusTone'] {
  if (status === 'Approved') return 'success';
  if (status === 'Rejected') return 'danger';
  if (status === 'Draft') return 'neutral';
  return 'info';
}

// --- Derived selectors ---
const selectRowsData = createSelector([selectRaw], (raw) => {
  const rows = raw?.data ?? [];

  const mapped: BankApplicationRow[] = rows.map((row) => {
    const created = row.creation ? new Date(row.creation) : new Date();
    const first = row.first_name ?? '';
    const last = row.last_name ?? '';
    const applicant = `${first} ${last}`.trim();
    const initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
    const appliedDate = created.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const appliedTime = created.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const status = row.status || 'Processing';

    return {
      id: row.application_id,
      application_id: row.application_id,
      applicant: applicant || 'Unknown Applicant',
      initials: initials || '—',
      initialsColor: tintFor(row.application_id),
      location: row.location || '—',
      region: row.location || '',
      phone: row.phone_number || '—',
      // `type` is what the LOAN TYPE column shows *and* what its filter sends, so
      // it has to be the `loan_type` field the API filters on — not the product
      // name, which lives in its own column-sub-line and would match nothing.
      type: row.loan_type || 'Unknown Type',
      productName: row.loan_product_name || '',
      loanAmount: row.loan_amount ? row.loan_amount.toLocaleString() : '—',
      status,
      statusLabel: bankStatusLabel(status),
      statusTone: toneFor(status),
      appliedDate,
      appliedTime,
      updated: `${appliedDate} · ${appliedTime}`,
      timestamp: created.getTime(),
      action: 'View',
    };
  });

  return {
    rows: mapped,
    totalCount: raw?.pagination?.total ?? 0,
    totalPages: raw?.pagination?.total_pages || 1,
  };
});

export const selectBankApplicationRows = createSelector([selectRowsData], (d) => d.rows);
export const selectBankTotalCount = createSelector([selectRowsData], (d) => d.totalCount);
export const selectBankTotalPages = createSelector([selectRowsData], (d) => d.totalPages);

const selectKnownLoanTypes = (state: RootState) => state.bankApplications.knownLoanTypes;

/**
 * Loan types offered by the column filter.
 *
 * The accumulated set (see `knownLoanTypes`) unioned with whatever is currently
 * selected, so a value chosen before a page reload is never missing from the
 * list that is supposed to let you unselect it.
 */
export const selectBankLoanTypeOptions = createSelector(
  [selectKnownLoanTypes, selectBankFilters],
  (known, filters) => Array.from(new Set([...known, ...filters.loanType])).sort()
);

export const selectBankMetrics = createSelector([selectSummary], (summary) => {
  const data = summary?.data;
  return {
    total: data?.total ?? 0,
    processing: data?.processing ?? 0,
    approved: data?.approved ?? 0,
    rejected: data?.rejected ?? 0,
  };
});

export const selectBankQueryParams = createSelector(
  [selectBankPage, selectBankPageSize, selectBankSearchQuery, selectBankFilters],
  (page, pageSize, searchQuery, filters): GetLoansParams => {
    const params: GetLoansParams = { page, page_size: pageSize };

    if (searchQuery) params.search_query = searchQuery;
    if (filters.status.length > 0) params.status = filters.status.join(',');
    if (filters.loanType.length > 0) params.loan_type = filters.loanType.join(',');
    if (filters.location) params.location = filters.location;
    if (filters.dateFrom) params.from_date = filters.dateFrom;
    if (filters.dateTo) params.to_date = filters.dateTo;

    // Buckets are contiguous, so a selection collapses to one min/max span.
    // "and above" has no ceiling, so selecting it drops max entirely rather than
    // capping the range at an arbitrary number.
    const buckets = filters.loanAmount
      .map((label) => AMOUNT_BUCKETS[label])
      .filter((b): b is { min: number; max: number | null } => Boolean(b));

    if (buckets.length > 0) {
      params.min_loan_amount = String(Math.min(...buckets.map((b) => b.min)));
      const hasOpenEnded = buckets.some((b) => b.max === null);
      if (!hasOpenEnded) {
        params.max_loan_amount = String(
          Math.max(...buckets.map((b) => b.max as number))
        );
      }
    }

    return params;
  }
);

export const bankApplicationsReducer = bankApplicationsSlice.reducer;
