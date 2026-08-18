'use client';

import { PHONE_NUMBER_MAX_LENGTH } from '@/features/seller/constants/field-limits';
import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { FormCard } from './FormCard';

export interface ContactFields {
  registered_email: string;
  registered_phone: string;
}

interface ContactDetailsSectionProps {
  fields: ContactFields;
  onChange: (fields: Partial<ContactFields>) => void;
  isAgreed: boolean;
  setIsAgreed: (agreed: boolean) => void;
}

export function ContactDetailsSection({ fields, onChange, isAgreed, setIsAgreed }: ContactDetailsSectionProps) {
  const [isPhoneDropdownOpen, setIsPhoneDropdownOpen] = useState(false);
  const [selectedPhoneCode, setSelectedPhoneCode] = useState('+255');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsPhoneDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <FormCard title="Contact Details" bodyClassName="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <label className="text-[14px] font-semibold text-[#374151]">
            Work email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            autoComplete="off"
            value={fields.registered_email}
            onChange={(e) => onChange({ registered_email: e.target.value })}
            placeholder="Enter email address"
            className="w-full px-3 py-2.5 bg-white border border-[#D1D5DB] rounded-lg text-[14px] text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20 focus:border-[#16A34A] transition-all placeholder:text-[#9CA3AF]"
          />
          <span className="text-[12px] text-[#6B7280]">Use your work email — this will be your portal login</span>
        </div>

        <div className="space-y-1.5">
          <label className="text-[14px] font-semibold text-[#374151]">
            Phone <span className="text-red-500">*</span>
          </label>
          <div className="flex space-x-3">
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsPhoneDropdownOpen(!isPhoneDropdownOpen)}
                className={`flex items-center justify-between w-[100px] px-3 py-2.5 bg-white border rounded-lg text-[14px] text-[#1F2937] focus:outline-none transition-all ${
                  isPhoneDropdownOpen ? 'border-[#16A34A] ring-2 ring-[#16A34A]/20' : 'border-[#D1D5DB]'
                }`}
              >
                <span>{selectedPhoneCode}</span>
                <ChevronDown size={16} className={`text-[#6B7280] transition-transform duration-200 ${isPhoneDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              <div
                className={`absolute top-full left-0 mt-1 w-full bg-white border border-[#E5E7EB] rounded-lg shadow-lg overflow-hidden z-10 transition-all duration-200 origin-top ${
                  isPhoneDropdownOpen
                    ? 'opacity-100 scale-y-100'
                    : 'opacity-0 scale-y-0 pointer-events-none'
                }`}
              >
                {['+255', '+251', '+1'].map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      setSelectedPhoneCode(code);
                      setIsPhoneDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-[14px] hover:bg-gray-50 transition-colors ${
                      selectedPhoneCode === code ? 'bg-[#F0FDF4] text-[#16A34A] font-medium' : 'text-[#374151]'
                    }`}
                  >
                    {code}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="tel"
              autoComplete="off"
              maxLength={PHONE_NUMBER_MAX_LENGTH}
              placeholder="Enter Phone Number"
              value={fields.registered_phone.startsWith(selectedPhoneCode) ? fields.registered_phone.slice(selectedPhoneCode.length).trimStart() : fields.registered_phone}
              onChange={(e) => {
                const inputDigits = e.target.value;
                onChange({ registered_phone: inputDigits ? `${selectedPhoneCode}${inputDigits}` : '' });
              }}
              className="flex-1 px-3 py-2.5 bg-white border border-[#D1D5DB] rounded-lg text-[14px] text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20 focus:border-[#16A34A] transition-all placeholder:text-[#9CA3AF]"
            />
          </div>
        </div>
      </div>

      <div className="flex items-start space-x-3 pt-2">
        <div className="flex items-center h-5 mt-0.5">
          <input
            id="terms"
            type="checkbox"
            checked={isAgreed}
            onChange={(e) => setIsAgreed(e.target.checked)}
            className="w-4 h-4 border border-[#D1D5DB] rounded bg-white checked:bg-[#16A34A] checked:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 cursor-pointer accent-[#16A34A] transition-transform duration-200 ease-in-out hover:scale-110 active:scale-95"
          />
        </div>
        <label htmlFor="terms" className="text-[14px] text-[#4B5563] leading-relaxed cursor-pointer">
          I confirm I am authorised to register this organisation and agree to the{' '}
          <a href="#" className="text-[#16A34A] hover:underline font-medium">OAN Privacy Policy</a>
          . I understand that network participation is subject to the{' '}
          <a href="#" className="text-[#16A34A] hover:underline font-medium">OAN Network Participation Agreement</a>
          , which I will review and accept before going live.
        </label>
      </div>
    </FormCard>
  );
}
