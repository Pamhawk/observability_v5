import { Card } from '../components/common';
import { TimeSeriesChart } from '../components/charts';
import { generateTrafficData } from '../data/mockData';
import styles from './EdgeProtectDashboard.module.css';

const controllers = [
  { name: 'eh-controller-8-112', cpu: 79, memory: 43, nodes: { up: 6, down: 0 } },
  { name: 'eh-controller-8-113', cpu: 67, memory: 38, nodes: { up: 5, down: 1 } },
  { name: 'eh-controller-4-104', cpu: 52, memory: 41, nodes: { up: 6, down: 0 } },
  { name: 'eh-controller-8-109', cpu: 88, memory: 55, nodes: { up: 4, down: 2 } },
  { name: 'eh-controller-8-117', cpu: 34, memory: 29, nodes: { up: 6, down: 0 } },
];

function DonutChart({ value, max, color, label }: { value: number; max?: number; color: string; label: string }) {
  const total = max || 10;
  const pct = (value / total) * 100;
  const r = 40;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className={styles.donut}>
      <svg viewBox="0 0 100 100" className={styles.donutSvg}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-border-light)" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={r} fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
        <text x="50" y="50" textAnchor="middle" dy="0.35em" className={styles.donutValue}>
          {value}
        </text>
      </svg>
      <span className={styles.donutLabel}>{label}</span>
    </div>
  );
}

function ControllerCard({ controller }: { controller: typeof controllers[0] }) {
  return (
    <Card className={styles.controllerCard}>
      <div className={styles.controllerName}>{controller.name}</div>
      <div className={styles.controllerStats}>
        <div className={styles.stat}>
          <div className={styles.statHeader}>
            <span>CPU usage</span>
            <span className={styles.statValue}>{controller.cpu}%</span>
          </div>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{
                width: `${controller.cpu}%`,
                backgroundColor: controller.cpu > 80 ? 'var(--color-error)' : 'var(--color-primary)',
              }}
            />
          </div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statHeader}>
            <span>Memory usage</span>
            <span className={styles.statValue}>{controller.memory}%</span>
          </div>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{
                width: `${controller.memory}%`,
                backgroundColor: controller.memory > 80 ? 'var(--color-error)' : 'var(--color-success)',
              }}
            />
          </div>
        </div>
        <div className={styles.nodeStatus}>
          <span className={styles.nodeUp}>{controller.nodes.up} Nodes Up</span>
          {controller.nodes.down > 0 && (
            <span className={styles.nodeDown}>{controller.nodes.down} Nodes Down</span>
          )}
        </div>
      </div>
    </Card>
  );
}

export function EdgeProtectDashboard() {
  const inboundData = generateTrafficData(24);
  const outboundData = generateTrafficData(24);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Dashboard</h1>
        <span className={styles.badge}>Secure DDoS Edge Protection</span>
      </div>

      {/* Total Traffic */}
      <Card title="Total Traffic">
        <div className={styles.trafficCharts}>
          <div className={styles.trafficChart}>
            <h4>Inbound</h4>
            <TimeSeriesChart data={inboundData} height={250} stacked />
          </div>
          <div className={styles.trafficChart}>
            <h4>Outbound</h4>
            <TimeSeriesChart data={outboundData} height={250} stacked />
          </div>
        </div>
      </Card>

      {/* Summary Cards + Controller Status */}
      <div className={styles.bottomRow}>
        <div className={styles.summaryCards}>
          <Card className={styles.summaryCard}>
            <DonutChart value={7} max={10} color="#e74c3c" label="PO Attack Severity" />
            <div className={styles.summaryLegend}>
              <span><i style={{ color: '#e74c3c' }}>&#9679;</i> 1 High</span>
              <span><i style={{ color: '#f39c12' }}>&#9679;</i> 6 Peace</span>
            </div>
          </Card>
          <Card className={styles.summaryCard}>
            <DonutChart value={3} max={5} color="#e74c3c" label="Mitigators" />
            <div className={styles.summaryLegend}>
              <span><i style={{ color: '#27ae60' }}>&#9679;</i> 2 Down</span>
              <span><i style={{ color: '#e74c3c' }}>&#9679;</i> 1 Up</span>
            </div>
          </Card>
          <Card className={styles.summaryCard}>
            <DonutChart value={8} max={10} color="#00b4d8" label="Detectors" />
            <div className={styles.summaryLegend}>
              <span><i style={{ color: '#27ae60' }}>&#9679;</i> 4 Up</span>
              <span><i style={{ color: '#f39c12' }}>&#9679;</i> 2 InProgress</span>
              <span><i style={{ color: '#e74c3c' }}>&#9679;</i> 1 Congestion</span>
            </div>
          </Card>
        </div>

        {/* Controller Status */}
        <div className={styles.controllerSection}>
          <h3>Controller Status</h3>
          <div className={styles.controllerGrid}>
            {controllers.map(c => (
              <ControllerCard key={c.name} controller={c} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
