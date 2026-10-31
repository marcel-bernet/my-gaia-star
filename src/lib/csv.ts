/** CSV as TAP services return it: comma-separated, with "double quotes" around text that needs them. */

/** One CSV line → its cells, unquoted. */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"'; // an escaped quote
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

/** CSV with a header row → one record per row, keyed by column name. */
export function parseCsv(text: string): Record<string, string>[] {
  const [header, ...rows] = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (!header) return [];
  const names = parseCsvLine(header).map(s => s.trim());
  return rows.map(l => {
    const cells = parseCsvLine(l);
    return Object.fromEntries(names.map((n, i) => [n, cells[i] ?? '']));
  });
}
