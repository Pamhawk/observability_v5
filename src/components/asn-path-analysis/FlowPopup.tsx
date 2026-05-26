import { useState } from 'react';
import { Modal, Toggle, ExportDropdown } from '../common';
import { BarChart, ChartExportWrapper } from '../charts';
import { protocolData, topApplications, sankeyNodes } from '../../data/mockData';
import type { SankeyLink } from '../../types';
import styles from './FlowPopup.module.css';

interface FlowPopupProps {
  isOpen: boolean;
  onClose: () => void;
  link: SankeyLink | null;
}

type TrafficDirection = 'inbound' | 'outbound';

export function FlowPopup({ isOpen, onClose, link }: FlowPopupProps) {
  const [direction, setDirection] = useState<TrafficDirection>('inbound');
  const [unit, setUnit] = useState<'bps' | 'pps'>('bps');

  if (!link) return null;

  const sourceNode = sankeyNodes.find(n => n.id === link.source);
  const targetNode = sankeyNodes.find(n => n.id === link.target);

  const flowName = `${sourceNode?.name} (${sourceNode?.asnNumber}) → ${targetNode?.name} (${targetNode?.asnNumber})`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={flowName} size="lg">
      <div className={styles.content}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--spacing-sm)' }}>
          <ExportDropdown />
        </div>
        {/* Flow Summary KPIs — top of popup */}
        <div className={styles.summary}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Total Traffic</span>
            <span className={styles.summaryValue}>{link.trafficGbps.toFixed(1)} Gbps</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Top Protocol</span>
            <span className={styles.summaryValue}>{link.topProtocol}</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Top Application</span>
            <span className={styles.summaryValue}>
              {link.topApplication.name} ({link.topApplication.port}) - {link.topApplication.percent}%
            </span>
          </div>
        </div>

        {/* Traffic per Protocol */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>Traffic per Protocol</h3>
            <div className={styles.controls}>
              <Toggle
                options={[
                  { value: 'inbound', label: 'Inbound' },
                  { value: 'outbound', label: 'Outbound' },
                ]}
                value={direction}
                onChange={(v) => setDirection(v as TrafficDirection)}
                size="sm"
              />
              <Toggle
                options={[
                  { value: 'bps', label: 'bps' },
                  { value: 'pps', label: 'pps' },
                ]}
                value={unit}
                onChange={(v) => setUnit(v as 'bps' | 'pps')}
                size="sm"
              />
            </div>
          </div>
          <ChartExportWrapper filename="traffic-per-protocol">
            <BarChart
              data={protocolData.map(p => ({
                name: p.name,
                value: unit === 'bps' ? p.bps / 1e9 : p.pps,
                percent: p.value,
              }))}
              height={250}
              unit={unit === 'bps' ? 'Gbps' : 'pps'}
            />
          </ChartExportWrapper>
        </div>

        {/* Top 10 Applications */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>Top 10 Applications</h3>
          </div>
          <ChartExportWrapper filename="top-applications">
            <BarChart
              data={topApplications.map(app => ({
                name: `${app.name}/${app.port}`,
                value: app.trafficBps / 1e9,
                percent: app.percent,
              }))}
              height={300}
              unit="Gbps"
              horizontal
            />
          </ChartExportWrapper>
        </div>
      </div>
    </Modal>
  );
}
