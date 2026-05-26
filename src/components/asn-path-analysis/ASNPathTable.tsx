import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Search, Download, ArrowUp, ArrowDown, Filter } from 'lucide-react';
import { Button } from '../common';
import { asnPathTableData } from '../../data/mockData';
import type { ASNPathTableRow } from '../../types';
import styles from './ASNPathTable.module.css';

interface ASNPathTableProps {
  data?: ASNPathTableRow[];
}

type SortField = keyof ASNPathTableRow;
type SortDirection = 'asc' | 'desc';
type FilterableColumn = 'origin' | 'myASN' | 'destination' | 'originGeo' | 'destinationGeo' | 'protocolMix' | 'topPort';

function ColumnFilter({
  values,
  selected,
  onChange,
  label,
}: {
  values: string[];
  selected: Set<string>;
  onChange: (newSelected: Set<string>) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allSelected = selected.size === values.length;

  const handleSelectAll = () => {
    if (allSelected) {
      onChange(new Set());
    } else {
      onChange(new Set(values));
    }
  };

  const handleToggle = (value: string) => {
    const next = new Set(selected);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    onChange(next);
  };

  const isFiltered = selected.size > 0 && selected.size < values.length;

  return (
    <div className={styles.columnFilter} ref={ref}>
      <button
        className={`${styles.filterBtn} ${isFiltered ? styles.filterActive : ''}`}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        title={`Filter ${label}`}
      >
        <Filter size={12} />
      </button>
      {open && (
        <div className={styles.filterDropdown} onClick={(e) => e.stopPropagation()}>
          <label className={styles.filterOption}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={handleSelectAll}
            />
            <span className={styles.filterOptionLabel}>Select All</span>
          </label>
          <div className={styles.filterDivider} />
          <div className={styles.filterList}>
            {values.map(value => (
              <label key={value} className={styles.filterOption}>
                <input
                  type="checkbox"
                  checked={selected.has(value)}
                  onChange={() => handleToggle(value)}
                />
                <span className={styles.filterOptionLabel}>{value}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SortIcon({ field, sortField, sortDirection }: { field: SortField; sortField: SortField; sortDirection: SortDirection }) {
  if (sortField !== field) return null;
  return sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
}

export function ASNPathTable({ data = asnPathTableData }: ASNPathTableProps) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('trafficGbps');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Column filters: store selected values per column
  const [columnFilters, setColumnFilters] = useState<Record<FilterableColumn, Set<string>>>({
    origin: new Set(),
    myASN: new Set(),
    destination: new Set(),
    originGeo: new Set(),
    destinationGeo: new Set(),
    protocolMix: new Set(),
    topPort: new Set(),
  });

  // Extract unique values for each filterable column
  const filterValues = useMemo(() => ({
    origin: [...new Set(data.map(r => r.origin.name))].sort(),
    myASN: [...new Set(data.map(r => r.myASN.name))].sort(),
    destination: [...new Set(data.map(r => r.destination.name))].sort(),
    originGeo: [...new Set(data.map(r => r.originGeo.country))].sort(),
    destinationGeo: [...new Set(data.map(r => r.destinationGeo.country))].sort(),
    protocolMix: [...new Set(data.map(r => r.protocolMix))].sort(),
    topPort: [...new Set(data.map(r => r.topPort))].sort(),
  }), [data]);

  const handleFilterChange = useCallback((column: FilterableColumn, selected: Set<string>) => {
    setColumnFilters(prev => ({ ...prev, [column]: selected }));
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredData = data.filter(row => {
    // Column filters
    if (columnFilters.origin.size > 0 && !columnFilters.origin.has(row.origin.name)) return false;
    if (columnFilters.myASN.size > 0 && !columnFilters.myASN.has(row.myASN.name)) return false;
    if (columnFilters.destination.size > 0 && !columnFilters.destination.has(row.destination.name)) return false;
    if (columnFilters.originGeo.size > 0 && !columnFilters.originGeo.has(row.originGeo.country)) return false;
    if (columnFilters.destinationGeo.size > 0 && !columnFilters.destinationGeo.has(row.destinationGeo.country)) return false;
    if (columnFilters.protocolMix.size > 0 && !columnFilters.protocolMix.has(row.protocolMix)) return false;
    if (columnFilters.topPort.size > 0 && !columnFilters.topPort.has(row.topPort)) return false;

    // Text search
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      row.origin.name.toLowerCase().includes(searchLower) ||
      row.origin.number.toString().includes(searchLower) ||
      row.myASN.name.toLowerCase().includes(searchLower) ||
      row.myASN.number.toString().includes(searchLower) ||
      row.destination.name.toLowerCase().includes(searchLower) ||
      row.destination.number.toString().includes(searchLower) ||
      row.originGeo.city.toLowerCase().includes(searchLower) ||
      row.originGeo.country.toLowerCase().includes(searchLower) ||
      row.destinationGeo.city.toLowerCase().includes(searchLower) ||
      row.destinationGeo.country.toLowerCase().includes(searchLower) ||
      row.protocolMix.toLowerCase().includes(searchLower) ||
      row.topPort.toLowerCase().includes(searchLower)
    );
  });

  const sortedData = [...filteredData].sort((a, b) => {
    let aVal: string | number = a[sortField] as string | number;
    let bVal: string | number = b[sortField] as string | number;

    // Handle nested objects
    if (sortField === 'origin' || sortField === 'myASN' || sortField === 'destination') {
      aVal = (a[sortField] as { name: string }).name;
      bVal = (b[sortField] as { name: string }).name;
    }
    if (sortField === 'originGeo' || sortField === 'destinationGeo') {
      aVal = (a[sortField] as { country: string }).country;
      bVal = (b[sortField] as { country: string }).country;
    }

    if (typeof aVal === 'string') {
      return sortDirection === 'asc'
        ? aVal.localeCompare(bVal as string)
        : (bVal as string).localeCompare(aVal);
    }

    return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  const handleExport = (format: 'csv' | 'json') => {
    const exportData = sortedData.map(row => ({
      'Origin': `${row.origin.name} (${row.origin.number})`,
      'My ASN': `${row.myASN.name} (${row.myASN.number})`,
      'Destination': `${row.destination.name} (${row.destination.number})`,
      'Origin Geo': `${row.originGeo.city}, ${row.originGeo.country}`,
      'Destination Geo': `${row.destinationGeo.city}, ${row.destinationGeo.country}`,
      'Traffic (Gbps)': row.trafficGbps,
      'Total Traffic (TB)': row.totalTrafficTB,
      'Flow Count': row.flowCount,
      'Avg Flow Size (MB)': row.averageFlowSizeMB,
      'Peak Traffic (Gbps)': row.peakTrafficGbps,
      'Protocol Mix': row.protocolMix,
      'Top Port': row.topPort,
      'Traffic Variation (%)': row.trendPercent,
      '% of Total': row.percentOfTotal,
    }));

    let content: string;
    let filename: string;
    let type: string;

    if (format === 'csv') {
      const headers = Object.keys(exportData[0]).join(',');
      const rows = exportData.map(row => Object.values(row).join(','));
      content = [headers, ...rows].join('\n');
      filename = 'asn-path-analysis.csv';
      type = 'text/csv';
    } else {
      content = JSON.stringify(exportData, null, 2);
      filename = 'asn-path-analysis.json';
      type = 'application/json';
    }

    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>ASN Path Analysis Table</h3>
        <div className={styles.controls}>
          <div className={styles.searchWrapper}>
            <Search size={16} />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={16} />}
            onClick={() => handleExport('csv')}
          >
            CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={16} />}
            onClick={() => handleExport('json')}
          >
            JSON
          </Button>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>
                Origin
                <ColumnFilter
                  values={filterValues.origin}
                  selected={columnFilters.origin}
                  onChange={(s) => handleFilterChange('origin', s)}
                  label="Origin"
                />
              </th>
              <th>
                My ASN
                <ColumnFilter
                  values={filterValues.myASN}
                  selected={columnFilters.myASN}
                  onChange={(s) => handleFilterChange('myASN', s)}
                  label="My ASN"
                />
              </th>
              <th>
                Destination
                <ColumnFilter
                  values={filterValues.destination}
                  selected={columnFilters.destination}
                  onChange={(s) => handleFilterChange('destination', s)}
                  label="Destination"
                />
              </th>
              <th>
                Origin Geo
                <ColumnFilter
                  values={filterValues.originGeo}
                  selected={columnFilters.originGeo}
                  onChange={(s) => handleFilterChange('originGeo', s)}
                  label="Origin Geo"
                />
              </th>
              <th>
                Dest Geo
                <ColumnFilter
                  values={filterValues.destinationGeo}
                  selected={columnFilters.destinationGeo}
                  onChange={(s) => handleFilterChange('destinationGeo', s)}
                  label="Destination Geo"
                />
              </th>
              <th onClick={() => handleSort('trafficGbps')}>
                Traffic (Gbps) <SortIcon field="trafficGbps" sortField={sortField} sortDirection={sortDirection} />
              </th>
              <th onClick={() => handleSort('totalTrafficTB')}>
                Total Traffic (TB) <SortIcon field="totalTrafficTB" sortField={sortField} sortDirection={sortDirection} />
              </th>
              <th onClick={() => handleSort('flowCount')}>
                Flow Count <SortIcon field="flowCount" sortField={sortField} sortDirection={sortDirection} />
              </th>
              <th onClick={() => handleSort('averageFlowSizeMB')}>
                Avg. Flow Size (MB) <SortIcon field="averageFlowSizeMB" sortField={sortField} sortDirection={sortDirection} />
              </th>
              <th onClick={() => handleSort('peakTrafficGbps')}>
                Peak (Gbps) <SortIcon field="peakTrafficGbps" sortField={sortField} sortDirection={sortDirection} />
              </th>
              <th>
                Protocol Mix
                <ColumnFilter
                  values={filterValues.protocolMix}
                  selected={columnFilters.protocolMix}
                  onChange={(s) => handleFilterChange('protocolMix', s)}
                  label="Protocol Mix"
                />
              </th>
              <th>
                Top Port
                <ColumnFilter
                  values={filterValues.topPort}
                  selected={columnFilters.topPort}
                  onChange={(s) => handleFilterChange('topPort', s)}
                  label="Top Port"
                />
              </th>
              <th onClick={() => handleSort('trendPercent')}>
                Traffic Variation <SortIcon field="trendPercent" sortField={sortField} sortDirection={sortDirection} />
              </th>
              <th onClick={() => handleSort('percentOfTotal')}>
                % of Total <SortIcon field="percentOfTotal" sortField={sortField} sortDirection={sortDirection} />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className={styles.asnCell}>
                    <span className={styles.asnName}>{row.origin.name}</span>
                    <span className={styles.asnNumber}>{row.origin.number}</span>
                  </div>
                </td>
                <td>
                  <div className={styles.asnCell}>
                    <span className={styles.asnName}>{row.myASN.name}</span>
                    <span className={styles.asnNumber}>{row.myASN.number}</span>
                  </div>
                </td>
                <td>
                  <div className={styles.asnCell}>
                    <span className={styles.asnName}>{row.destination.name}</span>
                    <span className={styles.asnNumber}>{row.destination.number}</span>
                  </div>
                </td>
                <td>
                  <div className={styles.geoCell}>
                    <span>{row.originGeo.city}</span>
                    <span className={styles.country}>{row.originGeo.country}</span>
                  </div>
                </td>
                <td>
                  <div className={styles.geoCell}>
                    <span>{row.destinationGeo.city}</span>
                    <span className={styles.country}>{row.destinationGeo.country}</span>
                  </div>
                </td>
                <td>{row.trafficGbps.toFixed(1)} Gbps</td>
                <td>{row.totalTrafficTB.toFixed(2)} TB</td>
                <td>{row.flowCount.toLocaleString()}</td>
                <td>{row.averageFlowSizeMB.toFixed(2)} MB</td>
                <td>{row.peakTrafficGbps.toFixed(1)} Gbps</td>
                <td className={styles.protocolCell}>{row.protocolMix}</td>
                <td>{row.topPort}</td>
                <td>
                  <span className={row.trendPercent >= 0 ? styles.trendUp : styles.trendDown}>
                    {row.trendPercent >= 0 ? '+' : ''}{row.trendPercent.toFixed(1)}%
                  </span>
                </td>
                <td>{row.percentOfTotal.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
