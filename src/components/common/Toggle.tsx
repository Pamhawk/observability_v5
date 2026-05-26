import styles from './Toggle.module.css';

interface ToggleOption {
  value: string;
  label: string;
}

interface ToggleProps {
  options: ToggleOption[];
  value: string;
  onChange: (value: string) => void;
  size?: 'sm' | 'md';
}

export function Toggle({ options, value, onChange, size = 'md' }: ToggleProps) {
  return (
    <div className={`${styles.toggle} ${styles[size]}`}>
      {options.map((option) => (
        <button
          key={option.value}
          className={`${styles.option} ${value === option.value ? styles.active : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
