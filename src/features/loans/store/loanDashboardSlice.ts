import { GetLoansParams, LoanApplicationSummary, loanService, LoanSummaryMetrics } from '@/features/loans/api/loan.service';
import type { ApiResponse } from '@/types/api';
import { createAsyncThunk, createSelector, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../../../store';

// Sentinel sent to the API when the user has explicitly cleared all status
// filters, signalling "match no statuses" (distinct from omitting the param,
// which means "all statuses").
const NO_STATUS_SENTINEL = '__NONE__';

export const fetchLoans = createAsyncThunk(
  'loanDashboard/fetchLoans',
  async (params: GetLoansParams | undefined, { signal, rejectWithValue }) => {
    try {
      const response = await loanService.getLoans(params, { signal });
      return response;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Failed to fetch loans';
      return rejectWithValue(message);
    }
  }
);

export const fetchLoanSummary = createAsyncThunk(
  'loanDashboard/fetchLoanSummary',
  async (_, { rejectWithValue }) => {
    try {
      const response = await loanService.getLoanSummary();
      return response;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch loan summary';
      return rejectWithValue(message);
    }
  }
);

export const updateLoanStatus = createAsyncThunk(
  'loanDashboard/updateLoanStatus',
  async ({ id, status, reason, notes }: { id: string; status: string; reason?: string; notes?: string }, { rejectWithValue, dispatch, getState }) => {
    try {
      const response = await loanService.updateLoanStatus(id, status, reason, notes);
      // Re-fetch with the user's current filters/pagination (not the defaults) so the view doesn't silently reset.
      dispatch(fetchLoans(selectQueryParams(getState() as RootState)));
      return response;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update loan status';
      return rejectWithValue(message);
    }
  }
);

const ALL_STATUS_VALUES = ['danger', 'info', 'neutral'];

export interface MappedLoanRow extends Omit<LoanApplicationSummary, 'status'> {
  id: string;
  applicant: string;
  initials?: string;
  productName?: string;
  phone: string;
  loanAmount: string;
  type: string;
  status: string;
  statusTone: string;
  updated: string;
  timestamp: number;
  action: string;
}

export interface AdvancedFilters {
  status: string[];
  minLoan: number | null;
  maxLoan: number | null;
  type: string[];
  location: string;
  dateFrom: string;
  dateTo: string;
  sortBy?: 'loan_amount' | 'creation';
  sortOrder?: 'asc' | 'desc';
}

interface LoanDashboardState {
  rawActivityData: ApiResponse<LoanApplicationSummary[]> | null;
  isLoading: boolean;
  loansError: string | null;
  // The most recently *dispatched* fetchLoans requestId — including the
  // untracked one updateLoanStatus fires after a status change, which has no
  // component-side abort to rely on. Gates .fulfilled/.rejected so a slower
  // older request can never overwrite a newer one's result, regardless of
  // which order they settle in.
  latestFetchRequestId: string | null;
  rawSummaryData: ApiResponse<LoanSummaryMetrics> | null;
  isSummaryLoading: boolean;
  summaryError: string | null;

  // UI State
  dateRange: string;
  selectedStatuses: string[];
  activityPage: number;
  activeTab: 'all' | 'my' | 'unassigned';
  searchQuery: string;
  tableStatusFilters: string[];
  tableTypeFilters: string[];
  pageSize: number;
  advancedFilters: AdvancedFilters;
}

// Shared by initialState and every "clear filters" reducer below, so the
// three can't silently drift apart when a field is added to AdvancedFilters.
const DEFAULT_ADVANCED_FILTERS: AdvancedFilters = {
  status: [],
  minLoan: null,
  maxLoan: null,
  type: [],
  location: '',
  dateFrom: '',
  dateTo: '',
};

const initialState: LoanDashboardState = {
  rawActivityData: null,
  isLoading: false,
  loansError: null,
  latestFetchRequestId: null,
  rawSummaryData: null,
  isSummaryLoading: false,
  summaryError: null,

  dateRange: 'last30',
  selectedStatuses: [...ALL_STATUS_VALUES],
  activityPage: 1,
  activeTab: 'all',
  searchQuery: '',
  tableStatusFilters: [],
  tableTypeFilters: [],
  pageSize: 10,
  advancedFilters: { ...DEFAULT_ADVANCED_FILTERS },
};

const loanDashboardSlice = createSlice({
  name: 'loanDashboard',
  initialState,
  reducers: {
    toggleTableStatusFilter: (state, action: PayloadAction<string>) => {
      const val = action.payload;
      if (state.tableStatusFilters.includes(val)) {
        state.tableStatusFilters = state.tableStatusFilters.filter(s => s !== val);
      } else {
        state.tableStatusFilters.push(val);
      }
      state.activityPage = 1;
    },
    toggleTableTypeFilter: (state, action: PayloadAction<string>) => {
      const val = action.payload;
      if (state.tableTypeFilters.includes(val)) {
        state.tableTypeFilters = state.tableTypeFilters.filter(s => s !== val);
      } else {
        state.tableTypeFilters.push(val);
      }
      state.activityPage = 1;
    },
    setTableStatusFilters: (state, action: PayloadAction<string[]>) => {
      state.tableStatusFilters = action.payload;
      state.activityPage = 1;
    },
    setTableTypeFilters: (state, action: PayloadAction<string[]>) => {
      state.tableTypeFilters = action.payload;
      state.activityPage = 1;
    },
    clearTableFilters: (state) => {
      state.tableStatusFilters = [];
      state.tableTypeFilters = [];
      state.activityPage = 1;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
      state.activityPage = 1;
    },
    setActiveTab: (state, action: PayloadAction<'all' | 'my' | 'unassigned'>) => {
      state.activeTab = action.payload;
      state.activityPage = 1; // Reset pagination on tab change
    },
    setDateRange: (state, action: PayloadAction<string>) => {
      state.dateRange = action.payload;
    },
    toggleStatus: (state, action: PayloadAction<string>) => {
      const value = action.payload;
      const index = state.selectedStatuses.indexOf(value);
      if (index > -1) {
        state.selectedStatuses.splice(index, 1);
      } else {
        state.selectedStatuses.push(value);
      }
      if (state.selectedStatuses.length === 0) {
        state.selectedStatuses = [...ALL_STATUS_VALUES];
      }
      state.activityPage = 1;
    },
    toggleAllStatuses: (state) => {
      if (state.selectedStatuses.length === ALL_STATUS_VALUES.length) {
        state.selectedStatuses = [];
      } else {
        state.selectedStatuses = [...ALL_STATUS_VALUES];
      }
      state.activityPage = 1;
    },
    setActivityPage: (state, action: PayloadAction<number>) => {
      state.activityPage = action.payload;
    },
    setPageSize: (state, action: PayloadAction<number>) => {
      state.pageSize = action.payload;
      state.activityPage = 1; // reset to page 1
    },
    setAdvancedFilters: (state, action: PayloadAction<AdvancedFilters>) => {
      state.advancedFilters = action.payload;
      state.activityPage = 1;
    },
    clearAdvancedFilters: (state) => {
      state.advancedFilters = { ...DEFAULT_ADVANCED_FILTERS };
      state.activityPage = 1;
    },
    // The toolbar's "Clear Filters" needs to reset every independent filter
    // surface (badges, column filters, advanced filters, search) in one go —
    // clearAdvancedFilters alone left tableStatusFilters/tableTypeFilters/
    // selectedStatuses/searchQuery untouched, so a bad value picked from a
    // column filter survived a "clear" and kept the same broken request firing.
    resetAllFilters: (state) => {
      state.searchQuery = '';
      state.selectedStatuses = [...ALL_STATUS_VALUES];
      state.tableStatusFilters = [];
      state.tableTypeFilters = [];
      state.advancedFilters = { ...DEFAULT_ADVANCED_FILTERS };
      state.activityPage = 1;
    },
    setLoanSort: (state, action: PayloadAction<{ sortBy?: 'loan_amount' | 'creation'; sortOrder?: 'asc' | 'desc' }>) => {
      if (action.payload.sortBy !== undefined) {
        state.advancedFilters.sortBy = action.payload.sortBy;
      } else {
        delete state.advancedFilters.sortBy;
      }
      if (action.payload.sortOrder !== undefined) {
        state.advancedFilters.sortOrder = action.payload.sortOrder;
      } else {
        delete state.advancedFilters.sortOrder;
      }
      state.activityPage = 1;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchLoans
      .addCase(fetchLoans.pending, (state, action) => {
        state.latestFetchRequestId = action.meta.requestId;
        state.isLoading = true;
        state.loansError = null;
      })
      .addCase(fetchLoans.fulfilled, (state, action) => {
        // Ignore a response for a request that's been superseded by a newer
        // one (e.g. updateLoanStatus's untracked refetch resolving after the
        // user has since changed filters) — only the latest dispatch may write.
        if (action.meta.requestId !== state.latestFetchRequestId) return;
        state.isLoading = false;
        state.rawActivityData = action.payload;
      })
      .addCase(fetchLoans.rejected, (state, action) => {
        // Ignore aborted requests, and any response for a superseded request —
        // the newer request's pending/fulfilled owns the loading/error state.
        if (action.meta.aborted) return;
        if (action.meta.requestId !== state.latestFetchRequestId) return;
        state.isLoading = false;
        state.loansError = action.payload as string;
      })
      // fetchLoanSummary
      .addCase(fetchLoanSummary.pending, (state) => {
        state.isSummaryLoading = true;
        state.summaryError = null;
      })
      .addCase(fetchLoanSummary.fulfilled, (state, action) => {
        state.isSummaryLoading = false;
        state.rawSummaryData = action.payload;
      })
      .addCase(fetchLoanSummary.rejected, (state, action) => {
        state.isSummaryLoading = false;
        state.summaryError = action.payload as string;
      });
  },
});

export const {
  setDateRange,
  toggleStatus,
  toggleAllStatuses,
  setActivityPage,
  setActiveTab,
  setSearchQuery,
  toggleTableStatusFilter,
  toggleTableTypeFilter,
  setTableStatusFilters,
  setTableTypeFilters,
  clearTableFilters,
  setPageSize,
  setAdvancedFilters,
  clearAdvancedFilters,
  resetAllFilters,
  setLoanSort
} = loanDashboardSlice.actions;

// --- Basic Selectors ---
export const selectRawActivityData = (state: RootState) => state.loanDashboard.rawActivityData;
export const selectIsLoansLoading = (state: RootState) => state.loanDashboard.isLoading;
export const selectLoansError = (state: RootState) => state.loanDashboard.loansError;
export const selectRawSummaryData = (state: RootState) => state.loanDashboard.rawSummaryData;
export const selectDateRange = (state: RootState) => state.loanDashboard.dateRange;
export const selectSelectedStatuses = (state: RootState) => state.loanDashboard.selectedStatuses;
export const selectActivityPage = (state: RootState) => state.loanDashboard.activityPage;
export const selectActiveTab = (state: RootState) => state.loanDashboard.activeTab;
export const selectSearchQuery = (state: RootState) => state.loanDashboard.searchQuery;
export const selectTableStatusFilters = (state: RootState) => state.loanDashboard.tableStatusFilters;
export const selectTableTypeFilters = (state: RootState) => state.loanDashboard.tableTypeFilters;
export const selectPageSize = (state: RootState) => state.loanDashboard.pageSize;
export const selectAdvancedFilters = (state: RootState) => state.loanDashboard.advancedFilters;
export const selectLoanSortBy = (state: RootState) => state.loanDashboard.advancedFilters.sortBy;
export const selectLoanSortOrder = (state: RootState) => state.loanDashboard.advancedFilters.sortOrder;

// --- Derived Memoized Selectors ---
export const selectPagedRowsData = createSelector(
  [selectRawActivityData, selectPageSize],
  (rawActivityData, _pageSize) => {
    // fetchApi automatically unwraps the "message" envelope, so the data is directly on rawActivityData
    const rows = rawActivityData?.data || [];

    const totalCount = rawActivityData?.pagination?.total ?? 0;

    const mapped = rows.map((row: LoanApplicationSummary): MappedLoanRow => {
      const rawDate = row.creation ? new Date(row.creation) : new Date();
      const dateStr = rawDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const timeStr = rawDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      const appId = row.application_id || '';
      const formattedId = appId;

      const firstName = row.first_name || '';
      const lastName = row.last_name || '';
      const applicantName = `${firstName} ${lastName}`.trim();

      return {
        ...row,
        id: formattedId,
        applicant: applicantName,
        phone: row.phone_number || '',
        loanAmount: row.loan_amount ? row.loan_amount.toLocaleString() : '—',
        type: row.loan_type || 'Unknown Type',
        status: row.status || 'Draft',
        statusTone: row.status === 'Approved' ? 'success' : row.status === 'Rejected' ? 'danger' : row.status === 'Draft' ? 'neutral' : 'info',
        updated: `${dateStr} · ${timeStr}`,
        timestamp: rawDate.getTime(),
        action: 'View',
      };
    });

    const totalPages = rawActivityData?.pagination?.total_pages || 1;
    return { pagedRows: mapped, totalPages, totalCount };
  }
);

export const selectPagedRows = createSelector([selectPagedRowsData], (data) => data.pagedRows);
export const selectTotalPages = createSelector([selectPagedRowsData], (data) => data.totalPages);
export const selectTotalCount = createSelector([selectPagedRowsData], (data) => data.totalCount);

export const selectLiveMetrics = createSelector(
  [selectRawSummaryData],
  (rawSummaryData) => {
    // fetchApi automatically unwraps the "message" envelope
    const summaryData = rawSummaryData?.data || { total: 0, processing: 0, approved: 0, rejected: 0 };

    return {
      total: {
        value: summaryData.total?.toString() || '—',
      },
      processing: {
        value: summaryData.processing?.toString() || '—',
      },
      approved: {
        value: summaryData.approved?.toString() || '—',
      },
      rejected: {
        value: summaryData.rejected?.toString() || '—',
      },
    };
  }
);

export const selectTabCounts = createSelector(
  [selectRawSummaryData],
  (rawSummaryData) => {
    const tc = rawSummaryData?.data?.tab_counts;
    return tc ?? null;
  }
);


export const selectQueryParams = createSelector(
  [selectActivityPage, selectPageSize, selectDateRange, selectSelectedStatuses, selectSearchQuery, selectActiveTab, selectTableStatusFilters, selectTableTypeFilters, selectAdvancedFilters],
  (activityPage, pageSize, dateRange, selectedStatuses, searchQuery, activeTab, tableStatusFilters, tableTypeFilters, advancedFilters) => {
    const params: GetLoansParams = {
      page: activityPage,
      page_size: pageSize,
    };

    if (searchQuery) params.search_query = searchQuery;
    // Scope the queue server-side via loan_officer (get_all_loans): "My" → my
    // email, "Unassigned" → the literal 'unassigned', "All" → omit.
    if (activeTab === 'my') params.loan_officer = 'my';
    else if (activeTab === 'unassigned') params.loan_officer = 'unassigned';

    const getCutoffTimestamp = (range: string) => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      const resolvers: Record<string, () => number> = {
        'today': () => today,
        'yesterday': () => today - 86400000,
        'last7': () => today - 6 * 86400000,
        'last30': () => today - 29 * 86400000,
        'last3m': () => new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).getTime(),
        'last6m': () => new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()).getTime(),
        'last1y': () => new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).getTime(),
      };
      return resolvers[range]?.() ?? 0;
    };

    const ts = getCutoffTimestamp(dateRange);
    if (ts > 0) {
      const d = new Date(ts);
      params.from_date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    if (advancedFilters.dateFrom) {
      const datePart = advancedFilters.dateFrom.split('T')[0];
      if (datePart) params.from_date = datePart;
    }
    if (advancedFilters.dateTo) {
      const datePart = advancedFilters.dateTo.split('T')[0];
      if (datePart) params.to_date = datePart;
    }

    const allChecked = selectedStatuses.length === ALL_STATUS_VALUES.length;
    let statusesToPass: string[] = [];

    if (!allChecked && selectedStatuses.length > 0) {
      if (selectedStatuses.includes('danger')) statusesToPass.push('Rejected', 'Action Required');
      if (selectedStatuses.includes('neutral')) statusesToPass.push('Draft');
      if (selectedStatuses.includes('info')) statusesToPass.push('Pending Review', 'Processing');
      if (selectedStatuses.includes('success')) statusesToPass.push('Approved');
    }

    // Combine with table status filters
    if (tableStatusFilters.length > 0) {
      statusesToPass = [...new Set([...statusesToPass, ...tableStatusFilters])];
    }

    // Combine with advanced status filters
    if (advancedFilters.status.length > 0) {
      statusesToPass = [...new Set([...statusesToPass, ...advancedFilters.status])];
    }

    if (statusesToPass.length > 0) {
      params.status = statusesToPass.join(',');
    } else if (selectedStatuses.length === 0 && tableStatusFilters.length === 0 && advancedFilters.status.length === 0) {
      params.status = NO_STATUS_SENTINEL;
    }

    let typesToPass = [...tableTypeFilters];
    if (advancedFilters.type.length > 0) {
      typesToPass = [...new Set([...typesToPass, ...advancedFilters.type])];
    }
    if (typesToPass.length > 0) {
      params.loan_type = typesToPass.join(',');
    }

    if (advancedFilters.location) {
      params.location = advancedFilters.location;
    }

    if (advancedFilters.minLoan !== null && advancedFilters.minLoan !== undefined) {
      params.min_loan_amount = String(advancedFilters.minLoan);
    }
    if (advancedFilters.maxLoan !== null && advancedFilters.maxLoan !== undefined) {
      params.max_loan_amount = String(advancedFilters.maxLoan);
    }

    if (advancedFilters.sortBy) {
      params.sort_by = advancedFilters.sortBy;
    }
    if (advancedFilters.sortOrder) {
      params.sort_order = advancedFilters.sortOrder;
    }

    return params;
  }
);

export const loanDashboardReducer = loanDashboardSlice.reducer;
