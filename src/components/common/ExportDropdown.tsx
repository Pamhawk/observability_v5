import { useState, useRef, useEffect } from 'react';
import { Download } from 'lucide-react';
import { Button } from './Button';
import styles from './ExportDropdown.module.css';

type ExportFormat = 'pdf' | 'html' | 'csv' | 'json';

interface ExportDropdownProps {
  onExport?: (format: ExportFormat) => void;
  formats?: ExportFormat[];
}

const defaultFormats: ExportFormat[] = ['pdf', 'html', 'csv', 'json'];

const formatLabels: Record<ExportFormat, string> = {
  pdf: 'PDF',
  html: 'HTML',
  csv: 'CSV',
  json: 'JSON',
};

export function ExportDropdown({ onExport, formats = defaultFormats }: ExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = (format: ExportFormat) => {
    setIsOpen(false);
    if (onExport) {
      onExport(format);
      return;
    }
    // Default export behavior
    switch (format) {
      case 'pdf':
        window.print();
        break;
      case 'html': {
        const html = document.documentElement.outerHTML;
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'export.html';
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        break;
      }
      case 'csv': {
        // Placeholder — collect visible table data or summary
        const blob = new Blob(['No data to export'], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'export.csv';
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        break;
      }
      case 'json': {
        const blob = new Blob(['{}'], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'export.json';
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        break;
      }
    }
  };

  return (
    <div className={styles.container} ref={ref}>
      <Button
        variant="secondary"
        size="sm"
        icon={<Download size={16} />}
        onClick={() => setIsOpen(!isOpen)}
      >
        Export
      </Button>
      {isOpen && (
        <div className={styles.dropdown}>
          {formats.map(fmt => (
            <button
              key={fmt}
              className={styles.option}
              onClick={() => handleExport(fmt)}
            >
              {formatLabels[fmt]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
