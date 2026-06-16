import { useRef, useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { Camera, Lasso } from 'lucide-react';
import * as echarts from 'echarts';

interface ChartExportWrapperProps {
  children: ReactNode;
  filename?: string;
  title?: string;
}

export function ChartExportWrapper({ children, filename = 'chart' }: ChartExportWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lassoActive, setLassoActive] = useState(false);

  const getEchartsInstance = useCallback(() => {
    const el = containerRef.current;
    if (!el) return null;
    for (const div of Array.from(el.querySelectorAll('div'))) {
      const instance = echarts.getInstanceByDom(div as HTMLElement);
      if (instance) return instance;
    }
    return null;
  }, []);

  const handleDownloadPNG = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const canvas = el.querySelector('canvas') as HTMLCanvasElement | null;
    if (canvas) {
      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      return;
    }
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

  const activateLasso = useCallback((instance: ReturnType<typeof echarts.getInstanceByDom>) => {
    if (!instance) return;
    instance.setOption({ brush: { brushType: 'rect' } });
    instance.dispatchAction({ type: 'takeGlobalCursor', key: 'brush', brushOption: { brushType: 'rect' } });
    setLassoActive(true);
  }, []);

  const clearLasso = useCallback((instance: ReturnType<typeof echarts.getInstanceByDom>) => {
    if (!instance) return;
    instance.dispatchAction({ type: 'brush', areas: [] });
    instance.dispatchAction({ type: 'takeGlobalCursor', key: '' });
    setLassoActive(false);
  }, []);

  const handleLassoToggle = useCallback(() => {
    const instance = getEchartsInstance();
    if (!instance) return;
    if (lassoActive) clearLasso(instance);
    else activateLasso(instance);
  }, [lassoActive, getEchartsInstance, activateLasso, clearLasso]);

  const sharedBtnStyle: React.CSSProperties = {
    position: 'absolute',
    top: 4,
    width: 26,
    height: 26,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'opacity 0.15s ease',
    zIndex: 10,
  };

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      {children}

      {/* Lasso select button */}
      <button
        title="Lasso select"
        onClick={handleLassoToggle}
        style={{
          ...sharedBtnStyle,
          right: 34,
          background: lassoActive ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.85)',
          border: `1px solid ${lassoActive ? 'rgba(99,102,241,0.4)' : 'var(--color-border-light)'}`,
          color: lassoActive ? '#6366F1' : 'var(--color-text-secondary)',
          opacity: lassoActive ? 1 : 0,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
        onMouseLeave={(e) => { if (!lassoActive) (e.currentTarget as HTMLElement).style.opacity = '0'; }}
      >
        <Lasso size={14} />
      </button>

      {/* Download PNG button */}
      <button
        onClick={handleDownloadPNG}
        title="Download as PNG"
        style={{
          ...sharedBtnStyle,
          right: 4,
          background: 'rgba(255,255,255,0.85)',
          border: '1px solid var(--color-border-light)',
          color: 'var(--color-text-secondary)',
          opacity: 0,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0'; }}
      >
        <Camera size={14} />
      </button>

      <style>{`
        div:hover > button[title="Download as PNG"] { opacity: 1 !important; }
        div:hover > button[title="Lasso select"] { opacity: 1 !important; }
      `}</style>
    </div>
  );
}
