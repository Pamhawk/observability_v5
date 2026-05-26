const SQL_KEYWORDS = /\b(SELECT|FROM|WHERE|GROUP\s+BY|ORDER\s+BY|LIMIT|AS|AND|OR|IN|NOT|BETWEEN|LIKE|ASC|DESC|HAVING|DISTINCT|JOIN|ON|LEFT|RIGHT|INNER|OUTER|UNION|ALL)\b/gi;
const SQL_FUNCTIONS = /\b(SUM|AVG|COUNT|MIN|MAX|MEDIAN|P95|P99|TOTAL|AVERAGE)\b/gi;
const SQL_NUMBERS = /\b(\d+\.?\d*)\b/g;
const SQL_STRINGS = /('[^']*'|"[^"]*")/g;
const SQL_COMMENTS_LINE = /--.*/g;
const SQL_COMMENTS_BLOCK = /\/\*[\s\S]*?\*\//g;

export function highlightSqlScript(sql: string): string {
  let result = sql
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Comments
  result = result.replace(SQL_COMMENTS_BLOCK, m => `<span style="color:#9CA3AF;font-style:italic">${m}</span>`);
  result = result.replace(SQL_COMMENTS_LINE, m => `<span style="color:#9CA3AF;font-style:italic">${m}</span>`);

  // Strings (before keywords so we don't highlight inside strings)
  result = result.replace(SQL_STRINGS, m => `<span style="color:#DC2626">${m}</span>`);

  // Functions
  result = result.replace(SQL_FUNCTIONS, m => `<span style="color:#7C3AED;font-weight:bold">${m}</span>`);

  // Keywords
  result = result.replace(SQL_KEYWORDS, m => `<span style="color:#2563EB;font-weight:bold">${m}</span>`);

  // Numbers
  result = result.replace(SQL_NUMBERS, m => `<span style="color:#B91C1C">${m}</span>`);

  return result;
}
