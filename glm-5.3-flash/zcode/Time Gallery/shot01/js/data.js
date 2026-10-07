// 共享数据辅助（只读）。manifest 结构见 SPEC.md 第 2 节。

export const PERIOD_ORDER = [
  'renaissance', 'baroque', 'rococo', 'neoclassicism',
  'romanticism', 'impressionism', 'post-impressionism', 'modernism',
];

export function paintingById(manifest) {
  const map = new Map();
  for (const p of manifest.paintings) map.set(p.id, p);
  return map;
}

export function paintingsByPeriod(manifest) {
  const map = new Map();
  for (const p of manifest.paintings) {
    if (!map.has(p.period)) map.set(p.period, []);
    map.get(p.period).push(p);
  }
  return map;
}
