import type { SankeyStage, CustomViewConfig } from '../../types';
import styles from './CustomViewBuilder.module.css';

const STAGE_COLORS: Record<SankeyStage, string> = {
  originASN:          '#F97316',
  previousPeer:       '#9333EA',
  upstreamPO:         '#818CF8',
  myASN:              '#14B8A6',
  myIngressInterface: '#99F6E4',
  myRouter:           '#0E9F8E',
  downstreamPO:       '#FB923C',
  nextPeer:           '#9333EA',
  destinationASN:     '#EC4899',
};

// Ordered left-to-right as they appear in the Sankey
const ALL_COLUMNS: Array<{ id: SankeyStage; label: string; group: 'left' | 'center' | 'right' }> = [
  { id: 'originASN',          label: 'Origin',        group: 'left'   },
  { id: 'previousPeer',       label: 'Prev Peer',     group: 'left'   },
  { id: 'upstreamPO',         label: 'Upstream PO',   group: 'left'   },
  { id: 'myASN',              label: 'My ASN',        group: 'center' },
  { id: 'myIngressInterface', label: 'Ingress',       group: 'center' },
  { id: 'myRouter',           label: 'Router',        group: 'center' },
  { id: 'downstreamPO',       label: 'Downstream PO', group: 'right'  },
  { id: 'nextPeer',           label: 'Next Peer',     group: 'right'  },
  { id: 'destinationASN',     label: 'Destination',   group: 'right'  },
];

function getDisabledSet(selected: Set<SankeyStage>): Set<SankeyStage> {
  const disabled = new Set<SankeyStage>();
  if (selected.has('upstreamPO')) {
    disabled.add('originASN');
    disabled.add('previousPeer');
  }
  if (selected.has('originASN') || selected.has('previousPeer')) {
    disabled.add('upstreamPO');
  }
  if (selected.has('downstreamPO')) {
    disabled.add('nextPeer');
    disabled.add('destinationASN');
  }
  if (selected.has('nextPeer') || selected.has('destinationASN')) {
    disabled.add('downstreamPO');
  }
  if (selected.has('myASN')) {
    disabled.add('myIngressInterface');
    disabled.add('myRouter');
  }
  if (selected.has('myIngressInterface') || selected.has('myRouter')) {
    disabled.add('myASN');
  }
  return disabled;
}

function getConflicts(adding: SankeyStage): SankeyStage[] {
  if (adding === 'upstreamPO')                                          return ['originASN', 'previousPeer'];
  if (adding === 'originASN' || adding === 'previousPeer')              return ['upstreamPO'];
  if (adding === 'downstreamPO')                                        return ['nextPeer', 'destinationASN'];
  if (adding === 'nextPeer' || adding === 'destinationASN')             return ['downstreamPO'];
  if (adding === 'myASN')                                               return ['myIngressInterface', 'myRouter'];
  if (adding === 'myIngressInterface' || adding === 'myRouter')         return ['myASN'];
  return [];
}

function getDisabledReason(id: SankeyStage, selected: Set<SankeyStage>): string {
  if (id === 'upstreamPO')    return 'Incompatible with Origin / Prev Peer';
  if (id === 'originASN' || id === 'previousPeer') return 'Incompatible with Upstream PO';
  if (id === 'downstreamPO')  return 'Incompatible with Next Peer / Destination';
  if (id === 'nextPeer' || id === 'destinationASN') return 'Incompatible with Downstream PO';
  if (id === 'myASN')         return 'Incompatible with Ingress / Router';
  if (id === 'myIngressInterface' || id === 'myRouter') return 'Incompatible with My ASN (use expand instead)';
  return '';
}

interface Props {
  config: CustomViewConfig;
  onChange: (config: CustomViewConfig) => void;
}

export function CustomViewBuilder({ config, onChange }: Props) {
  const { selectedColumns } = config;
  const disabled = getDisabledSet(selectedColumns);

  function handleToggle(colId: SankeyStage) {
    const next = new Set(selectedColumns);
    if (next.has(colId)) {
      next.delete(colId);
    } else {
      next.add(colId);
      getConflicts(colId).forEach(id => next.delete(id));
    }
    onChange({ ...config, selectedColumns: next });
  }

  return (
    <div className={styles.builder}>
      <input
        className={styles.nameInput}
        value={config.name}
        onChange={e => onChange({ ...config, name: e.target.value })}
        placeholder="View name"
        spellCheck={false}
      />
      <span className={styles.divider} />
      <div className={styles.columns}>
        {ALL_COLUMNS.map((col, i) => {
          const isSelected = selectedColumns.has(col.id);
          const isDisabled = disabled.has(col.id);
          const reason = isDisabled ? getDisabledReason(col.id, selectedColumns) : '';
          const color = STAGE_COLORS[col.id];
          const prevGroup = i > 0 ? ALL_COLUMNS[i - 1].group : col.group;
          return (
            <span key={col.id} className={styles.chipWrapper}>
              {i > 0 && prevGroup !== col.group && <span className={styles.groupSep} />}
              <button
                type="button"
                className={`${styles.chip} ${isSelected ? styles.chipSelected : ''} ${isDisabled ? styles.chipDisabled : ''}`}
                style={isSelected ? { borderColor: color, color } : undefined}
                onClick={() => !isDisabled && handleToggle(col.id)}
                title={isDisabled ? reason : isSelected ? `Remove ${col.label}` : `Add ${col.label}`}
                disabled={isDisabled}
              >
                {isSelected && <span className={styles.chipDot} style={{ backgroundColor: color }} />}
                {col.label}
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
