import { useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Camera } from 'lucide-react';

interface ChartExportWrapperProps {
  children: ReactNode;
  filename?: string;
  title?: string;
}

export function ChartExportWrapper({ children, filename = 'chart' }: ChartExportWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDownloadPNG = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    // Try to find an ECharts canvas or SVG inside
    const canvas = el.querySelector('canvas') as HTMLCanvasElement | null;
    if (canvas) {
      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      return;
    }

    // Fallback: try SVG
    const svg = el.querySelector('svg');
    if (svg) {
      const svgData = new XMLSerializer().serializeToString(svg);
      const img = new Image();
      const c = document.createElement('canvas');
      const ctx = c.getContext('2d');
      if (!ctx) return;

      img.onload = () => {
        c.width = img.width;
        c.height = img.height;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0);
        const link = document.createElement('a');
        link.download = `${filename}.png`;
        link.href = c.toDataURL('image/png');
        link.click();
      };
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    }
  }, [filename]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {children}
      <button
        onClick={handleDownloadPNG}
        title="Download as PNG"
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          width: 26,
          height: 26,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.85)',
          border: '1px solid var(--color-border-light)',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          color: 'var(--color-text-secondary)',
          opacity: 0,
          transition: 'opacity 0.15s ease',
          zIndex: 10,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0'; }}
      >
        <Camera size={14} />
      </button>
      <style>{`
        div:hover > button[title="Download as PNG"] {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}
