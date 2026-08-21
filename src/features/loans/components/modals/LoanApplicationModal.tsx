'use client';

import { Portal } from '@/components/Portal';
import { toast } from '@/lib/toast';
import { useModalA11y } from '@/hooks/useModalA11y';
import { CheckCircle2, ChevronDown, Loader2, Package, X, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { LoanApplicationFull } from '../../api/loan.service';
import { LoanTableRow } from '../LoanTable';
import { PINNED_OR_META_KEYS, useLoanApplicationModal } from './useLoanApplicationModal';

interface LoanApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: LoanTableRow | null;
  onStatusChange?: (id: string, status: 'Approved' | 'Rejected', reason?: string, note?: string) => void;
}

export default function LoanApplicationModal({ isOpen, onClose, data, onStatusChange }: LoanApplicationModalProps) {
  const { isLoading, fullProfile: rawProfile } = useLoanApplicationModal(isOpen, data);
  const fullProfile = rawProfile as LoanApplicationFull | null;

  const [isRejecting, setIsRejecting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [decisionReason, setDecisionReason] = useState('');
  const [decisionNote, setDecisionNote] = useState('');

  const endRef = useRef<HTMLDivElement>(null);
  const reasonSelectRef = useRef<HTMLSelectElement>(null);
  const dialogRef = useModalA11y<HTMLDivElement>(isOpen, onClose);

  useEffect(() => {
    // This modal stays mounted while closed (isOpen just gates the render via
    // the early return below), so its form state must be reset here on
    // reopen rather than relying on unmount/remount to clear stale values.
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsRejecting(false);
      setIsApproving(false);
      setDecisionReason('');
      setDecisionNote('');
    }
  }, [isOpen]);

  if (!isOpen || !data) return null;

  const statusBadgeColor =
    data.status === 'Approved'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : data.status === 'Rejected'
        ? 'bg-red-50 text-red-700 border-red-200'
        : 'bg-amber-50 text-amber-700 border-amber-200';

  const handleConfirmDecision = () => {
    if (!decisionReason) {
      toast.error('Please select a reason for your decision');
      return;
    }
    const statusToSet = isRejecting ? 'Rejected' : 'Approved';
    if (onStatusChange) {
      onStatusChange(data.id, statusToSet, decisionReason, decisionNote);
    }
    toast.success(`Application #${data.id} has been ${statusToSet.toLowerCase()}`);
    setIsRejecting(false);
    setIsApproving(false);
    onClose();
  };

  const handleActionClick = (action: 'approve' | 'reject') => {
    if (action === 'reject') {
      setIsApproving(false);
      setIsRejecting(true);
    } else {
      setIsRejecting(false);
      setIsApproving(true);
    }
    setTimeout(() => {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      reasonSelectRef.current?.focus();
    }, 100);
  };

  // Extract dynamic values safely from data & fullProfile
  const farmerName = data.applicant || (fullProfile?.first_name || fullProfile?.last_name ? `${fullProfile.first_name || ''} ${fullProfile.last_name || ''}`.trim() : '—');
  const phone = data.phone || fullProfile?.phone_number || '—';
  const loanProduct = fullProfile?.loan_product_name || '—';
  const amount = data.amount || (data.loanAmount && data.loanAmount !== '—' ? `ETB ${data.loanAmount}` : null) || (fullProfile?.loan_amount ? `ETB ${fullProfile.loan_amount.toLocaleString()}` : ('—'));
  const appliedDate = data.updated || data.creation || '—';
  const purpose = fullProfile?.loan_reason || null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="loan-application-modal-title"
        tabIndex={-1}
        className="relative flex flex-col w-full max-w-[620px] bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="loan-application-modal-title" className="text-lg font-bold text-gray-900">Application Details</h2>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                <span className="font-semibold text-gray-700">#{data.id}</span>
                <span>&bull;</span>
                <span className={`px-2 py-0.5 rounded-full font-semibold border ${statusBadgeColor}`}>
                  &bull; {data.status || 'Pending'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="px-6 py-6 overflow-y-auto max-h-[70vh] space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
              <p className="text-xs font-medium text-gray-500">Loading application details...</p>
            </div>
          ) : (
            <>
              {/* Section 1: LOAN DETAILS */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">LOAN DETAILS</h3>
                <div className="bg-[#F9FAFB] rounded-2xl p-5 border border-gray-100 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">APPLICATION ID</p>
                      <p className="text-sm font-bold text-gray-900 mt-0.5">#{data.id}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">LOAN PRODUCT</p>
                      <p className="text-sm font-bold text-gray-900 mt-0.5">{loanProduct}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">REQUESTED AMOUNT</p>
                      <p className="text-sm font-bold text-gray-900 mt-0.5">{amount}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">SUBMISSION DATE</p>
                      <p className="text-sm font-bold text-gray-900 mt-0.5">{appliedDate}</p>
                    </div>
                  </div>
                  {purpose && (
                    <div className="pt-2 border-t border-gray-200/60">
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">PURPOSE OF LOAN</p>
                      <p className="text-sm font-bold text-gray-900 mt-0.5">{purpose}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 2: FARMER DETAILS */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">FARMER DETAILS</h3>
                <div className="bg-[#F9FAFB] rounded-2xl p-5 border border-gray-100 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">FULL NAME</p>
                      <p className="text-sm font-bold text-gray-900 mt-0.5">{farmerName}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">PHONE NUMBER</p>
                      <p className="text-sm font-bold text-gray-900 mt-0.5">{phone}</p>
                    </div>

                    {fullProfile && Object.entries(fullProfile)
                      .filter(([key, value]) =>
                        !PINNED_OR_META_KEYS.has(key) && value !== null && value !== '' && typeof value !== 'object'
                      )
                      .map(([key, value]) => {
                        // Some values like source_of_income might be long, so we handle them below or let them span 2 cols if needed.
                        // Here we just render them normally. If we want them to look good, we can just use normal div.
                        return (
                          <div key={key} className={String(value).length > 40 ? "col-span-2 pt-2 border-t border-gray-200/60" : ""}>
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                              {key.replace(/_/g, ' ')}
                            </p>
                            <p className="text-sm font-bold text-gray-900 mt-0.5">
                              {String(value)}
                            </p>
                          </div>
                        );
                      })
                    }
                  </div>
                </div>
              </div>

              {/* Section 3: INTERNAL NOTES (Conditional) */}
              {fullProfile?.internal_notes && fullProfile.internal_notes.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">INTERNAL NOTES</h3>
                  <div className="space-y-2">
                    {fullProfile.internal_notes.map((note, idx: number) => (
                      <div key={idx} className="bg-[#F9FAFB] rounded-2xl p-4 border border-gray-100 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                          {note.author?.[0]?.toUpperCase() || 'N'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-bold text-gray-900">{note.author || 'Officer'}</p>
                            <span className="text-xs text-gray-400">{note.timestamp || ''}</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{note.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Decision Confirmation Form */}
              {(isRejecting || isApproving) && (
                <div className={`border-2 rounded-2xl p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200 ${isRejecting ? 'border-red-200 bg-red-50/30' : 'border-emerald-200 bg-emerald-50/30'}`}>
                  <h4 className="text-sm font-bold text-gray-900">
                    {isRejecting ? 'Confirm Rejection' : 'Confirm Approval'}
                  </h4>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Reason for Decision <span className={isRejecting ? 'text-red-500' : 'text-emerald-500'}>*</span>
                    </label>
                    <div className="relative">
                      <select
                        ref={reasonSelectRef}
                        value={decisionReason}
                        onChange={(e) => setDecisionReason(e.target.value)}
                        className={`w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 appearance-none ${isRejecting ? 'focus:ring-red-500/20 focus:border-red-500' : 'focus:ring-emerald-500/20 focus:border-emerald-500'}`}
                      >
                        <option value="">Select Reason for Decison</option>
                        {isRejecting ? (
                          <>
                            <option value="Insufficient Income">Insufficient Income</option>
                            <option value="Incomplete Documentation">Incomplete Documentation</option>
                            <option value="Eligibility Criteria Not Met">Eligibility Criteria Not Met</option>
                            <option value="High Risk Profile">High Risk Profile</option>
                          </>
                        ) : (
                          <>
                            <option value="Meets All Criteria">Meets All Criteria</option>
                            <option value="Good Credit History">Good Credit History</option>
                            <option value="Verified Income">Verified Income</option>
                            <option value="Strong Collateral">Strong Collateral</option>
                          </>
                        )}
                        <option value="Other">Other</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Add Note (Optional)
                    </label>
                    <textarea
                      rows={3}
                      value={decisionNote}
                      onChange={(e) => setDecisionNote(e.target.value)}
                      placeholder="Placeholder for notes"
                      className={`w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 ${isRejecting ? 'focus:ring-red-500/20 focus:border-red-500' : 'focus:ring-emerald-500/20 focus:border-emerald-500'}`}
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsRejecting(false);
                        setIsApproving(false);
                        setDecisionReason('');
                        setDecisionNote('');
                      }}
                      className="px-5 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl text-sm transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDecision}
                      className={`px-5 py-2 text-white font-bold rounded-xl text-sm transition-colors shadow-sm ${isRejecting ? 'bg-[#DC2626] hover:bg-[#B91C1C]' : 'bg-[#16A34A] hover:bg-[#15803d]'}`}
                    >
                      Confirm Decision
                    </button>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-white">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl text-sm transition-colors"
          >
            Close
          </button>

          {(!isRejecting && !isApproving) && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleActionClick('reject')}
                className="px-6 py-2.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold rounded-xl text-sm transition-colors flex items-center gap-2 shadow-sm"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </button>
              <button
                type="button"
                onClick={() => handleActionClick('approve')}
                className="px-6 py-2.5 bg-[#16A34A] hover:bg-[#15803d] text-white font-bold rounded-xl text-sm transition-colors flex items-center gap-2 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                Approve
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );

  return <Portal>{modalContent}</Portal>;
}
