import { useRef, useCallback, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Camera, Lasso } from 'lucide-react';

interface ChartExportWrapperProps {
  children: ReactNode;
  filename?: string;
  title?: string;
}

function getFiberEchartsInstance(container: HTMLElement) {
  const echartsDiv = container.querySelector('.echarts-for-react');
  if (!echartsDiv) return null;
  const fiberKey = Object.keys(echartsDiv).find(k => k.startsWith('__reactFiber'));
  if (!fiberKey) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fiber = (echartsDiv as any)[fiberKey];
  let steps = 0;
  while (fiber && steps < 10) {
    steps++;
    if (fiber.stateNode?.getEchartsInstance) return fiber.stateNode.getEchartsInstance();
    fiber = fiber.return;
  }
  return null;
}

export function ChartExportWrapper({ children, filename = 'chart' }: ChartExportWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lassoActive, setLassoActive] = useState(false);
  const [lassoRect, setLassoRect] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const lassoStartRef = useRef<{ x: number; y: number } | null>(null);
  // Ref so handleLassoMouseUp can read the latest lassoRect without being in deps
  const lassoRectRef = useRef(lassoRect);
  lassoRectRef.current = lassoRect;

  useEffect(() => {
    if (!lassoActive) return;
    const handleGlobalMouseUp = () => { lassoStartRef.current = null; };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [lassoActive]);

  const handleLassoToggle = useCallback(() => {
    if (lassoActive) {
      setLassoActive(false);
      setLassoRect(null);
      lassoStartRef.current = null;
    } else {
      setLassoActive(true);
      setLassoRect(null);
    }
  }, [lassoActive]);

  const handleLassoMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    lassoStartRef.current = { x, y };
    setLassoRect({ x1: x, y1: y, x2: x, y2: y });
    e.preventDefault();
  }, []);

  const handleLassoMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!lassoStartRef.current) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const newRect = { x1: lassoStartRef.current.x, y1: lassoStartRef.current.y, x2: x, y2: y };
    lassoRectRef.current = newRect;
    setLassoRect(newRect);
  }, []);

  const handleLassoMouseUp = useCallback(() => {
    lassoStartRef.current = null;

    const sel = lassoRectRef.current;
    if (!sel || Math.abs(sel.x2 - sel.x1) < 5) return;

    const el = containerRef.current;
    if (!el) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const instance: any = getFiberEchartsInstance(el);
    if (!instance) return;

    // Adjust pixel coords from container-space to echarts-div-space
    const echartsDiv = el.querySelector('.echarts-for-react') as HTMLElement;
    const containerRect = el.getBoundingClientRect();
    const echartsRect = echartsDiv.getBoundingClientRect();
    const dx = echartsRect.left - containerRect.left;

    const x1 = Math.min(sel.x1, sel.x2) - dx;
    const x2 = Math.max(sel.x1, sel.x2) - dx;

    try {
      // Works for cartesian charts (time series, bar, line)
      const startVal = instance.convertFromPixel({ xAxisIndex: 0 }, x1);
      const endVal   = instance.convertFromPixel({ xAxisIndex: 0 }, x2);
      if (startVal != null && endVal != null && startVal !== endVal) {
        instance.setOption({
          xAxis: [{ min: Math.min(startVal, endVal), max: Math.max(startVal, endVal) }]
        }, false); // merge — won't clobber series/tooltip/etc.
      }
    } catch {
      // Sankey, pie, etc. — visual rect is sufficient
    }
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

      {/* Lasso overlay — captures mouse events for drawing selection rect */}
      {lassoActive && (
        <div
          style={{ position: 'absolute', inset: 0, cursor: 'crosshair', zIndex: 5 }}
          onMouseDown={handleLassoMouseDown}
          onMouseMove={handleLassoMouseMove}
          onMouseUp={handleLassoMouseUp}
        />
      )}

      {/* Selection rectangle */}
      {lassoRect && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(lassoRect.x1, lassoRect.x2),
            top: Math.min(lassoRect.y1, lassoRect.y2),
            width: Math.abs(lassoRect.x2 - lassoRect.x1),
            height: Math.abs(lassoRect.y2 - lassoRect.y1),
            border: '1.5px dashed #6366F1',
            background: 'rgba(99, 102, 241, 0.08)',
            pointerEvents: 'none',
            zIndex: 6,
          }}
        />
      )}

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
