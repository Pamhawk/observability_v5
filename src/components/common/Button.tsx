import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${styles.button} ${styles[variant]} ${styles[size]} ${className || ''}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className={styles.spinner} />
      )}
      {!loading && icon && iconPosition === 'left' && (
        <span className={styles.icon}>{icon}</span>
      )}
      {children && <span className={styles.label}>{children}</span>}
      {!loading && icon && iconPosition === 'right' && (
        <span className={styles.icon}>{icon}</span>
      )}
    </button>
  );
}
