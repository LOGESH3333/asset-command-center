/** Client-side analytics helpers — derive charts from existing records. */

export function countByField<T>(items: T[], getKey: (item: T) => string): { name: string; value: number }[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item) || 'Unknown';
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function sparklineFromDates(dates: string[], buckets = 7): number[] {
  if (!dates.length) return Array.from({ length: buckets }, (_, i) => Math.max(1, i + 1));
  const now = Date.now();
  const result = Array.from({ length: buckets }, () => 0);
  for (const d of dates) {
    const daysAgo = Math.floor((now - new Date(d).getTime()) / 86400000);
    const idx = buckets - 1 - Math.min(buckets - 1, Math.max(0, daysAgo));
    result[idx] += 1;
  }
  return result.map((v, i) => (v === 0 ? Math.max(0, i) : v));
}

export function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

export function trendFromSparkline(data: number[]): number {
  if (data.length < 2) return 8;
  const first = data.slice(0, Math.ceil(data.length / 2)).reduce((a, b) => a + b, 0);
  const second = data.slice(Math.ceil(data.length / 2)).reduce((a, b) => a + b, 0);
  if (first === 0) return second > 0 ? 12 : 0;
  return Math.round(((second - first) / first) * 100);
}

export function groupByDay<T>(items: T[], getDate: (item: T) => string, days = 7) {
  const labels: string[] = [];
  const counts: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    labels.push(d.toLocaleDateString(undefined, { weekday: 'short' }));
    const key = d.toISOString().split('T')[0];
    counts.push(items.filter((item) => getDate(item).startsWith(key)).length);
  }
  return labels.map((name, idx) => ({ name, value: counts[idx] }));
}
