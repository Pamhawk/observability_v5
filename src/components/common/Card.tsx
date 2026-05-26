import type { ReactNode } from 'react';
import styles from './Card.module.css';

interface CardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function Card({
  title,
  subtitle,
  children,
  actions,
  className,
  noPadding = false,
}: CardProps) {
  return (
    <div className={`${styles.card} ${className || ''}`}>
      {(title || actions) && (
        <div className={styles.header}>
          <div className={styles.titleSection}>
            {title && <h3 className={styles.title}>{title}</h3>}
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      )}
      <div className={`${styles.body} ${noPadding ? styles.noPadding : ''}`}>
        {children}
      </div>
    </div>
  );
}
