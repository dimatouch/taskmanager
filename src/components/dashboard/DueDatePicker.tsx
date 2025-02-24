import { useState, useRef, useEffect } from 'react';
import { Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DueDatePickerProps {
  selectedDate: string;
  onChange: (date: string | null) => void;
  variant?: 'default' | 'transparent';
  showNoDateButton?: boolean;
  showQuickButtons?: boolean;
}

interface TimeSliderProps {
  value: number;
  max: number;
  label: string;
  onChange: (value: number) => void;
}

function TimeSlider({ value, max, label, onChange }: TimeSliderProps) {
  const [localValue, setLocalValue] = useState(value);
  useEffect(() => {
    setLocalValue(value);
  }, [value]);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-gray-500">{label}</span>
        <span className="text-[11px] font-medium text-gray-900">
          {String(localValue).padStart(2, '0')}
        </span>
      </div>
      <input
        type="range"
        min="0"
        max={max}
        value={localValue}
        onChange={(e) => setLocalValue(Number(e.target.value))}
        onMouseUp={() => onChange(localValue)}
        onTouchEnd={() => onChange(localValue)}
        className={cn(
          "w-full h-1 rounded-lg appearance-none cursor-pointer",
          "bg-indigo-100",
          "focus:outline-none focus:ring-2 focus:ring-indigo-500/20",
          "[&::-webkit-slider-thumb]:appearance-none",
          "[&::-webkit-slider-thumb]:w-3",
          "[&::-webkit-slider-thumb]:h-3",
          "[&::-webkit-slider-thumb]:rounded-full",
          "[&::-webkit-slider-thumb]:bg-indigo-600",
          "[&::-webkit-slider-thumb]:border-2",
          "[&::-webkit-slider-thumb]:border-white",
          "[&::-webkit-slider-thumb]:shadow-sm",
          "[&::-webkit-slider-thumb]:transition-all",
          "[&::-webkit-slider-thumb]:hover:border-indigo-100",
          "[&::-webkit-slider-thumb]:hover:bg-indigo-700",
          "[&::-moz-range-thumb]:appearance-none",
          "[&::-moz-range-thumb]:w-3",
          "[&::-moz-range-thumb]:h-3",
          "[&::-moz-range-thumb]:rounded-full",
          "[&::-moz-range-thumb]:bg-indigo-600",
          "[&::-moz-range-thumb]:border-2",
          "[&::-moz-range-thumb]:border-white",
          "[&::-moz-range-thumb]:shadow-sm",
          "[&::-moz-range-thumb]:transition-all",
          "[&::-moz-range-thumb]:hover:border-indigo-100",
          "[&::-moz-range-thumb]:hover:bg-indigo-700"
        )}
      />
    </div>
  );
}

export function DueDatePicker({
  selectedDate,
  onChange,
  variant = 'default',
  showNoDateButton = false,
  showQuickButtons = true,
}: DueDatePickerProps) {
  // Стан для відкриття панелі вибору дати
  const [dueDateOpen, setDueDateOpen] = useState(false);

  // Якщо selectedDate не встановлено – використовуємо поточну дату
  const initialDate = selectedDate ? new Date(selectedDate) : new Date();
  const [draftDate, setDraftDate] = useState<Date>(initialDate);
  const [currentMonth, setCurrentMonth] = useState<number>(draftDate.getMonth());
  const [currentYear, setCurrentYear] = useState<number>(draftDate.getFullYear());
  const [hours, setHours] = useState<number>(draftDate.getHours());
  const [minutes, setMinutes] = useState<number>(draftDate.getMinutes());

  const calendarRef = useRef<HTMLDivElement>(null);

  // Обчислення для календаря
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const handleQuickDeadline = (type: string) => {
    const now = new Date();
    let targetDate = new Date(now);
    switch (type) {
      case '3hours':
        targetDate.setHours(now.getHours() + 3);
        break;
      case 'today18':
        targetDate.setHours(18, 0, 0);
        break;
      case 'tomorrow12':
        targetDate.setDate(now.getDate() + 1);
        targetDate.setHours(12, 0, 0);
        break;
      case 'tomorrow18':
        targetDate.setDate(now.getDate() + 1);
        targetDate.setHours(18, 0, 0);
        break;
      case '3days':
        targetDate.setDate(now.getDate() + 3);
        break;
      case '7days':
        targetDate.setDate(now.getDate() + 7);
        break;
      default:
        break;
    }
    onChange(targetDate.toISOString());
    setDraftDate(targetDate);
    setCurrentMonth(targetDate.getMonth());
    setCurrentYear(targetDate.getFullYear());
    setHours(targetDate.getHours());
    setMinutes(targetDate.getMinutes());
    setDueDateOpen(false);
  };

  const handleDaySelect = (day: number) => {
    const newDate = new Date(currentYear, currentMonth, day);
    // Keep hours and minutes from existing date if available
    if (selectedDate) {
      const existingDate = new Date(selectedDate);
      newDate.setHours(existingDate.getHours());
      newDate.setMinutes(existingDate.getMinutes());
    } else {
      newDate.setHours(hours);
      newDate.setMinutes(minutes);
    }
    // Ensure we keep timezone info
    const isoString = newDate.toISOString();
    onChange(isoString);
    setDraftDate(newDate);
  };

  const handleTimeChange = (newHours: number, newMinutes: number) => {
    setHours(newHours);
    setMinutes(newMinutes);
    const newDate = new Date(draftDate);
    newDate.setHours(newHours);
    newDate.setMinutes(newMinutes);
    // Ensure we keep timezone info
    const isoString = newDate.toISOString();
    onChange(isoString);
    setDraftDate(newDate);
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    const date = new Date(selectedDate);
    return (
      date.getDate() === day &&
      date.getMonth() === currentMonth &&
      date.getFullYear() === currentYear
    );
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === currentMonth &&
      today.getFullYear() === currentYear
    );
  };

  // Закриття панелі при кліку поза нею
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setDueDateOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={calendarRef}>
      {/* Кнопка-тригер: натиснувши, відкривається панель вибору */}
      <button
        type="button"
        onClick={() => setDueDateOpen(true)}
        className={cn(
          "flex items-center p-1 rounded-full transition-all duration-200 w-full",
          variant === 'default' && "bg-gray-100 hover:bg-gray-200",
          variant === 'transparent' && "hover:bg-gray-50"
        )}
      >
        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
        </div>
        <div className="flex flex-col ml-1.5">
          <span className="text-xs text-gray-500">
            {selectedDate
              ? new Date(selectedDate).toLocaleDateString()
              : "No date"}
          </span>
          {selectedDate && (
            <span className="text-[10px] text-gray-400">
              {new Date(selectedDate).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>
      </button>
  
      {/* Панель вибору дати, яка відкривається при натисканні */}
      {dueDateOpen && (
        <div className="absolute top-full left-0 mt-1 w-[260px] bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-[9999] text-[13px]">
          <div className="space-y-4">
            {showQuickButtons && (
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => handleQuickDeadline('3hours')}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  In 3 hours
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDeadline('today18')}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Today 18:00
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDeadline('tomorrow12')}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Tomorrow 12:00
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDeadline('tomorrow18')}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Tomorrow 18:00
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDeadline('3days')}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  In 3 days
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDeadline('7days')}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  In 7 days
                </button>
              </div>
            )}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="font-medium text-gray-900">
                  {monthNames[currentMonth]} {currentYear}
                </span>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={handlePrevMonth}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleNextMonth}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-0.5 mt-1">
                {days.map((day) => (
                  <div
                    key={day}
                    className="text-center text-[11px] font-medium text-gray-500 pb-1"
                  >
                    {day.slice(0, 1)}
                  </div>
                ))}
                {Array.from({ length: firstDayOfMonth }).map((_, index) => (
                  <div key={`empty-${index}`} className="h-7" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, index) => {
                  const day = index + 1;
                  return (
                    <button
                      type="button"
                      key={day}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDaySelect(day);
                      }}
                      className={cn(
                        "h-7 w-7 rounded-full flex items-center justify-center transition-colors",
                        "hover:bg-gray-100",
                        isSelected(day) && "bg-indigo-600 text-white hover:bg-indigo-700",
                        isToday(day) && !isSelected(day) && "border border-indigo-600"
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                <TimeSlider
                  value={hours}
                  max={23}
                  label="Hours"
                  onChange={(newHours) => handleTimeChange(newHours, minutes)}
                />
                <TimeSlider
                  value={minutes}
                  max={59}
                  label="Minutes"
                  onChange={(newMinutes) => handleTimeChange(hours, newMinutes)}
                />
              </div>
              {showNoDateButton && (
                <div className="flex items-center justify-between gap-2 pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      onChange(null);
                      setDueDateOpen(false);
                    }}
                    className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}