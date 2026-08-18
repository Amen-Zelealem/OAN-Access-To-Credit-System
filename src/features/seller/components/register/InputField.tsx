import React from 'react';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
}

export function InputField({ 
  label, 
  required = false, 
  hint, 
  className = "",
  ...props 
}: InputFieldProps) {
  return (
    <div className={`space-y-1.5 flex flex-col ${className}`}>
      <label className="text-[14px] font-semibold text-[#374151]">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        autoComplete="off"
        {...props}
        className="w-full px-3 py-2.5 bg-white border border-[#D1D5DB] rounded-lg text-[14px] text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20 focus:border-[#16A34A] transition-all placeholder:text-[#9CA3AF]"
      />
      {hint && <span className="text-[12px] text-[#6B7280]">{hint}</span>}
    </div>
  );
}
