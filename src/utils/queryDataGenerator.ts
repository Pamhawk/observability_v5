import type { ParsedQuery } from './queryParser';

// ── Seeded PRNG (Mulberry32) ──
export function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h |= 0;
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Dimension value pools (exported for auto-complete) ──
export const DIMENSION_POOLS: Record<string, string[]> = {
  'Src.Country': ['United States', 'China', 'Germany', 'Brazil', 'Japan', 'India', 'United Kingdom', 'France', 'South Korea', 'Russia', 'Netherlands', 'Australia', 'Canada', 'Indonesia', 'Turkey'],
  'Dst.Country': ['United States', 'Germany', 'Japan', 'Brazil', 'France', 'United Kingdom', 'South Korea', 'India', 'Australia', 'Netherlands', 'Canada', 'Russia', 'Spain', 'Italy', 'Mexico'],
  'Src.City': ['New York', 'Los Angeles', 'Chicago', 'Frankfurt', 'London', 'Tokyo', 'Sao Paulo', 'Mumbai', 'Seoul', 'Paris', 'Sydney', 'Toronto'],
  'Dst.City': ['Frankfurt', 'London', 'Tokyo', 'New York', 'Paris', 'Sydney', 'Toronto', 'Mumbai', 'Seoul', 'Los Angeles', 'Chicago', 'Sao Paulo'],
  'Src.ASN': ['AS15169 Google', 'AS13335 Cloudflare', 'AS16509 Amazon', 'AS8075 Microsoft', 'AS32934 Meta', 'AS174 Cogent', 'AS3356 Lumen', 'AS1299 Telia', 'AS6939 Hurricane Electric', 'AS2914 NTT', 'AS7018 AT&T', 'AS3257 GTT'],
  'Dst.ASN': ['AS64512 MyNet-Core', 'AS64513 MyNet-West', 'AS65001 Enterprise-A', 'AS65002 Enterprise-B', 'AS65003 Enterprise-C', 'AS15169 Google', 'AS13335 Cloudflare', 'AS16509 Amazon', 'AS8075 Microsoft', 'AS32934 Meta', 'AS174 Cogent', 'AS3356 Lumen'],
  'Prev.ASN': ['AS174 Cogent', 'AS3356 Lumen', 'AS1299 Telia', 'AS6939 Hurricane Electric', 'AS2914 NTT', 'AS7018 AT&T', 'AS3257 GTT', 'AS6762 Telecom Italia'],
  'Nxt.ASN': ['AS7018 AT&T', 'AS3257 GTT', 'AS6762 Telecom Italia', 'AS174 Cogent', 'AS3356 Lumen', 'AS1299 Telia', 'AS6939 Hurricane Electric', 'AS2914 NTT'],
  'Src.Port': ['443', '80', '53', '22', '25', '3306', '8080', '123', '8443', '5432'],
  'Dst.Port': ['443', '80', '53', '22', '25', '3306', '8080', '123', '8443', '5432'],
  'Src.PO': ['Madrid', 'Barcelona', 'Lisbon', 'Paris', 'Rome', 'Berlin', 'Amsterdam'],
  'Dst.PO': ['Madrid', 'Barcelona', 'Lisbon', 'Paris', 'Rome', 'Berlin', 'Amsterdam'],
  'Protocol': ['TCP', 'UDP', 'ICMP', 'GRE', 'ESP', 'SCTP'],
  'Application': ['HTTPS/443', 'HTTP/80', 'DNS/53', 'SSH/22', 'SMTP/25', 'BitTorrent/6881', 'NTP/123', 'QUIC/443', 'MySQL/3306', 'PostgreSQL/5432'],
  'Router.name': ['NYC-Core-01', 'NYC-Edge-01', 'LAX-Core-01', 'FRA-Core-01', 'LON-Edge-01', 'TKY-Core-01', 'SYD-Edge-01', 'core-router-01', 'edge-router-02'],
  'Router.ID': ['rtr-nyc-01', 'rtr-nyc-02', 'rtr-lax-01', 'rtr-fra-01', 'rtr-lon-01', 'rtr-tky-01'],
  'Interface.name': ['Ethernet0/0', 'Ethernet0/1', 'TenGigE0/0', 'HundredGigE0/0', 'GigE0/0', 'GigE0/1'],
  'Interface.ID': ['eth0', 'eth1', 'te0', 'hun0', 'ge0', 'ge1'],
  'Hour': ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'],
  'Day.week': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  'Month': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  'Mitigation.rule': ['RTBH', 'ReRoute', 'Flowspec_redirect', 'ACL_Redirect', 'Flowspec_Ratelimit', 'Flowspec_block', 'ACL_Ratelimit', 'ACL_block'],
  'Src.IP': ['10.0.1.0/24', '172.16.0.0/16', '192.168.1.0/24', '203.0.113.0/24', '198.51.100.0/24'],
  'Dst.IP': ['10.0.2.0/24', '172.16.1.0/16', '192.168.2.0/24', '203.0.113.128/25', '198.51.100.128/25'],
  'Direction': ['Inbound', 'Outbound'],
  'Interconnection.type': ['Peering', 'Transit', 'Customer', 'IX', 'PNI'],
  'DNS.domain': ['google.com', 'cloudflare.com', 'facebook.com', 'akamai.net', 'amazonaws.com', 'microsoft.com', 'apple.com', 'netflix.com', 'fastly.net', 'cdn77.org', 'github.com', 'twitter.com'],
};

// Country name → canonical name for GeoMap
export const COUNTRY_CODES: Record<string, string> = {
  'United States': 'United States', 'China': 'China', 'Germany': 'Germany',
  'Brazil': 'Brazil', 'Japan': 'Japan', 'India': 'India',
  'United Kingdom': 'United Kingdom', 'France': 'France',
  'South Korea': 'South Korea', 'Russia': 'Russia',
  'Netherlands': 'Netherlands', 'Australia': 'Australia',
  'Canada': 'Canada', 'Indonesia': 'Indonesia', 'Turkey': 'Turkey',
  'Spain': 'Spain', 'Italy': 'Italy', 'Mexico': 'Mexico',
  'US': 'United States', 'DE': 'Germany', 'JP': 'Japan',
  'BR': 'Brazil', 'CN': 'China', 'IN': 'India',
  'GB': 'United Kingdom', 'FR': 'France', 'KR': 'South Korea',
  'RU': 'Russia', 'NL': 'Netherlands', 'AU': 'Australia',
  'CA': 'Canada', 'ID': 'Indonesia', 'TR': 'Turkey',
};

export const METRIC_RANGES: Record<string, { min: number; max: number; unit: string }> = {
  Traffic:            { min: 1, max: 100, unit: 'Gbps' },
  Packets:            { min: 100000, max: 15000000, unit: 'pps' },
  Flows:              { min: 1000, max: 200000, unit: 'flows' },
  Bytes:              { min: 1e9, max: 100e9, unit: 'bytes' },
  TTL:                { min: 30, max: 128, unit: 's' },
  TCPFlags:           { min: 1000, max: 500000, unit: 'count' },
  FlowDuration:       { min: 0.5, max: 3600, unit: 's' },
  PacketSize:         { min: 64, max: 1500, unit: 'bytes' },
  BitsPerPacket:      { min: 512, max: 12000, unit: 'bits' },
  FragmentedPackets:  { min: 100, max: 100000, unit: 'packets' },
};

const PROTOCOLS = ['TCP', 'UDP', 'ICMP', 'GRE', 'ESP', 'Other'];
const APPLICATIONS = ['HTTPS/443', 'HTTP/80', 'DNS/53', 'SSH/22', 'BitTorrent/6881', 'SMTP/25', 'NTP/123', 'QUIC/443'];
const COUNTRIES_FOR_SANKEY = ['United States', 'Germany', 'Japan', 'Brazil', 'France', 'United Kingdom', 'China', 'India', 'South Korea', 'Russia'];

// ── Result types ──
export interface DynamicSeries { name: string; data: number[] }

export interface SankeyNodeData {
  name: string;
  asnNumber?: string;
  trafficGbps?: number;
  country?: string;
  inFlows?: number;
  outFlows?: number;
}

export interface SankeyLinkData {
  source: string;
  target: string;
  value: number;
  trafficGbps?: number;
  topProtocol?: string;
  topApplication?: string;
}

export interface TableColumn {
  key: string;
  label: string;
  align: 'left' | 'right';
}

export type ChartDataResult =
  | { type: 'timeSeries'; dynamicSeries: DynamicSeries[]; timestamps: string[]; unit: string; stacked: boolean }
  | { type: 'bar'; data: { name: string; value: number; percent?: number }[]; unit: string; horizontal: boolean }
  | { type: 'pie'; data: { name: string; value: number }[] }
  | { type: 'donut'; data: { name: string; value: number }[]; total: number }
  | { type: 'gauge'; value: number; min: number; max: number; thresholds: [number, number]; label: string }
  | { type: 'singleValue'; value: number; label: string; unit: string; comparePrevious?: { percent: number; period: string } }
  | { type: 'geoMap'; data: { name: string; value: number }[] }
  | { type: 'heatmap'; xLabels: string[]; yLabels: string[]; data: number[][] }
  | { type: 'sankey'; nodes: SankeyNodeData[]; links: SankeyLinkData[] }
  | { type: 'table'; columns: TableColumn[]; rows: Record<string, string | number>[] }
  | { type: 'stackedBar'; categories: string[]; series: DynamicSeries[]; unit: string }
  | { type: 'groupedBar'; categories: string[]; series: DynamicSeries[]; unit: string };

// ── Helpers ──
function getLabelsForDimension(
  dim: string,
  conditions: ParsedQuery['conditions'],
  count: number,
  rand: () => number,
): string[] {
  // Check if WHERE has values for this dimension (or related ones)
  const condValues = conditions
    .filter(c => c.op === 'IS' && c.field.toLowerCase() === dim.toLowerCase())
    .flatMap(c => c.values);

  if (condValues.length > 0) {
    // Expand abbreviations for countries
    if (dim.includes('Country')) {
      return condValues.map(v => COUNTRY_CODES[v] || v).slice(0, count);
    }
    return condValues.slice(0, count);
  }

  const pool = DIMENSION_POOLS[dim];
  if (!pool) return Array.from({ length: count }, (_, i) => `${dim}-${i + 1}`);

  // Shuffle with seeded random and pick `count`
  const shuffled = [...pool].sort(() => rand() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

function getMetricInfo(parsed: ParsedQuery): { min: number; max: number; unit: string } {
  const metric = parsed.aggregations[0]?.metric || 'Traffic';
  return METRIC_RANGES[metric] || METRIC_RANGES.Traffic;
}

export function formatValue(value: number, unit: string): string {
  // Percentage
  if (unit === '%') return `${value.toFixed(1)}%`;
  // Gbps — auto-scale bits
  if (unit === 'Gbps') {
    if (value >= 1) return `${value.toFixed(1)} Gbps`;
    if (value >= 0.001) return `${(value * 1000).toFixed(1)} Mbps`;
    return `${(value * 1e6).toFixed(1)} Kbps`;
  }
  if (unit === 'GB') return `${value.toFixed(1)} GB`;
  // Milliseconds — auto-scale
  if (unit === 'ms') {
    if (value >= 1000) return `${(value / 1000).toFixed(1)} s`;
    return `${value.toFixed(1)} ms`;
  }
  // Seconds — auto-scale
  if (unit === 's') {
    if (value >= 3600) return `${(value / 3600).toFixed(1)} h`;
    if (value >= 60) return `${(value / 60).toFixed(1)} min`;
    return `${value.toFixed(1)} s`;
  }
  // Bits — auto-scale
  if (unit === 'bits') {
    if (value >= 1000) return `${(value / 1000).toFixed(1)} Kbits`;
    return `${value.toFixed(0)} bits`;
  }
  // pps — auto-scale
  if (unit === 'pps') {
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M pps`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K pps`;
    return `${value.toFixed(0)} pps`;
  }
  // bytes
  if (unit === 'bytes') {
    if (value >= 1e12) return `${(value / 1e12).toFixed(1)} TB`;
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)} GB`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)} MB`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)} KB`;
    return `${value.toFixed(0)} bytes`;
  }
  // Countable units — auto-scale M/K
  if (['packets', 'count', 'connections', 'prefixes', 'updates/s', 'flows'].includes(unit)) {
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
    return value.toLocaleString();
  }
  return value.toFixed(1);
}

// ── Per-type generators ──

export function generateTimeLabels(preset: string): string[] {
  switch (preset) {
    case '15m':
      return Array.from({ length: 15 }, (_, i) => `${i}m`);
    case '30m':
      return Array.from({ length: 15 }, (_, i) => `${i * 2}m`);
    case '1h':
      return Array.from({ length: 12 }, (_, i) => `${i * 5}m`);
    case '6h':
      return Array.from({ length: 12 }, (_, i) => {
        const h = Math.floor(i * 0.5);
        const m = (i * 30) % 60;
        return `${h}h${m > 0 ? m + 'm' : ''}`;
      });
    case '24h':
    case '1d':
      return Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
    case '7d':
      return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].flatMap(d =>
        ['00:00', '06:00', '12:00', '18:00'].map(t => `${d} ${t}`)
      );
    case '30d':
      return Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`);
    default:
      return Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
  }
}

function generateTimeSeries(parsed: ParsedQuery, rand: () => number, timePreset: string): ChartDataResult {
  const info = getMetricInfo(parsed);
  const dim = parsed.dimensions[0];
  const count = parsed.limit || 5;
  const timestamps = generateTimeLabels(timePreset);
  const points = timestamps.length;

  let series: DynamicSeries[];
  if (dim) {
    const labels = getLabelsForDimension(dim, parsed.conditions, count, rand);
    series = labels.map(name => ({
      name,
      data: Array.from({ length: points }, () =>
        info.min + rand() * (info.max - info.min)
      ),
    }));
  } else {
    series = [{
      name: parsed.label || 'Total',
      data: Array.from({ length: points }, () =>
        info.min + rand() * (info.max - info.min)
      ),
    }];
  }

  return {
    type: 'timeSeries',
    dynamicSeries: series,
    timestamps,
    unit: info.unit,
    stacked: parsed.graphType === 'stackedArea',
  };
}

function generateBar(parsed: ParsedQuery, rand: () => number): ChartDataResult {
  const info = getMetricInfo(parsed);
  const dim = parsed.dimensions[0] || 'Protocol';
  const count = parsed.limit || parsed.topN || 10;
  const labels = getLabelsForDimension(dim, parsed.conditions, count, rand);

  const values = labels.map(() => info.min + rand() * (info.max - info.min));
  values.sort((a, b) => b - a);
  const total = values.reduce((s, v) => s + v, 0);

  const data = labels.map((name, i) => ({
    name,
    value: parseFloat(values[i].toFixed(2)),
    percent: parseFloat(((values[i] / total) * 100).toFixed(1)),
  }));

  return {
    type: 'bar',
    data,
    unit: info.unit,
    horizontal: parsed.graphType === 'topNBar',
  };
}

function generatePie(parsed: ParsedQuery, rand: () => number): ChartDataResult {
  const dim = parsed.dimensions[0] || 'Protocol';
  const count = parsed.limit || 6;
  const labels = getLabelsForDimension(dim, parsed.conditions, count, rand);

  const values = labels.map(() => 10 + rand() * 90);
  const total = values.reduce((s, v) => s + v, 0);

  const data = labels.map((name, i) => ({
    name,
    value: parseFloat(((values[i] / total) * 100).toFixed(1)),
  }));

  return { type: 'pie', data };
}

function generateDonut(parsed: ParsedQuery, rand: () => number): ChartDataResult {
  const dim = parsed.dimensions[0] || 'Protocol';
  const count = parsed.limit || 6;
  const labels = getLabelsForDimension(dim, parsed.conditions, count, rand);
  const info = getMetricInfo(parsed);

  const rawValues = labels.map(() => info.min + rand() * (info.max - info.min));
  const total = rawValues.reduce((s, v) => s + v, 0);

  const data = labels.map((name, i) => ({
    name,
    value: parseFloat(((rawValues[i] / total) * 100).toFixed(1)),
  }));

  return { type: 'donut', data, total: parseFloat(total.toFixed(1)) };
}

function generateGauge(parsed: ParsedQuery, rand: () => number): ChartDataResult {
  const min = parsed.gaugeMin ?? 0;
  const max = parsed.gaugeMax ?? 100;
  const t1 = parsed.thresholds?.[0] ?? 60;
  const t2 = parsed.thresholds?.[1] ?? 85;
  const value = Math.round(min + rand() * (max - min));

  return {
    type: 'gauge',
    value,
    min,
    max,
    thresholds: [t1, t2],
    label: parsed.label || parsed.aggregations[0]?.metric || 'Value',
  };
}

function generateSingleValue(parsed: ParsedQuery, rand: () => number): ChartDataResult {
  const info = getMetricInfo(parsed);
  const value = Math.round(info.min + rand() * (info.max - info.min));

  let comparePrevious: { percent: number; period: string } | undefined;
  if (parsed.comparePrevious) {
    const pct = parseFloat(((rand() * 20) - 5).toFixed(1));
    comparePrevious = { percent: pct, period: parsed.comparePrevious };
  }

  return {
    type: 'singleValue',
    value,
    label: parsed.label || parsed.aggregations[0]?.metric || 'Value',
    unit: info.unit,
    comparePrevious,
  };
}

function generateGeoMap(parsed: ParsedQuery, rand: () => number): ChartDataResult {
  const dim = parsed.dimensions[0] || 'Src.Country';
  const labels = getLabelsForDimension(dim, parsed.conditions, 15, rand);
  const info = getMetricInfo(parsed);

  const data = labels.map(label => ({
    name: COUNTRY_CODES[label] || label,
    value: parseFloat((info.min + rand() * (info.max - info.min)).toFixed(1)),
  }));

  return { type: 'geoMap', data };
}

function generateHeatmap(parsed: ParsedQuery, rand: () => number): ChartDataResult {
  const dim1 = parsed.dimensions[0] || 'Src.ASN';
  const dim2 = parsed.dimensions[1] || 'Hour';
  const yLabels = getLabelsForDimension(dim1, parsed.conditions, 6, rand);
  const xLabels = getLabelsForDimension(dim2, parsed.conditions, 8, rand);

  const data: number[][] = [];
  for (let x = 0; x < xLabels.length; x++) {
    for (let y = 0; y < yLabels.length; y++) {
      data.push([x, y, Math.round(rand() * 100)]);
    }
  }

  return { type: 'heatmap', xLabels, yLabels, data };
}

function generateSankey(parsed: ParsedQuery, rand: () => number): ChartDataResult {
  const fromDim = parsed.sankeyFrom || 'Src.ASN';
  const toDim = parsed.sankeyTo || 'Dst.ASN';

  const sourceLabels = getLabelsForDimension(fromDim, parsed.conditions, 5, rand);
  const targetLabels = getLabelsForDimension(toDim, parsed.conditions, 5, rand);

  // Ensure no overlap between sources and targets
  const uniqueTargets = targetLabels.filter(t => !sourceLabels.includes(t));
  if (uniqueTargets.length === 0) {
    uniqueTargets.push('AS64512 MyNet-Core', 'AS64513 MyNet-West', 'AS65001 Enterprise-A');
  }

  const nodes: SankeyNodeData[] = [];
  const nodeSet = new Set<string>();

  for (const name of [...sourceLabels, ...uniqueTargets]) {
    if (!nodeSet.has(name)) {
      nodeSet.add(name);
      const asnMatch = name.match(/AS(\d+)/);
      nodes.push({
        name,
        asnNumber: asnMatch ? asnMatch[1] : undefined,
        trafficGbps: parseFloat((5 + rand() * 45).toFixed(1)),
        country: COUNTRIES_FOR_SANKEY[Math.floor(rand() * COUNTRIES_FOR_SANKEY.length)],
        inFlows: Math.round(1000 + rand() * 50000),
        outFlows: Math.round(1000 + rand() * 50000),
      });
    }
  }

  const links: SankeyLinkData[] = [];
  for (const src of sourceLabels) {
    const numLinks = 1 + Math.floor(rand() * Math.min(3, uniqueTargets.length));
    const shuffledTargets = [...uniqueTargets].sort(() => rand() - 0.5);
    for (let i = 0; i < numLinks; i++) {
      const tgt = shuffledTargets[i];
      if (!tgt || tgt === src) continue;
      const traffic = parseFloat((2 + rand() * 30).toFixed(1));
      links.push({
        source: src,
        target: tgt,
        value: traffic,
        trafficGbps: traffic,
        topProtocol: PROTOCOLS[Math.floor(rand() * 3)],
        topApplication: APPLICATIONS[Math.floor(rand() * APPLICATIONS.length)],
      });
    }
  }

  return { type: 'sankey', nodes, links };
}

function generateTable(parsed: ParsedQuery, rand: () => number): ChartDataResult {
  const dims = parsed.dimensions.length > 0 ? parsed.dimensions : ['Src.ASN'];
  const aggs = parsed.aggregations.length > 0 ? parsed.aggregations : [{ fn: 'TOTAL', metric: 'Traffic' }];
  const rowCount = Math.min(parsed.limit || 20, 50);

  const columns: TableColumn[] = [
    ...dims.map(d => ({ key: d, label: d, align: 'left' as const })),
    ...aggs.map(a => ({
      key: `${a.fn}_${a.metric}`,
      label: `${a.fn} ${a.metric}`,
      align: 'right' as const,
    })),
  ];

  // Generate dimension values per column
  const dimValues: Record<string, string[]> = {};
  for (const dim of dims) {
    dimValues[dim] = getLabelsForDimension(dim, parsed.conditions, Math.max(rowCount, 10), rand);
  }

  const rows: Record<string, string | number>[] = [];
  for (let i = 0; i < rowCount; i++) {
    const row: Record<string, string | number> = {};
    for (const dim of dims) {
      const pool = dimValues[dim];
      row[dim] = pool[i % pool.length];
    }
    for (const agg of aggs) {
      const info = METRIC_RANGES[agg.metric] || METRIC_RANGES.Traffic;
      const val = info.min + rand() * (info.max - info.min);
      row[`${agg.fn}_${agg.metric}`] = formatValue(val, info.unit);
    }
    rows.push(row);
  }

  return { type: 'table', columns, rows };
}

// ── Main entry point ──
export function generateQueryData(parsed: ParsedQuery, timePreset: string = '1d'): ChartDataResult {
  const seedStr = `${parsed.graphType}|${parsed.dimensions.join(',')}|${parsed.conditions.map(c => `${c.field}${c.op}${c.values.join(',')}`).join('|')}|${parsed.limit || ''}|${parsed.label || ''}|${timePreset}`;
  const rand = seededRandom(seedStr);

  switch (parsed.graphType) {
    case 'timeSeries':
    case 'stackedArea':
      return generateTimeSeries(parsed, rand, timePreset);
    case 'bar':
    case 'topNBar':
      return generateBar(parsed, rand);
    case 'pie':
      return generatePie(parsed, rand);
    case 'donut':
      return generateDonut(parsed, rand);
    case 'gauge':
      return generateGauge(parsed, rand);
    case 'singleValue':
      return generateSingleValue(parsed, rand);
    case 'geoMap':
      return generateGeoMap(parsed, rand);
    case 'heatmap':
      return generateHeatmap(parsed, rand);
    case 'sankey':
      return generateSankey(parsed, rand);
    case 'table':
      return generateTable(parsed, rand);
    default:
      return generateBar(parsed, rand);
  }
}
