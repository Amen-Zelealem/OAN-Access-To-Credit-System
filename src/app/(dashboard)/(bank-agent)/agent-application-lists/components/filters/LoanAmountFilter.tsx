'use client';

import { Portal } from '@/components/Portal';
import { Check, Filter } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface LoanAmountFilterProps {
  selectedValues: string[];
  onChange: (selected: string[]) => void;
}

export default function LoanAmountFilter({ selectedValues, onChange }: LoanAmountFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const [tempSelected, setTempSelected] = useState<string[]>(selectedValues);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  const handleSliderInteraction = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    let newMaxIndex = Math.round(percent * 4);

    // Clamp to 1 so the slider doesn't collapse to 0% (which would mean 0 ETB)
    if (newMaxIndex === 0) newMaxIndex = 1;

    if (newMaxIndex === 4) {
      setTempSelected(rangeOptions);
    } else {
      setTempSelected(rangeOptions.slice(0, newMaxIndex));
    }
  };

  const rangeOptions = [
    '0 - 25,000',
    '25,001 - 50,000',
    '50,001 - 1,00,000',
    '1,00,000 and above'
  ];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
        menuRef.current && !menuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    const updatePosition = () => {
      if (dropdownRef.current) {
        const rect = dropdownRef.current.getBoundingClientRect();
        setDropdownPos({
          top: rect.bottom + window.scrollY + 8,
          left: rect.left + window.scrollX
        });
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  const toggleOption = (option: string) => {
    if (option === 'All') {
      if (tempSelected.length === rangeOptions.length) {
        setTempSelected([]);
      } else {
        setTempSelected([...rangeOptions]);
      }
      return;
    }

    if (tempSelected.includes(option)) {
      setTempSelected(tempSelected.filter(o => o !== option));
    } else {
      setTempSelected([...tempSelected, option]);
    }
  };

  const handleClear = () => {
    setTempSelected([]);
  };

  const handleApply = () => {
    onChange(tempSelected);
    setIsOpen(false);
  };

  const handleClick = () => {
    if (!isOpen && dropdownRef.current) {
      // Opening: start the draft (and so the slider position) from the committed
      // selection. Previously an effect on [isOpen, selectedValues] — which also
      // re-ran on any `selectedValues` identity change, wiping an in-progress
      // slider drag. Resetting draft state where the menu is opened is narrower
      // and is the documented React pattern.
      setTempSelected(selectedValues);

      const rect = dropdownRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX
      });
    }
    setIsOpen(!isOpen);
  };

  // Dynamic Slider Logic
  const stepValues = [0, 25000, 50000, 100000, 1000000];
  let displayMaxIndex = 4;

  if (tempSelected.length > 0) {
    const selectedIndices = tempSelected.map(opt => rangeOptions.indexOf(opt)).filter(i => i !== -1);
    if (selectedIndices.length > 0) {
      displayMaxIndex = Math.max(...selectedIndices) + 1;
    }
  }

  const maxPercent = displayMaxIndex * 25;
  const maxLabel = (stepValues[displayMaxIndex] ?? 0).toLocaleString();

  return (
    <div ref={dropdownRef} className="inline-block">
      <div
        className="flex items-center gap-1.5 cursor-pointer select-none text-gray-500 hover:text-gray-700 transition-colors"
        onClick={handleClick}
      >
        LOAN AMOUNT (ETB) <Filter className={`w-3.5 h-3.5 transition-colors ${isOpen || selectedValues.length > 0 ? 'text-[#16A34A]' : ''}`} />
      </div>

      {isOpen && (
        <Portal>
          <div
            ref={menuRef}
            style={{ top: dropdownPos.top, left: dropdownPos.left }}
            className="absolute bg-white border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-xl overflow-hidden z-[100] w-[340px] flex flex-col animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Header */}
            <div className="px-6 py-4">
              <span className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">Loan Amount</span>
            </div>

            {/* Slider Section */}
            <div className="px-6 pt-2 pb-6 border-b border-gray-100">
              <div
                ref={sliderRef}
                className="relative h-2.5 bg-gray-100 rounded-full w-full mb-6 cursor-pointer touch-none"
                onPointerDown={(e) => {
                  e.preventDefault();
                  sliderRef.current?.setPointerCapture(e.pointerId);
                  handleSliderInteraction(e);
                }}
                onPointerMove={(e) => {
                  if (e.buttons === 1) {
                    handleSliderInteraction(e);
                  }
                }}
              >
                <div
                  className="absolute top-0 left-0 h-full bg-[#16A34A] rounded-full transition-all duration-75"
                  style={{ width: `${maxPercent}%` }}
                ></div>
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 bg-white border-2 border-[#16A34A] rounded-full shadow-sm cursor-grab active:cursor-grabbing transition-all duration-75 z-10 hover:scale-110"
                  style={{ left: `${maxPercent}%` }}
                ></div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex flex-col items-start min-w-[50px]">
                  <span className="text-[10px] font-bold text-gray-400">ETB</span>
                  <span className="text-[13px] font-bold text-gray-600">0</span>
                </div>

                <button
                  onClick={() => toggleOption('All')}
                  className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-colors whitespace-nowrap ${tempSelected.length === rangeOptions.length || tempSelected.length === 0 ? 'bg-emerald-50 text-[#16A34A]' : 'bg-gray-50 text-gray-500 hover:bg-emerald-50 hover:text-[#16A34A]'
                    }`}
                >
                  All Amounts
                </button>

                <div className="flex flex-col items-end min-w-[50px]">
                  <span className="text-[10px] font-bold text-gray-400">ETB</span>
                  <span className="text-[13px] font-bold text-gray-600">{maxLabel}</span>
                </div>
              </div>
            </div>

            {/* Range Options */}
            <div className="flex flex-col py-2 max-h-[250px] overflow-y-auto">
              {/* All Option */}
              <div
                onClick={() => toggleOption('All')}
                className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 cursor-pointer text-[14px] font-medium text-gray-700 select-none group transition-colors"
              >
                <div
                  className={`w-5 h-5 shrink-0 rounded-[4px] border flex items-center justify-center transition-all duration-200 ${tempSelected.length === rangeOptions.length ? 'bg-[#16A34A] border-[#16A34A]' : 'border-gray-300 group-hover:border-[#16A34A]/50'
                    }`}
                >
                  <Check
                    className={`w-3.5 h-3.5 text-white transition-all duration-200 ${tempSelected.length === rangeOptions.length ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
                      }`}
                    strokeWidth={3}
                  />
                </div>
                All
              </div>

              {/* Individual Options */}
              {rangeOptions.map(option => {
                const isSelected = tempSelected.includes(option);
                return (
                  <div
                    key={option}
                    onClick={() => toggleOption(option)}
                    className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 cursor-pointer text-[14px] font-medium text-gray-700 select-none group transition-colors"
                  >
                    <div
                      className={`w-5 h-5 shrink-0 rounded-[4px] border flex items-center justify-center transition-all duration-200 ${isSelected ? 'bg-[#16A34A] border-[#16A34A]' : 'border-gray-300 group-hover:border-[#16A34A]/50'
                        }`}
                    >
                      <Check
                        className={`w-3.5 h-3.5 text-white transition-all duration-200 ${isSelected ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
                          }`}
                        strokeWidth={3}
                      />
                    </div>
                    {option}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
              <button
                onClick={handleClear}
                className="text-[14px] font-semibold text-gray-500 hover:text-gray-700 transition-colors"
              >
                <span className='font-semibold'>Clear</span>
              </button>
              <button
                onClick={handleApply}
                className="bg-[#16A34A] hover:bg-[#15803d] text-white px-6 py-2 rounded-lg text-[14px] font-semibold transition-colors shadow-sm"
              >
                <span className='font-semibold'>Apply</span>
              </button>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
