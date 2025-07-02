import React, { ReactNode, ChangeEvent } from 'react';

// DatesProvider component
interface DatesProviderProps {
  children: ReactNode;
  settings?: {
    locale?: string;
    firstDayOfWeek?: number;
    weekendDays?: number[];
    timezone?: string;
  };
}

export const DatesProvider: React.FC<DatesProviderProps> = ({ children, settings }) => {
  return (
    <div data-testid="mantine-dates-provider" data-settings={JSON.stringify(settings)}>
      {children}
    </div>
  );
};

// DateInput component
interface DateInputProps {
  label?: ReactNode;
  placeholder?: string;
  value?: Date | null | undefined;
  onChange?: (value: Date | null) => void;
  minDate?: Date | null | undefined;
  maxDate?: Date | null | undefined;
  disabled?: boolean;
  error?: ReactNode;
  format?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  clearable?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  'aria-label'?: string;
}

export const DateInput: React.FC<DateInputProps> = ({
  label,
  placeholder,
  value,
  onChange,
  minDate,
  maxDate,
  disabled,
  error,
  format = 'YYYY-MM-DD',
  size,
  clearable,
  required,
  id,
  name,
  'aria-label': ariaLabel
}) => {
  const inputId = id || `date-input-${Math.random().toString(36).substr(2, 9)}`;
  
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;
    if (onChange) {
      if (inputValue) {
        const date = new Date(inputValue);
        onChange(isNaN(date.getTime()) ? null : date);
      } else {
        onChange(null);
      }
    }
  };
  
  const formatValue = (date: Date | null | undefined) => {
    if (!date) return '';
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  };
  
  return (
    <div data-testid="mantine-date-input">
      {label && <label htmlFor={inputId}>{label}</label>}
      <div style={{ position: 'relative' }}>
        <input
          id={inputId}
          name={name}
          type="date"
          placeholder={placeholder}
          value={formatValue(value)}
          onChange={handleChange}
          disabled={disabled}
          required={required}
          data-size={size}
          aria-label={ariaLabel || label?.toString()}
          min={minDate ? formatValue(minDate) : undefined}
          max={maxDate ? formatValue(maxDate) : undefined}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            fontFamily: 'inherit',
            fontSize: 'inherit'
          }}
        />
        {clearable && value && (
          <button
            type="button"
            onClick={() => onChange?.(null)}
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            ×
          </button>
        )}
      </div>
      {error && <div data-testid="date-input-error" style={{ color: 'red', fontSize: '0.875rem', marginTop: '4px' }}>{error}</div>}
    </div>
  );
};

// DatePickerInput component (alias for DateInput)
export const DatePickerInput = DateInput;

// DatePicker component
interface DatePickerProps {
  value?: Date | null;
  onChange?: (value: Date | null) => void;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  firstDayOfWeek?: number;
  weekendDays?: number[];
  locale?: string;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  minDate,
  maxDate,
  disabled,
  size,
  firstDayOfWeek = 0,
  weekendDays = [0, 6],
  locale = 'en'
}) => {
  const today = new Date();
  const displayDate = value || today;
  
  const handleDateClick = (date: Date) => {
    if (disabled) return;
    if (minDate && date < minDate) return;
    if (maxDate && date > maxDate) return;
    onChange?.(date);
  };
  
  // Simple calendar grid (7x6 for full month view)
  const generateCalendarDays = () => {
    const year = displayDate.getFullYear();
    const month = displayDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - ((firstDay.getDay() - firstDayOfWeek + 7) % 7));
    
    const days = [];
    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      days.push(currentDate);
    }
    
    return days;
  };
  
  const calendarDays = generateCalendarDays();
  
  return (
    <div data-testid="mantine-date-picker" data-size={size} data-locale={locale}>
      <div data-testid="date-picker-header">
        <button onClick={() => {
          const prevMonth = new Date(displayDate);
          prevMonth.setMonth(prevMonth.getMonth() - 1);
          onChange?.(prevMonth);
        }}>
          ←
        </button>
        <span>{displayDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</span>
        <button onClick={() => {
          const nextMonth = new Date(displayDate);
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          onChange?.(nextMonth);
        }}>
          →
        </button>
      </div>
      
      <div data-testid="date-picker-calendar" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} style={{ textAlign: 'center', fontWeight: 'bold', padding: '8px' }}>
            {day}
          </div>
        ))}
        
        {calendarDays.map((date, index) => {
          const isSelected = value && date.toDateString() === value.toDateString();
          const isToday = date.toDateString() === today.toDateString();
          const isDisabled = disabled || 
            (minDate && date < minDate) || 
            (maxDate && date > maxDate);
          
          return (
            <button
              key={index}
              onClick={() => handleDateClick(date)}
              disabled={isDisabled}
              data-testid={`date-picker-day-${date.getDate()}`}
              style={{
                padding: '8px',
                border: 'none',
                borderRadius: '4px',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                backgroundColor: isSelected ? '#007bff' : isToday ? '#f8f9fa' : 'transparent',
                color: isSelected ? 'white' : isDisabled ? '#ccc' : 'inherit'
              }}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// TimeInput component
interface TimeInputProps {
  label?: ReactNode;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  error?: ReactNode;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  withSeconds?: boolean;
  format?: '12' | '24';
  required?: boolean;
  id?: string;
}

export const TimeInput: React.FC<TimeInputProps> = ({
  label,
  placeholder,
  value,
  onChange,
  disabled,
  error,
  size,
  withSeconds = false,
  format = '24',
  required,
  id
}) => {
  const inputId = id || `time-input-${Math.random().toString(36).substr(2, 9)}`;
  
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange?.(event.target.value);
  };
  
  return (
    <div data-testid="mantine-time-input">
      {label && <label htmlFor={inputId}>{label}</label>}
      <input
        id={inputId}
        type="time"
        placeholder={placeholder}
        value={value || ''}
        onChange={handleChange}
        disabled={disabled}
        required={required}
        data-size={size}
        step={withSeconds ? 1 : 60}
        style={{
          width: '100%',
          padding: '8px 12px',
          border: '1px solid #ced4da',
          borderRadius: '4px',
          fontFamily: 'inherit',
          fontSize: 'inherit'
        }}
      />
      {error && <div data-testid="time-input-error" style={{ color: 'red', fontSize: '0.875rem', marginTop: '4px' }}>{error}</div>}
    </div>
  );
};

// DateTimePicker component
interface DateTimePickerProps {
  label?: ReactNode;
  placeholder?: string;
  value?: Date | null | undefined;
  onChange?: (value: Date | null) => void;
  disabled?: boolean;
  error?: ReactNode;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  withSeconds?: boolean;
  clearable?: boolean;
  required?: boolean;
  id?: string;
}

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  label,
  placeholder,
  value,
  onChange,
  disabled,
  error,
  size,
  withSeconds = false,
  clearable,
  required,
  id
}) => {
  const inputId = id || `datetime-input-${Math.random().toString(36).substr(2, 9)}`;
  
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;
    if (onChange) {
      if (inputValue) {
        const date = new Date(inputValue);
        onChange(isNaN(date.getTime()) ? null : date);
      } else {
        onChange(null);
      }
    }
  };
  
  const formatValue = (date: Date | null | undefined) => {
    if (!date) return '';
    const isoString = date.toISOString();
    return withSeconds ? isoString.slice(0, 19) : isoString.slice(0, 16);
  };
  
  return (
    <div data-testid="mantine-datetime-picker">
      {label && <label htmlFor={inputId}>{label}</label>}
      <div style={{ position: 'relative' }}>
        <input
          id={inputId}
          type="datetime-local"
          placeholder={placeholder}
          value={formatValue(value)}
          onChange={handleChange}
          disabled={disabled}
          required={required}
          data-size={size}
          step={withSeconds ? 1 : 60}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            fontFamily: 'inherit',
            fontSize: 'inherit'
          }}
        />
        {clearable && value && (
          <button
            type="button"
            onClick={() => onChange?.(null)}
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            ×
          </button>
        )}
      </div>
      {error && <div data-testid="datetime-input-error" style={{ color: 'red', fontSize: '0.875rem', marginTop: '4px' }}>{error}</div>}
    </div>
  );
};

// Export all components
export default {
  DatesProvider,
  DateInput,
  DatePickerInput,
  DatePicker,
  TimeInput,
  DateTimePicker
};