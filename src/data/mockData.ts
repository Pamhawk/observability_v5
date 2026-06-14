import type {
  ASN,
  Router,
  SankeyNode,
  SankeyLink,
  StageFilter,
  User,
  TrafficDataPoint,
  Query,
  Dashboard,
  ASNPathTableRow,
  SunburstData,
  Application,
} from '../types';

// Current user (Admin)
export const currentUser: User = {
  id: 'user-1',
  name: 'John Admin',
  email: 'john.admin@company.com',
  role: 'Admin',
  hasEdgeAnalyticsLicense: true,
  permissions: {
    asnPathAnalysis: true,
    queries: true,
    publicQueries: true,
    privateQueries: true,
  },
};

// My ASNs (the customer's ASNs)
export const myASNs: ASN[] = [
  { id: 64512, name: 'MyNet-Core', owner: 'MyCompany Inc', country: 'United States', city: 'New York', isMyASN: true },
  { id: 64513, name: 'MyNet-West', owner: 'MyCompany Inc', country: 'United States', city: 'Los Angeles', isMyASN: true },
  { id: 64514, name: 'MyNet-EU', owner: 'MyCompany Inc', country: 'Germany', city: 'Frankfurt', isMyASN: true },
];

// External ASNs
export const externalASNs: ASN[] = [
  { id: 174, name: 'Cogent', owner: 'Cogent Communications', country: 'United States', city: 'Washington DC', isMyASN: false },
  { id: 3356, name: 'Lumen', owner: 'Lumen Technologies', country: 'United States', city: 'Denver', isMyASN: false },
  { id: 1299, name: 'Telia', owner: 'Telia Company', country: 'Sweden', city: 'Stockholm', isMyASN: false },
  { id: 6939, name: 'Hurricane', owner: 'Hurricane Electric', country: 'United States', city: 'Fremont', isMyASN: false },
  { id: 2914, name: 'NTT', owner: 'NTT America', country: 'United States', city: 'New York', isMyASN: false },
  { id: 7018, name: 'AT&T', owner: 'AT&T Services', country: 'United States', city: 'Dallas', isMyASN: false },
  { id: 3257, name: 'GTT', owner: 'GTT Communications', country: 'United States', city: 'McLean', isMyASN: false },
  { id: 15169, name: 'Google', owner: 'Google LLC', country: 'United States', city: 'Mountain View', isMyASN: false },
  { id: 13335, name: 'Cloudflare', owner: 'Cloudflare Inc', country: 'United States', city: 'San Francisco', isMyASN: false },
  { id: 16509, name: 'Amazon', owner: 'Amazon.com Inc', country: 'United States', city: 'Seattle', isMyASN: false },
  { id: 8075, name: 'Microsoft', owner: 'Microsoft Corporation', country: 'United States', city: 'Redmond', isMyASN: false },
  { id: 32934, name: 'Meta', owner: 'Meta Platforms', country: 'United States', city: 'Menlo Park', isMyASN: false },
];

export const allASNs = [...myASNs, ...externalASNs];

// Routers
export const routers: Router[] = [
  {
    id: 'rtr-nyc-01',
    name: 'NYC-Core-01',
    asnId: 64512,
    location: 'New York, US',
    interfaces: [
      { id: 'eth0', name: 'Ethernet0/0', type: 'ingress', trafficGbps: 45.2, trafficPercent: 35 },
      { id: 'eth1', name: 'Ethernet0/1', type: 'ingress', trafficGbps: 38.7, trafficPercent: 30 },
      { id: 'eth2', name: 'Ethernet1/0', type: 'egress', trafficGbps: 42.1, trafficPercent: 33 },
      { id: 'eth3', name: 'Ethernet1/1', type: 'egress', trafficGbps: 2.5, trafficPercent: 2 },
    ],
  },
  {
    id: 'rtr-nyc-02',
    name: 'NYC-Edge-01',
    asnId: 64512,
    location: 'New York, US',
    interfaces: [
      { id: 'ge0', name: 'GigE0/0', type: 'ingress', trafficGbps: 28.3, trafficPercent: 45 },
      { id: 'ge1', name: 'GigE0/1', type: 'egress', trafficGbps: 34.2, trafficPercent: 55 },
    ],
  },
  {
    id: 'rtr-lax-01',
    name: 'LAX-Core-01',
    asnId: 64513,
    location: 'Los Angeles, US',
    interfaces: [
      { id: 'te0', name: 'TenGigE0/0', type: 'ingress', trafficGbps: 52.8, trafficPercent: 40 },
      { id: 'te1', name: 'TenGigE0/1', type: 'ingress', trafficGbps: 39.1, trafficPercent: 30 },
      { id: 'te2', name: 'TenGigE1/0', type: 'egress', trafficGbps: 39.4, trafficPercent: 30 },
    ],
  },
  {
    id: 'rtr-fra-01',
    name: 'FRA-Core-01',
    asnId: 64514,
    location: 'Frankfurt, DE',
    interfaces: [
      { id: 'hun0', name: 'HundredGigE0/0', type: 'ingress', trafficGbps: 78.5, trafficPercent: 55 },
      { id: 'hun1', name: 'HundredGigE0/1', type: 'egress', trafficGbps: 64.2, trafficPercent: 45 },
    ],
  },
];

// Stage filter configuration — 5 independent filters
export const defaultStageFilters: StageFilter[] = [
  { stage: 'originASN',      label: 'Origin ASN',      color: '#F97316', enabled: true, selectedASNs: [] },
  { stage: 'previousPeer',   label: 'Previous Peer',   color: '#8B5CF6', enabled: true, selectedASNs: [] },
  { stage: 'myASN',          label: 'My ASNs',         color: '#14B8A6', enabled: true, selectedASNs: [] },
  { stage: 'nextPeer',       label: 'Next Peer',       color: '#3B82F6', enabled: true, selectedASNs: [] },
  { stage: 'destinationASN', label: 'Destination ASN', color: '#EC4899', enabled: true, selectedASNs: [] },
];

// ─── Sankey nodes ──────────────────────────────────────────────────────────────
// POs are customer-owned IP prefixes (Protected Objects), always adjacent to My ASN.
// Flow: originASN → previousPeer → upstreamPO → myASN → downstreamPO → nextPeer → destinationASN
export const sankeyNodes: SankeyNode[] = [

  // ── Origin ASNs (sources) ─────────────────────────────────────────────────
  { id: 'origin-15169', name: 'Google',     asnNumber: 15169, stage: 'originASN', nodeType: 'asn', trafficGbps: 45, country: 'United States', state: 'California',       city: 'Mountain View', inFlows: 0, outFlows: 2, isMyASN: false },
  { id: 'origin-13335', name: 'Cloudflare', asnNumber: 13335, stage: 'originASN', nodeType: 'asn', trafficGbps: 38, country: 'United States', state: 'California',       city: 'San Francisco', inFlows: 0, outFlows: 2, isMyASN: false },
  { id: 'origin-16509', name: 'Amazon',     asnNumber: 16509, stage: 'originASN', nodeType: 'asn', trafficGbps: 32, country: 'United States', state: 'Washington',       city: 'Seattle',       inFlows: 0, outFlows: 2, isMyASN: false },
  { id: 'origin-8075',  name: 'Microsoft',  asnNumber:  8075, stage: 'originASN', nodeType: 'asn', trafficGbps: 28, country: 'United States', state: 'Washington',       city: 'Redmond',       inFlows: 0, outFlows: 2, isMyASN: false },
  { id: 'origin-32934', name: 'Meta',       asnNumber: 32934, stage: 'originASN', nodeType: 'asn', trafficGbps: 22, country: 'United States', state: 'California',       city: 'Menlo Park',    inFlows: 0, outFlows: 1, isMyASN: false },

  // ── Previous Peers ─────────────────────────────────────────────────────────
  { id: 'prev-174',  name: 'Cogent',    asnNumber:  174,  stage: 'previousPeer', nodeType: 'asn', trafficGbps: 69, country: 'United States', state: 'District of Columbia', city: 'Washington DC', inFlows: 3, outFlows: 4, isMyASN: false },
  { id: 'prev-3356', name: 'Lumen',     asnNumber: 3356,  stage: 'previousPeer', nodeType: 'asn', trafficGbps: 38, country: 'United States', state: 'Colorado',            city: 'Denver',        inFlows: 2, outFlows: 3, isMyASN: false },
  { id: 'prev-1299', name: 'Telia',     asnNumber: 1299,  stage: 'previousPeer', nodeType: 'asn', trafficGbps: 29, country: 'Sweden',        state: 'Stockholm County',    city: 'Stockholm',     inFlows: 2, outFlows: 1, isMyASN: false },
  { id: 'prev-6939', name: 'Hurricane', asnNumber: 6939,  stage: 'previousPeer', nodeType: 'asn', trafficGbps: 29, country: 'United States', state: 'California',          city: 'Fremont',       inFlows: 2, outFlows: 3, isMyASN: false },

  // ── My ASNs — marked expandable (click to drill into routers/interfaces) ───
  { id: 'my-64512', name: 'MyNet-Core', asnNumber: 64512, stage: 'myASN', nodeType: 'asn', trafficGbps: 75, country: 'United States', state: 'New York',   city: 'New York',    inFlows: 2, outFlows: 1, isMyASN: true, expandable: true },
  { id: 'my-64513', name: 'MyNet-West', asnNumber: 64513, stage: 'myASN', nodeType: 'asn', trafficGbps: 47, country: 'United States', state: 'California', city: 'Los Angeles', inFlows: 1, outFlows: 1, isMyASN: true, expandable: true },
  { id: 'my-64514', name: 'MyNet-EU',   asnNumber: 64514, stage: 'myASN', nodeType: 'asn', trafficGbps: 43, country: 'Germany',       state: 'Hesse',      city: 'Frankfurt',   inFlows: 1, outFlows: 1, isMyASN: true, expandable: true },

  // ── Next Peers ─────────────────────────────────────────────────────────────
  { id: 'next-2914', name: 'NTT',  asnNumber: 2914, stage: 'nextPeer', nodeType: 'asn', trafficGbps: 65, country: 'United States', state: 'New York', city: 'New York', inFlows: 2, outFlows: 2, isMyASN: false },
  { id: 'next-7018', name: 'AT&T', asnNumber: 7018, stage: 'nextPeer', nodeType: 'asn', trafficGbps: 53, country: 'United States', state: 'Texas',    city: 'Dallas',   inFlows: 2, outFlows: 3, isMyASN: false },
  { id: 'next-3257', name: 'GTT',  asnNumber: 3257, stage: 'nextPeer', nodeType: 'asn', trafficGbps: 47, country: 'United States', state: 'Virginia', city: 'McLean',   inFlows: 3, outFlows: 3, isMyASN: false },

  // ── Destination ASNs ───────────────────────────────────────────────────────
  { id: 'dest-enterprise1', name: 'Enterprise-A', asnNumber: 65001, stage: 'destinationASN', nodeType: 'asn', trafficGbps: 45, country: 'United States',  state: 'New York',           city: 'New York',  inFlows: 2, outFlows: 0, isMyASN: false },
  { id: 'dest-enterprise2', name: 'Enterprise-B', asnNumber: 65002, stage: 'destinationASN', nodeType: 'asn', trafficGbps: 45, country: 'United Kingdom', state: 'England',            city: 'London',    inFlows: 2, outFlows: 0, isMyASN: false },
  { id: 'dest-enterprise3', name: 'Enterprise-C', asnNumber: 65003, stage: 'destinationASN', nodeType: 'asn', trafficGbps: 32, country: 'Germany',        state: 'Hesse',              city: 'Frankfurt', inFlows: 1, outFlows: 0, isMyASN: false },
  { id: 'dest-enterprise4', name: 'Enterprise-D', asnNumber: 65004, stage: 'destinationASN', nodeType: 'asn', trafficGbps: 23, country: 'Japan',          state: 'Tokyo',              city: 'Tokyo',     inFlows: 2, outFlows: 0, isMyASN: false },
  { id: 'dest-enterprise5', name: 'Enterprise-E', asnNumber: 65005, stage: 'destinationASN', nodeType: 'asn', trafficGbps: 20, country: 'Australia',      state: 'New South Wales',    city: 'Sydney',    inFlows: 1, outFlows: 0, isMyASN: false },
];

// ─── Sankey links ──────────────────────────────────────────────────────────────
// Traffic is modelled as a directed graph, not a strict pipeline.
// The column order (originASN → prevPeer → upstreamPO → myASN → downstreamPO → nextPeer → destASN)
// defines LEFT-TO-RIGHT depth, but any node can connect to any node at a higher depth —
// flows can skip stages (like the UK energy Sankey where links jump across columns).
//
// Non-standard paths captured in the data:
//   • origin   ──────────────────────────────▶ upstreamPO  (skips prevPeer)
//   • prevPeer ───────────────────────────────────────────▶ myASN  (skips upstreamPO)
//   • myASN    ─────────────────────────────────────────────────────▶ nextPeer  (skips downstreamPO)
//   • downstreamPO ──────────────────────────────────────────────────────────────▶ destASN (skips nextPeer)
//   • upstreamPO with no prevPeer incoming  (acts as flow origin)
//   • downstreamPO with no nextPeer outgoing  (acts as flow sink)

// Origin ASN → Previous Peer
export const originToPrevLinks: SankeyLink[] = [
  { source: 'origin-15169', target: 'prev-174',  value: 25, trafficGbps: 25, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 72 } },
  { source: 'origin-15169', target: 'prev-3356', value: 20, trafficGbps: 20, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 68 } },
  { source: 'origin-13335', target: 'prev-174',  value: 22, trafficGbps: 22, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 85 } },
  { source: 'origin-13335', target: 'prev-1299', value: 16, trafficGbps: 16, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 78 } },
  { source: 'origin-16509', target: 'prev-3356', value: 18, trafficGbps: 18, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 65 } },
  { source: 'origin-16509', target: 'prev-6939', value: 14, trafficGbps: 14, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 58 } },
  { source: 'origin-8075',  target: 'prev-6939', value: 15, trafficGbps: 15, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 62 } },
  { source: 'origin-8075',  target: 'prev-1299', value: 13, trafficGbps: 13, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 55 } },
  { source: 'origin-32934', target: 'prev-174',  value: 22, trafficGbps: 22, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 75 } },
];

// Previous Peer → Upstream PO (traffic enters customer's protected prefix ranges)
// upo-64512-1 (NYC-WebFarm 35G): prev-174 28 + prev-3356 7 = 35 ✓
// upo-64512-2 (NYC-Hosting 40G): prev-174 10 + prev-3356 15 + prev-6939 15 = 40 ✓
// upo-64513-1 (LAX-Anycast 47G): prev-174 31 + prev-3356 16 = 47 ✓
// upo-64514-1 (FRA-Enterprise 43G): prev-1299 29 + prev-6939 14 = 43 ✓
export const prevToUpstreamPOLinks: SankeyLink[] = [
  { source: 'prev-174',  target: 'san-upo-64512-1', value: 28, trafficGbps: 28, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 70 } },
  { source: 'prev-3356', target: 'san-upo-64512-1', value:  7, trafficGbps:  7, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 65 } },
  { source: 'prev-174',  target: 'san-upo-64512-2', value: 10, trafficGbps: 10, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 68 } },
  { source: 'prev-3356', target: 'san-upo-64512-2', value: 15, trafficGbps: 15, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 63 } },
  { source: 'prev-6939', target: 'san-upo-64512-2', value: 15, trafficGbps: 15, topProtocol: 'UDP', topApplication: { port: 53,  name: 'DNS',   percent: 35 } },
  { source: 'prev-174',  target: 'san-upo-64513-1', value: 31, trafficGbps: 31, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 68 } },
  { source: 'prev-3356', target: 'san-upo-64513-1', value: 16, trafficGbps: 16, topProtocol: 'TCP', topApplication: { port: 80,  name: 'HTTP',  percent: 45 } },
  { source: 'prev-1299', target: 'san-upo-64514-1', value: 29, trafficGbps: 29, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 72 } },
  { source: 'prev-6939', target: 'san-upo-64514-1', value: 14, trafficGbps: 14, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 60 } },
];

// Upstream PO → My ASN (collapsed view only; expanded view goes upo → ingress iface)
// san-upo-64513-2 has NO incoming links — it is a flow ORIGIN (generates traffic itself).
export const upstreamPOToMyAsnLinks: SankeyLink[] = [
  { source: 'san-upo-64512-1', target: 'my-64512', value: 35, trafficGbps: 35, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 70 } },
  { source: 'san-upo-64512-2', target: 'my-64512', value: 40, trafficGbps: 40, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 65 } },
  { source: 'san-upo-64513-1', target: 'my-64513', value: 47, trafficGbps: 47, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 62 } },
  { source: 'san-upo-64513-2', target: 'my-64513', value: 18, trafficGbps: 18, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 72 } },
  { source: 'san-upo-64514-1', target: 'my-64514', value: 43, trafficGbps: 43, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 70 } },
];

// My ASN → Downstream PO (collapsed view only; expanded view goes egress iface → dpo)
// san-dpo-64512-2 has NO outgoing links — it is a flow DESTINATION (traffic terminates here).
export const myAsnToDownstreamPOLinks: SankeyLink[] = [
  { source: 'my-64512', target: 'san-dpo-64512-1', value: 75, trafficGbps: 75, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 68 } },
  { source: 'my-64512', target: 'san-dpo-64512-2', value: 12, trafficGbps: 12, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 74 } },
  { source: 'my-64513', target: 'san-dpo-64513-1', value: 47, trafficGbps: 47, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 60 } },
  { source: 'my-64514', target: 'san-dpo-64514-1', value: 43, trafficGbps: 43, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 72 } },
];

// Downstream PO → Next Peer
// dpo-64512 (NYC-CDN-Out 75G): next-2914 35 + next-7018 25 + next-3257 15 = 75 ✓
// dpo-64513 (LAX-Transit-Out 47G): next-7018 28 + next-3257 19 = 47 ✓
// dpo-64514 (FRA-EU-Out 43G): next-2914 30 + next-3257 13 = 43 ✓
export const downstreamPOToNextLinks: SankeyLink[] = [
  { source: 'san-dpo-64512-1', target: 'next-2914', value: 35, trafficGbps: 35, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 68 } },
  { source: 'san-dpo-64512-1', target: 'next-7018', value: 25, trafficGbps: 25, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 62 } },
  { source: 'san-dpo-64512-1', target: 'next-3257', value: 15, trafficGbps: 15, topProtocol: 'TCP', topApplication: { port: 22,  name: 'SSH',   percent: 28 } },
  { source: 'san-dpo-64513-1', target: 'next-7018', value: 28, trafficGbps: 28, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 58 } },
  { source: 'san-dpo-64513-1', target: 'next-3257', value: 19, trafficGbps: 19, topProtocol: 'UDP', topApplication: { port: 443, name: 'QUIC',  percent: 42 } },
  { source: 'san-dpo-64514-1', target: 'next-2914', value: 30, trafficGbps: 30, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 75 } },
  { source: 'san-dpo-64514-1', target: 'next-3257', value: 13, trafficGbps: 13, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 65 } },
];

// Next Peer → Destination ASN
export const nextToDestLinks: SankeyLink[] = [
  { source: 'next-2914', target: 'dest-enterprise1', value: 33, trafficGbps: 33, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 72 } },
  { source: 'next-2914', target: 'dest-enterprise3', value: 32, trafficGbps: 32, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 68 } },
  { source: 'next-7018', target: 'dest-enterprise1', value: 12, trafficGbps: 12, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 55 } },
  { source: 'next-7018', target: 'dest-enterprise2', value: 30, trafficGbps: 30, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 62 } },
  { source: 'next-7018', target: 'dest-enterprise4', value: 11, trafficGbps: 11, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 58 } },
  { source: 'next-3257', target: 'dest-enterprise2', value: 15, trafficGbps: 15, topProtocol: 'TCP', topApplication: { port: 80,  name: 'HTTP',  percent: 45 } },
  { source: 'next-3257', target: 'dest-enterprise4', value: 12, trafficGbps: 12, topProtocol: 'UDP', topApplication: { port: 53,  name: 'DNS',   percent: 32 } },
  { source: 'next-3257', target: 'dest-enterprise5', value: 20, trafficGbps: 20, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 70 } },
];

// ── Non-linear / skip-stage paths ─────────────────────────────────────────────
// These represent real network scenarios where traffic takes shorter or longer paths
// than the full pipeline. ECharts renders these as arcs that "jump" across columns.

// Origin ASN → Upstream PO directly (skipping Previous Peer)
// e.g. an origin that has a direct peering arrangement with the customer's prefix
// — traffic enters the protected prefix without transiting an intermediate provider.
export const originToUpstreamPOLinks: SankeyLink[] = [
  // Meta has a direct connection into NYC-Hosting (prefixes announced directly)
  { source: 'origin-32934', target: 'san-upo-64512-2', value: 10, trafficGbps: 10, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 78 } },
  // Amazon reaches FRA-Enterprise directly (transatlantic direct peering)
  { source: 'origin-16509', target: 'san-upo-64514-1', value:  8, trafficGbps:  8, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 62 } },
];

// Previous Peer → My ASN directly (skipping Upstream PO)
// e.g. transit traffic that is NOT destined for a protected prefix —
// it enters the customer network without being matched to any PO.
export const prevToMyAsnDirectLinks: SankeyLink[] = [
  // Telia carries some non-PO transit traffic directly into MyNet-Core
  { source: 'prev-1299', target: 'my-64512', value:  8, trafficGbps:  8, topProtocol: 'TCP', topApplication: { port: 80,  name: 'HTTP',  percent: 52 } },
  // Hurricane Electric delivers some traffic to MyNet-EU without PO matching
  { source: 'prev-6939', target: 'my-64514', value:  6, trafficGbps:  6, topProtocol: 'UDP', topApplication: { port: 53,  name: 'DNS',   percent: 44 } },
];

// My ASN → Next Peer directly (skipping Downstream PO)
// e.g. traffic originating inside the customer network that exits without going
// through a monitored/protected egress prefix.
export const myAsnToNextDirectLinks: SankeyLink[] = [
  // MyNet-Core sends some traffic to NTT that bypasses the CDN-Out PO
  { source: 'my-64512', target: 'next-2914', value:  7, trafficGbps:  7, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 55 } },
  // MyNet-EU exits directly to GTT for some flows
  { source: 'my-64514', target: 'next-3257', value:  6, trafficGbps:  6, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 60 } },
];

// Downstream PO → Destination ASN directly (skipping Next Peer)
// e.g. the protected egress prefix has a direct route to the final destination
// without any additional transit hop.
export const downstreamPOToDestLinks: SankeyLink[] = [
  // NYC-CDN-Out has a direct peering route to Enterprise-D (Japan)
  { source: 'san-dpo-64512-1', target: 'dest-enterprise4', value: 8, trafficGbps: 8, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 65 } },
  // FRA-EU-Out connects directly to Enterprise-B (London)
  { source: 'san-dpo-64514-1', target: 'dest-enterprise2', value: 7, trafficGbps: 7, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 70 } },
];


// ─── Expanded My ASN nodes (ingress interface → router → egress interface) ────
// Per-ASN record; used when that ASN is expanded in the Sankey.

export const myAsnExpandedNodes: Record<string, SankeyNode[]> = {
  // ── MyNet-Core (AS64512) — 75 G in / 75 G out ─────────────────────────────
  // Routers: NYC-Core-01 (rtr-nyc-01) and NYC-Edge-01 (rtr-nyc-02)
  'my-64512': [
    // Ingress interfaces
    { id: 'san-ing-64512-nyc01-eth00', name: 'Eth0/0', asnNumber: 64512, stage: 'myIngressInterface', nodeType: 'interface', trafficGbps: 36, country: 'United States', state: 'New York', city: 'New York', inFlows: 2, outFlows: 1, isMyASN: true, parentAsnId: 'my-64512', routerDisplayName: 'NYC-Core-01', interfaceDir: 'ingress' },
    { id: 'san-ing-64512-nyc01-eth01', name: 'Eth0/1', asnNumber: 64512, stage: 'myIngressInterface', nodeType: 'interface', trafficGbps: 25, country: 'United States', state: 'New York', city: 'New York', inFlows: 2, outFlows: 1, isMyASN: true, parentAsnId: 'my-64512', routerDisplayName: 'NYC-Core-01', interfaceDir: 'ingress' },
    { id: 'san-ing-64512-nyc02-ge00',  name: 'GigE0/0', asnNumber: 64512, stage: 'myIngressInterface', nodeType: 'interface', trafficGbps: 14, country: 'United States', state: 'New York', city: 'New York', inFlows: 2, outFlows: 1, isMyASN: true, parentAsnId: 'my-64512', routerDisplayName: 'NYC-Edge-01', interfaceDir: 'ingress' },
    // Routers
    { id: 'san-rtr-64512-nyc01', name: 'NYC-Core-01', asnNumber: 64512, stage: 'myRouter', nodeType: 'router', trafficGbps: 61, country: 'United States', state: 'New York', city: 'New York', inFlows: 2, outFlows: 2, isMyASN: true, parentAsnId: 'my-64512' },
    { id: 'san-rtr-64512-nyc02', name: 'NYC-Edge-01', asnNumber: 64512, stage: 'myRouter', nodeType: 'router', trafficGbps: 14, country: 'United States', state: 'New York', city: 'New York', inFlows: 1, outFlows: 1, isMyASN: true, parentAsnId: 'my-64512' },
  ],

  // ── MyNet-West (AS64513) — 47 G in / 47 G out ─────────────────────────────
  // Router: LAX-Core-01 (rtr-lax-01)
  'my-64513': [
    { id: 'san-ing-64513-lax01-te00', name: 'Te0/0',  asnNumber: 64513, stage: 'myIngressInterface', nodeType: 'interface', trafficGbps: 28, country: 'United States', state: 'California', city: 'Los Angeles', inFlows: 2, outFlows: 1, isMyASN: true, parentAsnId: 'my-64513', routerDisplayName: 'LAX-Core-01', interfaceDir: 'ingress' },
    { id: 'san-ing-64513-lax01-te01', name: 'Te0/1',  asnNumber: 64513, stage: 'myIngressInterface', nodeType: 'interface', trafficGbps: 19, country: 'United States', state: 'California', city: 'Los Angeles', inFlows: 2, outFlows: 1, isMyASN: true, parentAsnId: 'my-64513', routerDisplayName: 'LAX-Core-01', interfaceDir: 'ingress' },
    { id: 'san-rtr-64513-lax01',      name: 'LAX-Core-01', asnNumber: 64513, stage: 'myRouter', nodeType: 'router', trafficGbps: 47, country: 'United States', state: 'California', city: 'Los Angeles', inFlows: 2, outFlows: 1, isMyASN: true, parentAsnId: 'my-64513' },
  ],

  // ── MyNet-EU (AS64514) — 43 G in / 43 G out ───────────────────────────────
  // Router: FRA-Core-01 (rtr-fra-01)
  'my-64514': [
    { id: 'san-ing-64514-fra01-h00', name: 'Hu0/0', asnNumber: 64514, stage: 'myIngressInterface', nodeType: 'interface', trafficGbps: 43, country: 'Germany', state: 'Hesse', city: 'Frankfurt', inFlows: 2, outFlows: 1, isMyASN: true, parentAsnId: 'my-64514', routerDisplayName: 'FRA-Core-01', interfaceDir: 'ingress' },
    { id: 'san-rtr-64514-fra01',     name: 'FRA-Core-01', asnNumber: 64514, stage: 'myRouter', nodeType: 'router', trafficGbps: 43, country: 'Germany', state: 'Hesse', city: 'Frankfurt', inFlows: 1, outFlows: 1, isMyASN: true, parentAsnId: 'my-64514' },
  ],
};

// ─── Expanded links per My ASN ─────────────────────────────────────────────────
// When a My ASN is expanded, upstream POs connect to ingress ifaces and egress ifaces
// connect to downstream POs (instead of the collapsed upo→myASN→dpo links).
// prevToUpstreamPOLinks and downstreamPOToNextLinks remain in play unchanged.

export const myAsnExpandedLinks: Record<string, SankeyLink[]> = {
  // ── MyNet-Core (AS64512) expanded links ────────────────────────────────────
  // Upstream PO totals:  upo-1=35 (eth00 20 + eth01 15), upo-2=40 (eth00 16 + eth01 10 + ge00 14)
  // Ingress totals: Eth0/0=36, Eth0/1=25, GigE0/0=14 → total 75 ✓
  // Router totals:  NYC-Core-01=61, NYC-Edge-01=14 → total 75 ✓
  // Downstream PO: routers → dpo-64512-1 = 75 ✓
  'my-64512': [
    // Upstream PO → Ingress
    { source: 'san-upo-64512-1', target: 'san-ing-64512-nyc01-eth00', value: 20, trafficGbps: 20, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 72 } },
    { source: 'san-upo-64512-1', target: 'san-ing-64512-nyc01-eth01', value: 15, trafficGbps: 15, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 68 } },
    { source: 'san-upo-64512-2', target: 'san-ing-64512-nyc01-eth00', value: 16, trafficGbps: 16, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 65 } },
    { source: 'san-upo-64512-2', target: 'san-ing-64512-nyc01-eth01', value: 10, trafficGbps: 10, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 60 } },
    { source: 'san-upo-64512-2', target: 'san-ing-64512-nyc02-ge00',  value: 14, trafficGbps: 14, topProtocol: 'UDP', topApplication: { port: 53,  name: 'DNS',   percent: 36 } },
    // Ingress → Router
    { source: 'san-ing-64512-nyc01-eth00', target: 'san-rtr-64512-nyc01', value: 36, trafficGbps: 36, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 70 } },
    { source: 'san-ing-64512-nyc01-eth01', target: 'san-rtr-64512-nyc01', value: 25, trafficGbps: 25, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 65 } },
    { source: 'san-ing-64512-nyc02-ge00',  target: 'san-rtr-64512-nyc02', value: 14, trafficGbps: 14, topProtocol: 'UDP', topApplication: { port: 53,  name: 'DNS',   percent: 36 } },
    // Router → Downstream PO
    { source: 'san-rtr-64512-nyc01', target: 'san-dpo-64512-1', value: 61, trafficGbps: 61, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 68 } },
    { source: 'san-rtr-64512-nyc02', target: 'san-dpo-64512-1', value: 14, trafficGbps: 14, topProtocol: 'UDP', topApplication: { port: 53,  name: 'DNS',   percent: 36 } },
    // Router → Downstream PO (pure-sink: NYC-Direct-In has no onward connections)
    { source: 'san-rtr-64512-nyc01', target: 'san-dpo-64512-2', value: 12, trafficGbps: 12, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 74 } },
  ],

  // ── MyNet-West (AS64513) expanded links ────────────────────────────────────
  // upo-64513-1 (47G) → Te0/0 28 + Te0/1 19 = 47
  // upo-64513-2 (18G, pure-origin) → Te0/0 18   (generates traffic; no upstream peers)
  // Ingress: Te0/0=46, Te0/1=19 → Router: LAX-Core-01=65 → dpo-64513-1
  'my-64513': [
    { source: 'san-upo-64513-1', target: 'san-ing-64513-lax01-te00', value: 28, trafficGbps: 28, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 68 } },
    { source: 'san-upo-64513-1', target: 'san-ing-64513-lax01-te01', value: 19, trafficGbps: 19, topProtocol: 'TCP', topApplication: { port: 80,  name: 'HTTP',  percent: 44 } },
    // Pure-origin PO: LAX-Servers generates 18G with no upstream peers
    { source: 'san-upo-64513-2', target: 'san-ing-64513-lax01-te00', value: 18, trafficGbps: 18, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 72 } },
    { source: 'san-ing-64513-lax01-te00', target: 'san-rtr-64513-lax01', value: 46, trafficGbps: 46, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 62 } },
    { source: 'san-ing-64513-lax01-te01', target: 'san-rtr-64513-lax01', value: 19, trafficGbps: 19, topProtocol: 'TCP', topApplication: { port: 80,  name: 'HTTP',  percent: 44 } },
    // Router → Downstream PO
    { source: 'san-rtr-64513-lax01', target: 'san-dpo-64513-1', value: 65, trafficGbps: 65, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 58 } },
  ],

  // ── MyNet-EU (AS64514) expanded links ─────────────────────────────────────
  // upo-64514-1 (43G) → Hu0/0 43 ✓  Router: FRA-Core-01=43 ✓  dpo-64514-1: 43 ✓
  'my-64514': [
    { source: 'san-upo-64514-1',        target: 'san-ing-64514-fra01-h00', value: 43, trafficGbps: 43, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 72 } },
    { source: 'san-ing-64514-fra01-h00', target: 'san-rtr-64514-fra01',    value: 43, trafficGbps: 43, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 72 } },
    // Router → Downstream PO
    { source: 'san-rtr-64514-fra01',     target: 'san-dpo-64514-1',        value: 43, trafficGbps: 43, topProtocol: 'TCP', topApplication: { port: 443, name: 'HTTPS', percent: 72 } },
  ],
};

// Flat export — all links in the collapsed view (used by other consumers)
export const sankeyLinks: SankeyLink[] = [
  ...originToPrevLinks,
  ...originToUpstreamPOLinks,
  ...prevToUpstreamPOLinks,
  ...prevToMyAsnDirectLinks,
  ...upstreamPOToMyAsnLinks,
  ...myAsnToDownstreamPOLinks,
  ...myAsnToNextDirectLinks,
  ...downstreamPOToNextLinks,
  ...downstreamPOToDestLinks,
  ...nextToDestLinks,
];

// Generate time series traffic data
export function generateTrafficData(hours: number = 24): TrafficDataPoint[] {
  const data: TrafficDataPoint[] = [];
  const now = new Date();

  for (let i = hours; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
    const baseTraffic = 80 + Math.sin(i / 4) * 20;

    data.push({
      timestamp: timestamp.toISOString(),
      total: baseTraffic + Math.random() * 15,
      inbound: (baseTraffic * 0.35) + Math.random() * 8,
      outbound: (baseTraffic * 0.30) + Math.random() * 6,
      internal: (baseTraffic * 0.15) + Math.random() * 4,
      transit: (baseTraffic * 0.20) + Math.random() * 5,
    });
  }

  return data;
}

// Protocol data
export const protocolData = [
  { name: 'TCP', value: 65, bps: 83200000000, pps: 12500000 },
  { name: 'UDP', value: 28, bps: 35840000000, pps: 8200000 },
  { name: 'ICMP', value: 3, bps: 3840000000, pps: 950000 },
  { name: 'GRE', value: 2, bps: 2560000000, pps: 420000 },
  { name: 'Other', value: 2, bps: 2560000000, pps: 380000 },
];

// Top applications
export const topApplications: Application[] = [
  { name: 'HTTPS', port: 443, trafficBps: 52480000000, trafficPps: 8500000, percent: 41 },
  { name: 'HTTP', port: 80, trafficBps: 19200000000, trafficPps: 3200000, percent: 15 },
  { name: 'DNS', port: 53, trafficBps: 12800000000, trafficPps: 4800000, percent: 10 },
  { name: 'SSH', port: 22, trafficBps: 8960000000, trafficPps: 1200000, percent: 7 },
  { name: 'QUIC', port: 443, trafficBps: 7680000000, trafficPps: 980000, percent: 6 },
  { name: 'SMTP', port: 25, trafficBps: 5120000000, trafficPps: 720000, percent: 4 },
  { name: 'FTP', port: 21, trafficBps: 3840000000, trafficPps: 450000, percent: 3 },
  { name: 'NTP', port: 123, trafficBps: 2560000000, trafficPps: 580000, percent: 2 },
  { name: 'MySQL', port: 3306, trafficBps: 2560000000, trafficPps: 320000, percent: 2 },
  { name: 'Other', port: 0, trafficBps: 12800000000, trafficPps: 2100000, percent: 10 },
];

// ASN Path Analysis Table data
export const asnPathTableData: ASNPathTableRow[] = [
  {
    id: 'row-1',
    origin: { name: 'Google', number: 15169 },
    myASN: { name: 'MyNet-Core', number: 64512 },
    destination: { name: 'Enterprise-A', number: 65001 },
    originGeo: { city: 'Mountain View', country: 'United States' },
    destinationGeo: { city: 'New York', country: 'United States' },
    trafficGbps: 45.2,
    totalTrafficTB: 4.52,
    flowCount: 125000,
    averageFlowSizeMB: 38.2,
    peakTrafficGbps: 62.8,
    protocolMix: '68% TCP, 28% UDP, 4% Other',
    topPort: '443 (HTTPS) 72%',
    trendPercent: 12.5,
    percentOfTotal: 15.2,
  },
  {
    id: 'row-2',
    origin: { name: 'Cloudflare', number: 13335 },
    myASN: { name: 'MyNet-Core', number: 64512 },
    destination: { name: 'Enterprise-B', number: 65002 },
    originGeo: { city: 'San Francisco', country: 'United States' },
    destinationGeo: { city: 'London', country: 'United Kingdom' },
    trafficGbps: 38.7,
    totalTrafficTB: 3.87,
    flowCount: 98000,
    averageFlowSizeMB: 41.5,
    peakTrafficGbps: 52.3,
    protocolMix: '72% TCP, 24% UDP, 4% Other',
    topPort: '443 (HTTPS) 85%',
    trendPercent: 8.2,
    percentOfTotal: 13.0,
  },
  {
    id: 'row-3',
    origin: { name: 'Amazon', number: 16509 },
    myASN: { name: 'MyNet-West', number: 64513 },
    destination: { name: 'Enterprise-C', number: 65003 },
    originGeo: { city: 'Seattle', country: 'United States' },
    destinationGeo: { city: 'Frankfurt', country: 'Germany' },
    trafficGbps: 32.1,
    totalTrafficTB: 3.21,
    flowCount: 82000,
    averageFlowSizeMB: 41.2,
    peakTrafficGbps: 48.5,
    protocolMix: '65% TCP, 30% UDP, 5% Other',
    topPort: '443 (HTTPS) 65%',
    trendPercent: -3.5,
    percentOfTotal: 10.8,
  },
  {
    id: 'row-4',
    origin: { name: 'Microsoft', number: 8075 },
    myASN: { name: 'MyNet-EU', number: 64514 },
    destination: { name: 'Enterprise-D', number: 65004 },
    originGeo: { city: 'Redmond', country: 'United States' },
    destinationGeo: { city: 'Tokyo', country: 'Japan' },
    trafficGbps: 28.5,
    totalTrafficTB: 2.85,
    flowCount: 72000,
    averageFlowSizeMB: 41.7,
    peakTrafficGbps: 42.1,
    protocolMix: '70% TCP, 25% UDP, 5% Other',
    topPort: '443 (HTTPS) 62%',
    trendPercent: 5.8,
    percentOfTotal: 9.6,
  },
  {
    id: 'row-5',
    origin: { name: 'Meta', number: 32934 },
    myASN: { name: 'MyNet-Core', number: 64512 },
    destination: { name: 'Enterprise-E', number: 65005 },
    originGeo: { city: 'Menlo Park', country: 'United States' },
    destinationGeo: { city: 'Sydney', country: 'Australia' },
    trafficGbps: 22.3,
    totalTrafficTB: 2.23,
    flowCount: 58000,
    averageFlowSizeMB: 40.5,
    peakTrafficGbps: 35.2,
    protocolMix: '75% TCP, 20% UDP, 5% Other',
    topPort: '443 (HTTPS) 75%',
    trendPercent: 18.2,
    percentOfTotal: 7.5,
  },
];

// Sunburst data for My ASN popup
export function getSunburstDataForASN(asnId: number): SunburstData {
  const asn = myASNs.find(a => a.id === asnId);
  const asnRouters = routers.filter(r => r.asnId === asnId);

  const totalTraffic = asnRouters.reduce((sum, r) =>
    sum + r.interfaces.reduce((s, i) => s + i.trafficGbps, 0), 0
  );

  return {
    name: asn?.name || 'Unknown',
    value: totalTraffic,
    percent: 100,
    children: asnRouters.map(router => {
      const routerTraffic = router.interfaces.reduce((s, i) => s + i.trafficGbps, 0);
      return {
        name: router.name,
        value: routerTraffic,
        percent: (routerTraffic / totalTraffic) * 100,
        children: router.interfaces.map(iface => ({
          name: iface.name,
          value: iface.trafficGbps,
          percent: iface.trafficPercent,
        })),
      };
    }),
  };
}

// Sample queries — 15 published + 5 drafts, all using the 10 approved metrics
export const sampleQueries: Query[] = [
  // ── Published queries ──────────────────────────────────────────────
  {
    id: 'query-1',
    name: 'Inbound Traffic per Router',
    description: 'Time series of inbound traffic broken down by router, filtered to Madrid destination',
    script: `SELECT time, Router_name, SUM(Traffic) AS total_traffic\nFROM flows\nWHERE Dst_PO = 'Madrid'\nGROUP BY time, Router_name\nORDER BY time`,
    graphType: 'timeSeries',
    isDraft: false,
    lastEdited: '2026-02-08T10:30:00Z',
    createdBy: 'user-1',
    widgets: [
      {
        id: 'widget-q1-1',
        name: 'Router Traffic Timeline',
        graphType: 'timeSeries',
        chartConfig: { chartType: 'timeSeries', timeColumn: 'time', valueColumns: ['total_traffic'], groupByColumn: 'Router_name' },
      },
      {
        id: 'widget-q1-2',
        name: 'Stacked Area by Router',
        graphType: 'stackedArea',
        chartConfig: { chartType: 'stackedArea', timeColumn: 'time', valueColumns: ['total_traffic'], groupByColumn: 'Router_name' },
      },
    ],
  },
  {
    id: 'query-2',
    name: 'Protocol Traffic Over Time',
    description: 'Stacked area showing traffic by protocol over time for NYC-Core-01',
    script: `SELECT time, Protocol, SUM(Traffic) AS total_traffic\nFROM flows\nWHERE Router_name = 'NYC-Core-01'\nGROUP BY time, Protocol\nORDER BY time`,
    graphType: 'stackedArea',
    isDraft: false,
    lastEdited: '2026-02-07T14:20:00Z',
    createdBy: 'user-1',
    widgets: [
      {
        id: 'widget-q2-1',
        name: 'Protocol Stacked Area',
        graphType: 'stackedArea',
        chartConfig: { chartType: 'stackedArea', timeColumn: 'time', valueColumns: ['total_traffic'], groupByColumn: 'Protocol' },
      },
      {
        id: 'widget-q2-2',
        name: 'Protocol Time Series Lines',
        graphType: 'timeSeries',
        chartConfig: { chartType: 'timeSeries', timeColumn: 'time', valueColumns: ['total_traffic'], groupByColumn: 'Protocol' },
      },
    ],
  },
  {
    id: 'query-3',
    name: 'Top Routers by Traffic',
    description: 'Bar chart of total traffic per router, filtered to US, DE and JP sources',
    script: `SELECT Router_name, SUM(Traffic) AS total_traffic\nFROM flows\nWHERE Src_Country IN ('United States', 'Germany', 'Japan')\nGROUP BY Router_name\nORDER BY total_traffic DESC\nLIMIT 10`,
    graphType: 'bar',
    isDraft: false,
    lastEdited: '2026-02-06T09:15:00Z',
    createdBy: 'user-1',
    widgets: [
      {
        id: 'widget-q3-1',
        name: 'Router Ranking Bar',
        graphType: 'bar',
        chartConfig: { chartType: 'bar', categoryColumn: 'Router_name', valueColumn: 'total_traffic', sortOrder: 'desc', orientation: 'vertical' },
      },
      {
        id: 'widget-q3-2',
        name: 'Router Horizontal Bar',
        graphType: 'topNBar',
        chartConfig: { chartType: 'topNBar', categoryColumn: 'Router_name', valueColumn: 'total_traffic', sortOrder: 'desc', orientation: 'horizontal', limit: 10 },
      },
    ],
  },
  {
    id: 'query-4',
    name: 'Top 10 Source ASNs by Packets',
    description: 'Horizontal bar chart showing top 10 source ASNs by TCP packet count',
    script: `SELECT Src_ASN, SUM(Packets) AS total_packets\nFROM flows\nWHERE Protocol = 'TCP'\nGROUP BY Src_ASN\nORDER BY total_packets DESC\nLIMIT 10`,
    graphType: 'topNBar',
    isDraft: false,
    lastEdited: '2026-02-05T16:45:00Z',
    createdBy: 'user-1',
    widgets: [
      {
        id: 'widget-q4-1',
        name: 'ASN Packet Ranking (Horizontal)',
        graphType: 'topNBar',
        chartConfig: { chartType: 'topNBar', categoryColumn: 'Src_ASN', valueColumn: 'total_packets', sortOrder: 'desc', orientation: 'horizontal', limit: 10 },
      },
      {
        id: 'widget-q4-2',
        name: 'ASN Packet Bar (Vertical)',
        graphType: 'bar',
        chartConfig: { chartType: 'bar', categoryColumn: 'Src_ASN', valueColumn: 'total_packets', sortOrder: 'desc', orientation: 'vertical', yAxisLabel: 'Packets' },
      },
    ],
  },
  {
    id: 'query-5',
    name: 'Protocol Distribution',
    description: 'Pie chart showing traffic share by protocol on NYC-Edge-01',
    script: `SELECT Protocol, SUM(Traffic) AS total_traffic\nFROM flows\nWHERE Router_name = 'NYC-Edge-01'\nGROUP BY Protocol`,
    graphType: 'pie',
    isDraft: false,
    lastEdited: '2026-02-04T11:30:00Z',
    createdBy: 'user-1',
    widgets: [
      {
        id: 'widget-q5-1',
        name: 'Protocol Pie Chart',
        graphType: 'pie',
        chartConfig: { chartType: 'pie', categoryColumn: 'Protocol', valueColumn: 'total_traffic' },
      },
      {
        id: 'widget-q5-2',
        name: 'Protocol Donut Chart',
        graphType: 'donut',
        chartConfig: { chartType: 'donut', categoryColumn: 'Protocol', valueColumn: 'total_traffic' },
      },
      {
        id: 'widget-q5-3',
        name: 'Protocol Traffic Bar',
        graphType: 'bar',
        chartConfig: { chartType: 'bar', categoryColumn: 'Protocol', valueColumn: 'total_traffic', sortOrder: 'desc', orientation: 'horizontal' },
      },
    ],
  },
  {
    id: 'query-6',
    name: 'Application Traffic Share',
    description: 'Donut chart showing bytes by application for US traffic',
    script: `SELECT Application, SUM(Bytes) AS total_bytes\nFROM flows\nGROUP BY Application\nORDER BY total_bytes DESC\nLIMIT 8`,
    graphType: 'donut',
    isDraft: false,
    lastEdited: '2026-02-03T18:00:00Z',
    createdBy: 'user-1',
    widgets: [
      {
        id: 'widget-q6-1',
        name: 'App Share Donut',
        graphType: 'donut',
        chartConfig: { chartType: 'donut', categoryColumn: 'Application', valueColumn: 'total_bytes', limit: 8 },
      },
      {
        id: 'widget-q6-2',
        name: 'App Share Pie',
        graphType: 'pie',
        chartConfig: { chartType: 'pie', categoryColumn: 'Application', valueColumn: 'total_bytes', limit: 8 },
      },
      {
        id: 'widget-q6-3',
        name: 'Top Apps Bar',
        graphType: 'topNBar',
        chartConfig: { chartType: 'topNBar', categoryColumn: 'Application', valueColumn: 'total_bytes', sortOrder: 'desc', orientation: 'horizontal', limit: 8 },
      },
    ],
  },
  {
    id: 'query-7',
    name: 'Total Inbound Traffic',
    description: 'Single value KPI showing total inbound traffic',
    script: `SELECT SUM(Traffic) AS total_inbound\nFROM flows\nWHERE Direction = 'Inbound'`,
    graphType: 'singleValue',
    isDraft: false,
    lastEdited: '2026-02-03T09:00:00Z',
    createdBy: 'user-1',
    widgets: [
      {
        id: 'widget-q7-1',
        name: 'Inbound Traffic KPI',
        graphType: 'singleValue',
        chartConfig: { chartType: 'singleValue', valueColumn: 'total_inbound', label: 'Total Inbound Traffic', unit: 'Gbps' },
      },
    ],
  },
  {
    id: 'query-8',
    name: 'Active Flows Count',
    description: 'Single value showing active TCP flow count',
    script: `SELECT SUM(Flows) AS active_flows\nFROM flows\nWHERE Protocol = 'TCP'`,
    graphType: 'singleValue',
    isDraft: false,
    lastEdited: '2026-02-02T15:20:00Z',
    createdBy: 'user-1',
    widgets: [
      {
        id: 'widget-q8-1',
        name: 'Active TCP Flows KPI',
        graphType: 'singleValue',
        chartConfig: { chartType: 'singleValue', valueColumn: 'active_flows', label: 'Active TCP Flows', unit: 'flows' },
      },
    ],
  },
  {
    id: 'query-9',
    name: 'Average TTL Gauge',
    description: 'Gauge showing average TTL for NYC-Core-01 with warning thresholds',
    script: `SELECT AVG(TTL) AS avg_ttl\nFROM flows\nWHERE Router_name = 'NYC-Core-01'`,
    graphType: 'gauge',
    chartConfig: { chartType: 'gauge', valueColumn: 'avg_ttl', min: 0, max: 128, thresholds: [60, 100], label: 'Avg TTL (s)' },
    isDraft: false,
    lastEdited: '2026-02-01T12:00:00Z',
    createdBy: 'user-1',
    widgets: [
      {
        id: 'widget-q9-1',
        name: 'TTL Health Gauge',
        graphType: 'gauge',
        chartConfig: { chartType: 'gauge', valueColumn: 'avg_ttl', min: 0, max: 128, thresholds: [60, 100], label: 'Avg TTL (s)' },
      },
    ],
  },
  {
    id: 'query-10',
    name: 'TCP Flag Anomaly Heatmap',
    description: 'Heatmap of TCP flag counts by source ASN and hour of day for anomaly detection',
    script: `SELECT Src_ASN, Hour, SUM(TCPFlags) AS flag_count\nFROM flows\nWHERE Protocol = 'TCP'\nGROUP BY Src_ASN, Hour`,
    graphType: 'heatmap',
    isDraft: false,
    lastEdited: '2026-01-31T10:45:00Z',
    createdBy: 'user-1',
    widgets: [
      {
        id: 'widget-q10-1',
        name: 'TCP Flag Anomaly Heatmap',
        graphType: 'heatmap',
        chartConfig: { chartType: 'heatmap', xColumn: 'Src_ASN', yColumn: 'Hour', valueColumn: 'flag_count', xAxisLabel: 'Source ASN', yAxisLabel: 'Hour of Day' },
      },
    ],
  },
  {
    id: 'query-11',
    name: 'Brazil ASN Traffic Flow',
    description: 'Sankey diagram showing traffic flow from Brazilian source ASNs to destinations',
    script: `SELECT Src_ASN, Dst_ASN, SUM(Traffic) AS total_traffic\nFROM flows\nWHERE Src_Country = 'Brazil'\nGROUP BY Src_ASN, Dst_ASN`,
    graphType: 'sankey',
    isDraft: false,
    lastEdited: '2026-01-30T14:30:00Z',
    createdBy: 'user-1',
    widgets: [
      {
        id: 'widget-q11-1',
        name: 'Brazil ASN Flow Sankey',
        graphType: 'sankey',
        chartConfig: { chartType: 'sankey', nodes: [{ dimension: 'Src_ASN' }, { dimension: 'Dst_ASN' }], valueColumn: 'total_traffic' },
      },
    ],
  },
  {
    id: 'query-12',
    name: 'Traffic by Country',
    description: 'Geo map showing traffic volume by source country',
    script: `SELECT Src_Country, SUM(Traffic) AS total_traffic\nFROM flows\nGROUP BY Src_Country`,
    graphType: 'geoMap',
    isDraft: false,
    lastEdited: '2026-01-29T08:15:00Z',
    createdBy: 'user-1',
    widgets: [
      {
        id: 'widget-q12-1',
        name: 'Global Traffic Geo Map',
        graphType: 'geoMap',
        chartConfig: { chartType: 'geoMap', geoColumn: 'Src_Country', valueColumn: 'total_traffic', geoLevel: 'country' },
      },
      {
        id: 'widget-q12-2',
        name: 'Top Countries Bar',
        graphType: 'topNBar',
        chartConfig: { chartType: 'topNBar', categoryColumn: 'Src_Country', valueColumn: 'total_traffic', sortOrder: 'desc', orientation: 'horizontal', limit: 10 },
      },
    ],
  },
  {
    id: 'query-13',
    name: 'DNS Domain Analysis',
    description: 'Table showing traffic, packets and flows per DNS domain',
    script: `SELECT DNS_domain, SUM(Traffic) AS total_traffic, SUM(Packets) AS total_packets, SUM(Flows) AS total_flows\nFROM flows\nGROUP BY DNS_domain\nORDER BY total_traffic DESC\nLIMIT 20`,
    graphType: 'table',
    isDraft: false,
    lastEdited: '2026-01-28T17:00:00Z',
    createdBy: 'user-1',
    widgets: [
      {
        id: 'widget-q13-1',
        name: 'DNS Domains Table',
        graphType: 'table',
        chartConfig: { chartType: 'table', visibleColumns: ['DNS_domain', 'total_traffic', 'total_packets', 'total_flows'], sortColumn: 'total_traffic', sortDirection: 'desc' },
      },
      {
        id: 'widget-q13-2',
        name: 'Top DNS Domains Bar',
        graphType: 'bar',
        chartConfig: { chartType: 'bar', categoryColumn: 'DNS_domain', valueColumn: 'total_traffic', sortOrder: 'desc', orientation: 'horizontal', yAxisLabel: 'Traffic (Gbps)' },
      },
    ],
  },
  {
    id: 'query-14',
    name: 'Packet Rate by Protocol',
    description: 'Time series showing packet rates per protocol for DDoS detection',
    script: `SELECT time, Protocol, SUM(Packets) AS total_packets\nFROM flows\nGROUP BY time, Protocol\nORDER BY time`,
    graphType: 'timeSeries',
    isDraft: false,
    lastEdited: '2026-01-27T13:45:00Z',
    createdBy: 'user-1',
    widgets: [
      {
        id: 'widget-q14-1',
        name: 'Packet Rate Time Series',
        graphType: 'timeSeries',
        chartConfig: { chartType: 'timeSeries', timeColumn: 'time', valueColumns: ['total_packets'], groupByColumn: 'Protocol', yAxisLabel: 'Packets/s' },
      },
      {
        id: 'widget-q14-2',
        name: 'Packet Rate Area Chart',
        graphType: 'areaTimeSeries',
        chartConfig: { chartType: 'areaTimeSeries', timeColumn: 'time', valueColumns: ['total_packets'], groupByColumn: 'Protocol', yAxisLabel: 'Packets/s' },
      },
      {
        id: 'widget-q14-3',
        name: 'Packet Rate Stacked Area',
        graphType: 'stackedArea',
        chartConfig: { chartType: 'stackedArea', timeColumn: 'time', valueColumns: ['total_packets'], groupByColumn: 'Protocol' },
      },
    ],
  },
  {
    id: 'query-15',
    name: 'Complex Network Analysis',
    description: 'Multi-metric inbound analysis: traffic, packets, packet size, flow duration, fragmentation, BPP, TCP flags — grouped by source, destination and protocol',
    script: `SELECT\n  Src_Country,\n  Dst_Country,\n  Protocol,\n  SUM(Traffic) AS total_traffic,\n  SUM(Packets) AS total_packets,\n  AVG(PacketSize) AS avg_packet_size,\n  AVG(FlowDuration) AS avg_duration,\n  SUM(FragmentedPackets) AS frag_packets,\n  AVG(BitsPerPacket) AS avg_bpp,\n  SUM(TCPFlags) AS flag_count\nFROM flows\nWHERE Direction = 'Inbound'\nGROUP BY Src_Country, Dst_Country, Protocol\nORDER BY total_traffic DESC\nLIMIT 50`,
    graphType: 'table',
    isDraft: false,
    lastEdited: '2026-01-26T09:00:00Z',
    createdBy: 'user-1',
    widgets: [
      {
        id: 'widget-q15-1',
        name: 'Full Network Analysis Table',
        graphType: 'table',
        chartConfig: { chartType: 'table', visibleColumns: ['Src_Country', 'Dst_Country', 'Protocol', 'total_traffic', 'total_packets', 'avg_packet_size', 'avg_duration'], sortColumn: 'total_traffic', sortDirection: 'desc' },
      },
      {
        id: 'widget-q15-2',
        name: 'Traffic by Source Country (Geo)',
        graphType: 'geoMap',
        chartConfig: { chartType: 'geoMap', geoColumn: 'Src_Country', valueColumn: 'total_traffic', geoLevel: 'country' },
      },
    ],
  },
  {
    id: 'query-16',
    name: 'Router Traffic by Protocol',
    description: 'Stacked and grouped bar charts showing traffic per router broken down by protocol',
    script: `SELECT Router_name, Protocol, SUM(Traffic) AS total_traffic\nFROM flows\nGROUP BY Router_name, Protocol\nORDER BY total_traffic DESC\nLIMIT 50`,
    graphType: 'stackedBar',
    isDraft: false,
    lastEdited: '2026-01-25T11:00:00Z',
    createdBy: 'user-1',
    widgets: [
      {
        id: 'widget-q16-1',
        name: 'Router Protocol Stacked Bar',
        graphType: 'stackedBar',
        chartConfig: { chartType: 'stackedBar', categoryColumn: 'Router_name', valueColumn: 'total_traffic', groupByColumn: 'Protocol', yAxisLabel: 'Traffic (Gbps)' },
      },
      {
        id: 'widget-q16-2',
        name: 'Router Protocol Grouped Bar',
        graphType: 'groupedBar',
        chartConfig: { chartType: 'groupedBar', categoryColumn: 'Router_name', valueColumn: 'total_traffic', groupByColumn: 'Protocol', yAxisLabel: 'Traffic (Gbps)' },
      },
      {
        id: 'widget-q16-3',
        name: 'Router Total Traffic Bar',
        graphType: 'bar',
        chartConfig: { chartType: 'bar', categoryColumn: 'Router_name', valueColumn: 'total_traffic', sortOrder: 'desc', orientation: 'vertical', yAxisLabel: 'Traffic (Gbps)' },
      },
    ],
  },
  // ── Draft queries ──────────────────────────────────────────────────
  {
    id: 'draft-1',
    name: 'Fragmented Packet Monitoring',
    description: 'Work in progress: tracking fragmented packets over time per router',
    script: `SELECT time, Router_name, SUM(FragmentedPackets) AS frag_packets\nFROM flows\nGROUP BY time, Router_name\nORDER BY time`,
    graphType: 'timeSeries',
    isDraft: true,
    lastEdited: '2026-02-08T11:45:00Z',
    createdBy: 'user-1',
  },
  {
    id: 'draft-2',
    name: 'Peak Hour Traffic Heatmap',
    description: 'Identifying peak traffic hours across the week',
    script: `SELECT Hour, Day_week, SUM(Traffic) AS total_traffic\nFROM flows\nGROUP BY Hour, Day_week`,
    graphType: 'heatmap',
    isDraft: true,
    lastEdited: '2026-02-07T16:30:00Z',
    createdBy: 'user-1',
  },
  {
    id: 'draft-3',
    name: 'Avg Packet Size Gauge',
    description: 'Gauge for monitoring average packet size on FRA-Core-01',
    script: `SELECT AVG(PacketSize) AS avg_size\nFROM flows\nWHERE Router_name = 'FRA-Core-01'`,
    graphType: 'gauge',
    chartConfig: { chartType: 'gauge', valueColumn: 'avg_size', min: 0, max: 1500, thresholds: [200, 800], label: 'Avg Packet Size (bytes)' },
    isDraft: true,
    lastEdited: '2026-02-06T09:00:00Z',
    createdBy: 'user-1',
  },
  {
    id: 'draft-4',
    name: 'Flow Duration by Protocol',
    description: 'Comparing average flow duration across protocols over time',
    script: `SELECT time, Protocol, AVG(FlowDuration) AS avg_duration\nFROM flows\nGROUP BY time, Protocol\nORDER BY time`,
    graphType: 'stackedArea',
    isDraft: true,
    lastEdited: '2026-02-05T14:15:00Z',
    createdBy: 'user-1',
  },
  {
    id: 'draft-5',
    name: 'DNS Top Talkers',
    description: 'Top DNS domains by traffic volume on port 53',
    script: `SELECT DNS_domain, SUM(Traffic) AS total_traffic\nFROM flows\nWHERE Dst_Port = '53'\nGROUP BY DNS_domain\nORDER BY total_traffic DESC\nLIMIT 10`,
    graphType: 'bar',
    isDraft: true,
    lastEdited: '2026-02-04T10:30:00Z',
    createdBy: 'user-1',
  },
];

// Sample dashboards
export const sampleDashboards: Dashboard[] = [
  {
    id: 'dashboard-1',
    name: 'Network Overview',
    description: 'Main dashboard with key network metrics',
    queries: ['query-1', 'query-3', 'query-5', 'query-7'],
    layout: [
      { queryId: 'query-7', x: 0, y: 0, width: 3, height: 3 },
      { queryId: 'query-1', x: 3, y: 0, width: 9, height: 4 },
      { queryId: 'query-3', x: 0, y: 4, width: 6, height: 4 },
      { queryId: 'query-5', x: 6, y: 4, width: 6, height: 4 },
    ],
    createdBy: 'user-1',
    lastEdited: '2026-02-08T10:00:00Z',
  },
];

// Query language keywords for autocomplete
export const queryKeywords = {
  dimensions: [
    'Src.Country', 'Dst.Country', 'Src.City', 'Dst.City',
    'Src.ASN', 'Dst.ASN', 'Prev.ASN', 'Nxt.ASN',
    'Src.PO', 'Dst.PO', 'Src.Port', 'Dst.Port',
    'Src.IP', 'Dst.IP', 'Protocol', 'Application',
    'Router.name', 'Router.ID', 'Interface.name', 'Interface.ID',
    'Hour', 'Day.week', 'Month', 'Mitigation.rule',
    'Direction', 'Interconnection.type', 'DNS.domain',
  ],
  metrics: ['Traffic', 'Packets', 'Flows', 'Bytes', 'TTL', 'TCPFlags', 'FlowDuration', 'PacketSize', 'BitsPerPacket', 'FragmentedPackets'],
  logicalOperators: ['AND', 'OR', 'AND NOT', 'OR NOT'],
  comparisonOperators: ['IS', 'IS NOT', '==', '!=', '>', '>=', '<', '<=', 'BETWEEN'],
  aggregations: ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX', 'MEDIAN', 'P95', 'P99'],
  arithmeticOperators: ['*', '/', '-', '+'],
  graphTypes: [
    'TIME SERIES', 'STACKED AREA', 'PIE', 'GAUGE', 'SINGLE VALUE',
    'BAR', 'TOP', 'GEO', 'HEATMAP', 'SANKEY', 'TABLE', 'DONUT',
  ],
  modifiers: ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'LIMIT', 'AS', 'ASC', 'DESC', 'IN', 'BETWEEN', 'LIKE'],
};
