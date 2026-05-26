import type { ParsedSQL, ParsedSQLColumn, ParsedSQLCondition } from '../types';

const AGG_REGEX = /^(SUM|AVG|COUNT|MIN|MAX|MEDIAN|P95|P99|TOTAL|AVERAGE)\s*\(\s*([\w.*]+)\s*\)/i;

function normalizeWhitespace(sql: string): string {
  // Strip line comments
  let s = sql.replace(/--[^\n]*/g, '');
  // Strip block comments
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  // Normalize whitespace
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function parseSelectColumns(selectStr: string): ParsedSQLColumn[] {
  const columns: ParsedSQLColumn[] = [];
  // Split by comma but respect parentheses
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of selectStr) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());

  for (const part of parts) {
    const col: ParsedSQLColumn = { expression: part };

    // Extract alias: ... AS alias (or ... AS "alias")
    const aliasMatch = part.match(/\s+AS\s+["']?(\w[\w\s]*)["']?\s*$/i);
    if (aliasMatch) {
      col.alias = aliasMatch[1].trim();
      col.expression = part.slice(0, aliasMatch.index).trim();
    }

    // Check for aggregation
    const aggMatch = col.expression.match(AGG_REGEX);
    if (aggMatch) {
      col.aggregation = aggMatch[1].toUpperCase();
      col.sourceColumn = aggMatch[2];
    } else {
      // Bare column name
      col.sourceColumn = col.expression;
    }

    columns.push(col);
  }

  return columns;
}

function parseConditions(whereStr: string): ParsedSQLCondition[] {
  const conditions: ParsedSQLCondition[] = [];
  // Split by AND/OR (simple split — doesn't handle nested parens)
  const parts = whereStr.split(/\s+(?:AND|OR)\s+/i);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // IN (...) pattern
    const inMatch = trimmed.match(/^([\w.]+)\s+(NOT\s+)?IN\s*\((.+)\)/i);
    if (inMatch) {
      const values = inMatch[3].split(',').map(v => v.trim().replace(/^['"]|['"]$/g, ''));
      conditions.push({
        column: inMatch[1],
        operator: inMatch[2] ? 'NOT IN' : 'IN',
        value: values,
      });
      continue;
    }

    // BETWEEN pattern
    const betweenMatch = trimmed.match(/^([\w.]+)\s+BETWEEN\s+(\S+)\s+AND\s+(\S+)/i);
    if (betweenMatch) {
      conditions.push({
        column: betweenMatch[1],
        operator: 'BETWEEN',
        value: [betweenMatch[2].replace(/^['"]|['"]$/g, ''), betweenMatch[3].replace(/^['"]|['"]$/g, '')],
      });
      continue;
    }

    // LIKE pattern
    const likeMatch = trimmed.match(/^([\w.]+)\s+LIKE\s+['"](.+)['"]/i);
    if (likeMatch) {
      conditions.push({
        column: likeMatch[1],
        operator: 'LIKE',
        value: likeMatch[2],
      });
      continue;
    }

    // Standard operators: =, !=, <>, >=, <=, >, <
    const opMatch = trimmed.match(/^([\w.]+)\s*(!=|<>|>=|<=|>|<|=)\s*(.+)$/);
    if (opMatch) {
      const val = opMatch[3].trim().replace(/^['"]|['"]$/g, '');
      conditions.push({
        column: opMatch[1],
        operator: opMatch[2] === '<>' ? '!=' : opMatch[2],
        value: val,
      });
      continue;
    }
  }

  return conditions;
}

function parseOrderBy(orderStr: string): { column: string; direction: 'ASC' | 'DESC' }[] {
  return orderStr.split(',').map(part => {
    const trimmed = part.trim();
    const descMatch = trimmed.match(/^(.+?)\s+DESC$/i);
    if (descMatch) return { column: descMatch[1].trim(), direction: 'DESC' as const };
    const ascMatch = trimmed.match(/^(.+?)\s+ASC$/i);
    if (ascMatch) return { column: ascMatch[1].trim(), direction: 'ASC' as const };
    return { column: trimmed, direction: 'ASC' as const };
  }).filter(o => o.column);
}

export function parseSQL(sql: string): ParsedSQL | null {
  const normalized = normalizeWhitespace(sql);
  if (!normalized) return null;

  // Must start with SELECT
  if (!/^SELECT\s/i.test(normalized)) return null;

  let working = normalized;
  let limit: number | undefined;
  let orderBy: { column: string; direction: 'ASC' | 'DESC' }[] = [];
  let groupBy: string[] = [];
  let where: ParsedSQLCondition[] = [];

  // Extract LIMIT
  const limitMatch = working.match(/\s+LIMIT\s+(\d+)\s*$/i);
  if (limitMatch) {
    limit = parseInt(limitMatch[1], 10);
    working = working.slice(0, limitMatch.index).trim();
  }

  // Extract ORDER BY
  const orderMatch = working.match(/\s+ORDER\s+BY\s+(.+)$/i);
  if (orderMatch) {
    orderBy = parseOrderBy(orderMatch[1]);
    working = working.slice(0, orderMatch.index).trim();
  }

  // Extract GROUP BY
  const groupMatch = working.match(/\s+GROUP\s+BY\s+(.+)$/i);
  if (groupMatch) {
    groupBy = groupMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    working = working.slice(0, groupMatch.index).trim();
  }

  // Extract WHERE
  const whereMatch = working.match(/\s+WHERE\s+(.+)$/i);
  if (whereMatch) {
    where = parseConditions(whereMatch[1]);
    working = working.slice(0, whereMatch.index).trim();
  }

  // Extract FROM
  const fromMatch = working.match(/\s+FROM\s+([\w.]+)\s*$/i);
  if (!fromMatch) return null;
  const from = fromMatch[1];
  working = working.slice(0, fromMatch.index).trim();

  // Remaining is "SELECT ..."
  const selectStr = working.replace(/^SELECT\s+/i, '').trim();
  if (!selectStr) return null;

  const select = parseSelectColumns(selectStr);

  return { select, from, where, groupBy, orderBy, limit };
}
