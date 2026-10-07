// 合并 data/manifest_<period>.json → data/manifest.json，并做完整性校验
// 用法：node tools/build-manifest.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { jpegSize, pngSize } from './imgsize-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORDER = ['renaissance', 'baroque', 'rococo', 'neoclassicism', 'romanticism', 'impressionism', 'post-impressionism', 'modernism'];
const REQ_PAINT = ['id', 'file', 'titleZh', 'titleEn', 'artistZh', 'artistEn', 'artistBirth', 'artistDeath', 'year', 'period', 'sourceUrl', 'license', 'width', 'height'];

const errors = [], warns = [];
const periods = [], paintings = [];

for (const pid of ORDER) {
  const f = path.join(ROOT, 'data', `manifest_${pid}.json`);
  if (!fs.existsSync(f)) { errors.push(`缺少 ${f}`); continue; }
  let j;
  try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { errors.push(`${f}: JSON 解析失败 ${e.message}`); continue; }
  if (j.period?.id !== pid) errors.push(`${f}: period.id 不符 (${j.period?.id} != ${pid})`);
  else {
    const p = j.period;
    for (const k of ['id', 'nameZh', 'nameEn', 'years', 'introZh', 'accent', 'coverPaintingId']) {
      if (!p[k] || (typeof p[k] === 'string' && !p[k].trim())) errors.push(`period.${pid}.${k} 为空`);
    }
    if (!Array.isArray(p.painters) || p.painters.length < 1) errors.push(`period.${pid}.painters 为空`);
    p.painters?.forEach((pt, i) => {
      for (const k of ['nameZh', 'nameEn', 'years']) if (!pt[k]) errors.push(`period.${pid}.painters[${i}].${k} 为空`);
    });
    periods.push(p);
  }
  const list = Array.isArray(j.paintings) ? j.paintings : [];
  for (const w of list) {
    for (const k of REQ_PAINT) {
      if (w[k] === undefined || w[k] === null || (typeof w[k] === 'string' && !w[k].trim())) errors.push(`painting ${w.id || '?'}: ${k} 为空`);
    }
    if (w.period !== pid) errors.push(`painting ${w.id}: period=${w.period} != ${pid}`);
    const abs = path.join(ROOT, w.file || '');
    if (!fs.existsSync(abs)) { errors.push(`painting ${w.id}: 文件不存在 ${w.file}`); continue; }
    const buf = fs.readFileSync(abs);
    const dim = jpegSize(buf) || pngSize(buf);
    if (!dim) errors.push(`painting ${w.id}: 无法识别的图片格式 ${w.file}`);
    else {
      if (dim.width !== w.width || dim.height !== w.height) warns.push(`painting ${w.id}: 尺寸修正 ${w.width}x${w.height} → ${dim.width}x${dim.height}`);
      w.width = dim.width; w.height = dim.height;
    }
    if (buf.length < 20 * 1024) warns.push(`painting ${w.id}: 文件过小 ${(buf.length / 1024) | 0}KB`);
    if (!/^(https?:\/\/)/.test(w.sourceUrl || '')) errors.push(`painting ${w.id}: sourceUrl 非法`);
    if (!w.license || !/public domain|cc0|pd-art/i.test(w.license)) warns.push(`painting ${w.id}: license 表述异常: ${w.license}`);
    paintings.push(w);
  }
}

// 交叉校验
const ids = new Set(paintings.map(p => p.id));
for (const p of periods) if (!ids.has(p.coverPaintingId)) errors.push(`period ${p.id}: coverPaintingId 不存在 ${p.coverPaintingId}`);
if (new Set(paintings.map(p => p.id)).size !== paintings.length) errors.push('painting id 有重复');
const painterCount = new Set(periods.flatMap(p => (p.painters || []).map(x => x.nameEn))).size;

if (paintings.length < 50) errors.push(`画作数量 ${paintings.length} < 50`);
if (periods.length < 8) errors.push(`时期数量 ${periods.length} < 8`);
if (painterCount < 20) errors.push(`画家数量 ${painterCount} < 20`);

console.log(`periods=${periods.length} paintings=${paintings.length} painters=${painterCount}`);
for (const w of warns) console.log('WARN  ' + w);
for (const e of errors) console.log('ERROR ' + e);

if (errors.length) { console.log('build-manifest: FAILED'); process.exit(1); }

fs.writeFileSync(path.join(ROOT, 'data', 'manifest.json'),
  JSON.stringify({ periods, paintings }, null, 2));
console.log('build-manifest: OK → data/manifest.json');
