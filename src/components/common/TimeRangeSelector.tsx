import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import type { TimeRange, TimeRangePreset } from '../../types';
import styles from './TimeRangeSelector.module.css';

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

const presets: { value: TimeRangePreset; label: string }[] = [
  { value: '1h', label: 'Last 1 hour' },
  { value: '1d', label: 'Last day' },
  { value: '3d', label: 'Last 3 days' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range' },
];

function getTimeRangeFromPreset(preset: TimeRangePreset): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();

  switch (preset) {
    case '1h':
      start.setHours(start.getHours() - 1);
      break;
    case '1d':
      start.setDate(start.getDate() - 1);
      break;
    case '3d':
      start.setDate(start.getDate() - 3);
      break;
    case '7d':
      start.setDate(start.getDate() - 7);
      break;
    case '30d':
      start.setDate(start.getDate() - 30);
      break;
    default:
      start.setHours(start.getHours() - 1);
  }

  return { start, end };
}

function formatPresetLabel(preset: TimeRangePreset): string {
  return presets.find(p => p.value === preset)?.label || 'Last 1 hour';
}

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCustom(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePresetSelect = (preset: TimeRangePreset) => {
    if (preset === 'custom') {
      setShowCustom(true);
      return;
    }

    const { start, end } = getTimeRangeFromPreset(preset);
    onChange({ preset, start, end });
    setIsOpen(false);
  };

  const handleCustomSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const startDate = new Date(formData.get('start') as string);
    const endDate = new Date(formData.get('end') as string);

    onChange({
      preset: 'custom',
      start: startDate,
      end: endDate,
    });
    setIsOpen(false);
    setShowCustom(false);
  };

  return (
    <div className={styles.container} ref={dropdownRef}>
      <button
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <Calendar size={16} />
        <span>{formatPresetLabel(value.preset)}</span>
        <ChevronDown size={16} className={isOpen ? styles.rotated : ''} />
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          {!showCustom ? (
            <div className={styles.presets}>
              {presets.map((preset) => (
                <button
                  key={preset.value}
                  className={`${styles.presetItem} ${value.preset === preset.value ? styles.active : ''}`}
                  onClick={() => handlePresetSelect(preset.value)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          ) : (
            <form className={styles.customForm} onSubmit={handleCustomSubmit}>
              <div className={styles.formGroup}>
                <label>Start</label>
                <input
                  type="datetime-local"
                  name="start"
                  defaultValue={value.start.toISOString().slice(0, 16)}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>End</label>
                <input
                  type="datetime-local"
                  name="end"
                  defaultValue={value.end.toISOString().slice(0, 16)}
                  required
                />
              </div>
              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setShowCustom(false)}
                >
                  Back
                </button>
                <button type="submit" className={styles.applyBtn}>
                  Apply
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
