import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import styles from './Modal.module.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackdropClick?: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showClose?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  onBackdropClick,
  title,
  children,
  size = 'md',
  showClose = true,
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
    }
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.backdrop} onClick={onBackdropClick || onClose}>
      <div
        className={`${styles.modal} ${styles[size]}`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || showClose) && (
          <div className={styles.header}>
            {title && <h2 className={styles.title}>{title}</h2>}
            {showClose && (
              <button className={styles.closeBtn} onClick={onClose}>
                <X size={20} />
              </button>
            )}
          </div>
        )}
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
