import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import styles from './Dropdown.module.css';

interface DropdownOption {
  value: string | number;
  label: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value: (string | number)[];
  onChange: (value: (string | number)[]) => void;
  label?: string;
  placeholder?: string;
  multiple?: boolean;
  searchable?: boolean;
  selectAllLabel?: string;
  color?: string;
  allowNone?: boolean;
  noneLabel?: string;
  isNone?: boolean;
  onNoneChange?: (isNone: boolean) => void;
}

export function Dropdown({
  options,
  value,
  onChange,
  label,
  placeholder = 'Select...',
  multiple = false,
  searchable = false,
  selectAllLabel = 'All selected',
  color,
  allowNone = false,
  noneLabel = 'No ASN',
  isNone = false,
  onNoneChange,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = searchable && search
    ? options.filter(opt =>
        opt.label.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  const allSelected = value.length === options.length || value.length === 0;

  const handleOptionClick = (optionValue: string | number) => {
    // Re-enable the stage if selecting an ASN while in "No ASN" mode
    if (isNone && onNoneChange) onNoneChange(false);

    if (multiple) {
      if (value.includes(optionValue)) {
        onChange(value.filter(v => v !== optionValue));
      } else {
        onChange([...value, optionValue]);
      }
    } else {
      onChange([optionValue]);
      setIsOpen(false);
    }
  };

  const handleSelectAll = () => {
    if (allSelected) {
      onChange([]);
    } else {
      onChange(options.map(opt => opt.value));
    }
  };

  const handleNoneClick = () => {
    if (onNoneChange) {
      onNoneChange(!isNone);
    }
  };

  const displayValue = () => {
    if (isNone) return noneLabel;
    if (value.length === 0 || allSelected) {
      return selectAllLabel;
    }
    if (value.length === 1) {
      return options.find(opt => opt.value === value[0])?.label || placeholder;
    }
    return `${value.length} selected`;
  };

  return (
    <div className={styles.container} ref={dropdownRef}>
      {label && (
        <span className={styles.label} style={color ? { color } : undefined}>
          {label}
        </span>
      )}
      <button
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        style={color ? { borderColor: color } : undefined}
      >
        {color && <span className={styles.colorDot} style={{ backgroundColor: color }} />}
        <span className={styles.value}>{displayValue()}</span>
        <ChevronDown size={16} className={isOpen ? styles.rotated : ''} />
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          {searchable && (
            <div className={styles.searchWrapper}>
              <Search size={16} />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={styles.searchInput}
                autoFocus
              />
            </div>
          )}

          <div className={styles.options}>
            {allowNone && (
              <button
                className={`${styles.option} ${isNone ? styles.selected : ''}`}
                onClick={handleNoneClick}
              >
                <span className={styles.checkbox}>
                  {isNone && <Check size={14} />}
                </span>
                <span>{noneLabel}</span>
              </button>
            )}

            {multiple && (
              <button
                className={`${styles.option} ${!isNone && allSelected ? styles.selected : ''}`}
                onClick={() => {
                  if (isNone && onNoneChange) onNoneChange(false);
                  handleSelectAll();
                }}
              >
                <span className={styles.checkbox}>
                  {!isNone && allSelected && <Check size={14} />}
                </span>
                <span>Select All</span>
              </button>
            )}

            {filteredOptions.map((option) => {
              const isSelected = value.includes(option.value);
              return (
                <button
                  key={option.value}
                  className={`${styles.option} ${isSelected ? styles.selected : ''}`}
                  onClick={() => handleOptionClick(option.value)}
                >
                  {multiple && (
                    <span className={styles.checkbox}>
                      {isSelected && <Check size={14} />}
                    </span>
                  )}
                  <span>{option.label}</span>
                </button>
              );
            })}

            {filteredOptions.length === 0 && (
              <div className={styles.noResults}>No results found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
