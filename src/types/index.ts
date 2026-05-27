// User roles as defined in PRD
export type UserRole = 'Admin' | 'SuperOperator' | 'Operator' | 'SecurityAnalyst';

// EdgeAnalytics permissions
export interface EdgeAnalyticsPermissions {
  asnPathAnalysis: boolean;
  queries: boolean;
  publicQueries: boolean;
  privateQueries: boolean;
}

// User type
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  hasEdgeAnalyticsLicense: boolean;
  permissions: EdgeAnalyticsPermissions;
}

// ASN (Autonomous System Number)
export interface ASN {
  id: number;
  name: string;
  owner: string;
  country: string;
  city: string;
  isMyASN: boolean;
}

// Router info
export interface Router {
  id: string;
  name: string;
  asnId: number;
  location: string;
  interfaces: RouterInterface[];
}

// Router interface
export interface RouterInterface {
  id: string;
  name: string;
  type: 'ingress' | 'egress';
  trafficGbps: number;
  trafficPercent: number;
}

// Flow between ASNs
export interface Flow {
  id: string;
  originASN: ASN;
  previousPeer: ASN | null;
  myASN: ASN;
  nextPeer: ASN | null;
  destinationASN: ASN;
  trafficGbps: number;
  totalTrafficTB: number;
  packetCount: number;
  flowCount: number;
  averageFlowSizeMB: number;
  peakTrafficGbps: number;
  protocolMix: ProtocolMix;
  topPort: TopPort;
  trendPercent: number;
  percentOfTotal: number;
  timestamp: string;
}

// Protocol distribution
export interface ProtocolMix {
  tcp: number;
  udp: number;
  icmp: number;
  gre: number;
  vpn: number;
  other: number;
}

// Top port/application
export interface TopPort {
  port: number;
  name: string;
  percent: number;
}

// Application info
export interface Application {
  name: string;
  port: number;
  trafficBps: number;
  trafficPps: number;
  percent: number;
}

// Sankey diagram node
export interface SankeyNode {
  id: string;
  name: string;
  asnNumber: number;
  stage: SankeyStage;
  trafficGbps: number;
  country: string;
  state?: string;
  city?: string;
  inFlows: number;
  outFlows: number;
  isMyASN: boolean;
  // V6 additions
  nodeType?: 'asn' | 'protectedObject' | 'router' | 'interface';
  expandable?: boolean;          // true on collapsed My ASN nodes
  prefix?: string;               // IP prefix for PO nodes (e.g. "192.0.2.0/24")
  parentAsnId?: string;          // for ingress/router/egress: parent My ASN node ID
  routerDisplayName?: string;    // for interface nodes: which router they belong to
  interfaceDir?: 'ingress' | 'egress';
}

// Sankey diagram link
export interface SankeyLink {
  source: string;
  target: string;
  value: number;
  trafficGbps: number;
  topProtocol: string;
  topApplication: TopPort;
}

// Sankey stages as defined in PRD (V6: added PO and expanded My ASN sub-stages)
export type SankeyStage =
  | 'originPO'
  | 'originASN'
  | 'previousPeerPO'      // PO node belonging to a Previous Peer ASN
  | 'previousPeer'
  | 'myASN'               // collapsed My ASN node
  | 'myIngressInterface'  // expanded: ingress interface inside My ASN
  | 'myRouter'            // expanded: router inside My ASN
  | 'myEgressInterface'   // expanded: egress interface inside My ASN
  | 'nextPeer'
  | 'nextPeerPO'          // PO node belonging to a Next Peer ASN
  | 'destinationASN'
  | 'destinationPO';

// Stage filter configuration
export interface StageFilter {
  stage: SankeyStage;
  label: string;
  color: string;
  enabled: boolean;
  selectedASNs: number[]; // ASN IDs, empty means all selected
}

// Time range options
export type TimeRangePreset = '1h' | '1d' | '3d' | '7d' | '30d' | 'custom';

export interface TimeRange {
  preset: TimeRangePreset;
  start: Date;
  end: Date;
}

// Traffic data point for time series
export interface TrafficDataPoint {
  timestamp: string;
  total: number;
  inbound: number;
  outbound: number;
  internal: number;
  transit: number;
}

// Chart type union
export type ChartType = 'areaTimeSeries' | 'timeSeries' | 'stackedArea' | 'pie' | 'donut' | 'gauge' | 'singleValue' | 'bar' | 'topNBar' | 'stackedBar' | 'groupedBar' | 'geoMap' | 'heatmap' | 'sankey' | 'table';

// A named widget saved on a query (one query can have many widgets)
export interface QueryWidget {
  id: string;
  name: string;
  graphType: ChartType;
  chartConfig?: ChartConfig;
}

// Query types
export interface Query {
  id: string;
  name: string;
  description: string;
  script: string;
  graphType: ChartType;
  chartConfig?: ChartConfig;
  widgets?: QueryWidget[];
  isDraft: boolean;
  isPrivate?: boolean;
  lastEdited: string;
  createdBy: string;
}

// ── SQL Parser types ──

export interface ParsedSQLColumn {
  expression: string;
  alias?: string;
  aggregation?: string;
  sourceColumn?: string;
}

export interface ParsedSQLCondition {
  column: string;
  operator: string;
  value: string | string[];
}

export interface ParsedSQL {
  select: ParsedSQLColumn[];
  from: string;
  where: ParsedSQLCondition[];
  groupBy: string[];
  orderBy: { column: string; direction: 'ASC' | 'DESC' }[];
  limit?: number;
}

// ── SQL Result types ──

export type SqlColumnType = 'string' | 'number' | 'timestamp' | 'geo';

export interface SqlResultColumn {
  key: string;
  label: string;
  type: SqlColumnType;
  align: 'left' | 'right';
}

export interface SqlResultTable {
  columns: SqlResultColumn[];
  rows: Record<string, string | number>[];
  executionTimeMs: number;
}

// ── Chart Recommendation ──

export interface ChartRecommendation {
  chartType: ChartType;
  score: number;
  reason: string;
  defaultConfig: ChartConfig;
}

// ── Chart Configuration (discriminated union) ──

export interface TimeSeriesConfig {
  chartType: 'timeSeries' | 'stackedArea' | 'areaTimeSeries';
  timeColumn: string;
  valueColumns: string[];
  groupByColumn?: string;
  yAxisLabel?: string;
  trendline?: boolean;
  thresholdLine?: boolean;
  thresholdValue?: number;
  showTotalLine?: boolean;
}

export interface BarConfig {
  chartType: 'bar' | 'topNBar';
  categoryColumn: string;
  valueColumn: string;
  sortOrder: 'asc' | 'desc' | 'none';
  orientation: 'vertical' | 'horizontal';
  limit?: number;
  yAxisLabel?: string;
  thresholdLine?: boolean;
  thresholdValue?: number;
  showValueLabels?: boolean;
  toggleMaxBars?: boolean;
  maxBars?: number;
}

export interface PieConfig {
  chartType: 'pie' | 'donut';
  categoryColumn: string;
  valueColumn: string;
  limit?: number;
  labelFormat?: 'value' | 'percentage' | 'both';
  showValueLabels?: boolean;
  centerLabelColumn?: string;
}

export interface GaugeThresholdRange {
  upToPercent: number; // percentage of max (0–100), e.g. 60 means 0..60% = this color
  color: string;
  label?: string;
}

export interface GaugeConfig {
  chartType: 'gauge';
  valueColumn: string;
  min: number;
  max: number;
  thresholds: [number, number];
  label: string;
  unit?: string;
  thresholdRanges?: GaugeThresholdRange[];
}

export interface SingleValueConfig {
  chartType: 'singleValue';
  valueColumn: string;
  label: string;
  unit?: string;
  comparison?: boolean;
}

export interface HeatmapConfig {
  chartType: 'heatmap';
  xColumn: string;
  yColumn: string;
  valueColumn: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  xSort?: 'asc' | 'desc' | 'none';
  ySort?: 'asc' | 'desc' | 'none';
}

export interface SankeyNodeDimension {
  dimension: string; // column key for this node level
}

export interface SankeyConfig {
  chartType: 'sankey';
  // Multi-node: up to 10 node levels
  nodes: SankeyNodeDimension[];
  valueColumn: string;
  // Legacy 2-node fields (kept for backward compat)
  sourceColumn?: string;
  targetColumn?: string;
}

export interface GeoMapConfig {
  chartType: 'geoMap';
  geoColumn: string;
  valueColumn: string;
  geoLevel?: 'country' | 'region' | 'city';
}

export interface TableConfig {
  chartType: 'table';
  visibleColumns: string[];
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  filterColumns?: string[];
  columnOrder?: string[];
}

export interface MultiBarConfig {
  chartType: 'stackedBar' | 'groupedBar';
  categoryColumn: string;
  valueColumn: string;
  groupByColumn: string;
  yAxisLabel?: string;
  sortOrder?: 'asc' | 'desc' | 'none';
  orientation?: 'vertical' | 'horizontal';
  showValueLabels?: boolean;
  showTotalOnBar?: boolean;
  showSegmentLabels?: boolean;
  segmentLabelFormat?: 'value' | 'percentage';
  thresholdLine?: boolean;
  thresholdValue?: number;
}

export type ChartConfig =
  | TimeSeriesConfig
  | BarConfig
  | PieConfig
  | GaugeConfig
  | SingleValueConfig
  | HeatmapConfig
  | SankeyConfig
  | GeoMapConfig
  | TableConfig
  | MultiBarConfig;

// Dashboard
export interface Dashboard {
  id: string;
  name: string;
  description: string;
  queries: string[]; // Query IDs
  layout: DashboardItem[];
  createdBy: string;
  lastEdited: string;
  isPrivate?: boolean;
}

// Dashboard item position
export interface DashboardItem {
  queryId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// ASN Path Analysis Table columns as per PRD
export interface ASNPathTableRow {
  id: string;
  origin: { name: string; number: number };
  myASN: { name: string; number: number };
  destination: { name: string; number: number };
  originGeo: { city: string; country: string };
  destinationGeo: { city: string; country: string };
  trafficGbps: number;
  totalTrafficTB: number;
  flowCount: number;
  averageFlowSizeMB: number;
  peakTrafficGbps: number;
  protocolMix: string;
  topPort: string;
  trendPercent: number;
  percentOfTotal: number;
}

// Sunburst data for routers/interfaces
export interface SunburstData {
  name: string;
  value: number;
  percent: number;
  children?: SunburstData[];
}
