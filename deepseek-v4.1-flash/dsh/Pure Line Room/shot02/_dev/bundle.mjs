// bundle.mjs — turns the ES-module sources in ../js into a single classic script
// so index.html also works when opened straight from disk (file://), where the
// browser refuses to load ES modules because of CORS.
//
// Usage:
//   node _dev/bundle.mjs
//
// It is deliberately dumb: a tiny registry + regex rewriting of import/export.
// All module bodies become async functions, so top-level `await import(...)`
// keeps working (it is rewritten to `await require(...)`).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const jsDir = path.join(root, 'js');
const argv = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const entry = argv[0] || 'js/main.js';
const outFile = path.join(root, argv[1] || 'js/bundle.js');

const visited = new Set();
const modules = [];
const exportsOf = new Map();   // id -> Set(names)  ('default' included)
const importsOf = [];          // { from, target, names: [], star: bool }

function idOf(abs) {
  return path.relative(root, abs).split(path.sep).join('/');
}

function resolveImport(fromAbs, spec) {
  if (!spec.startsWith('.')) throw new Error('bare import not allowed: ' + spec);
  const abs = path.resolve(path.dirname(fromAbs), spec);
  return idOf(abs);
}

function load(abs) {
  const id = idOf(abs);
  if (visited.has(id)) return id;
  visited.add(id);

  let src = fs.readFileSync(abs, 'utf8');
  const raw = src;
  const deps = [];

  // ---- imports ---------------------------------------------------------
  src = src.replace(
    /^[ \t]*import\s+([\s\S]*?)\s+from\s+(['"])([^'"]+)\2\s*;?/gm,
    (m, clause, q, spec) => {
      const target = resolveImport(abs, spec);
      deps.push(target);
      const out = [];
      let rest = clause.trim();
      if (rest.startsWith('*')) {
        const ns = rest.replace(/^\*\s*as\s*/, '').trim();
        importsOf.push({ from: id, target, names: [], star: true });
        out.push(`const ${ns} = await require(${JSON.stringify(target)});`);
      } else {
        const braceAt = rest.indexOf('{');
        if (braceAt > 0) {
          const def = rest.slice(0, braceAt).replace(/,\s*$/, '').trim();
          if (def) {
            importsOf.push({ from: id, target, names: ['default'], star: false });
            out.push(`const ${def} = (await require(${JSON.stringify(target)})).default;`);
          }
          rest = rest.slice(braceAt);
        }
        if (rest.startsWith('{')) {
          const inner = rest.slice(1, rest.lastIndexOf('}'));
          const pairs = inner.split(',').map((s) => s.trim()).filter(Boolean);
          importsOf.push({
            from: id,
            target,
            names: pairs.map((s) => {
              const m2 = s.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
              return m2 ? m2[1] : s;
            }),
            star: false,
          });
          const names = pairs.map((s) => s.replace(/\s+as\s+/, ': '));
          out.push(`const { ${names.join(', ')} } = await require(${JSON.stringify(target)});`);
        } else if (rest) {
          const def = rest.replace(/,\s*$/, '').trim();
          importsOf.push({ from: id, target, names: ['default'], star: false });
          out.push(`const ${def} = (await require(${JSON.stringify(target)})).default;`);
        }
      }
      return `/* import */ ${out.join(' ')}`;
    },
  );

  // side-effect-only imports
  src = src.replace(/^[ \t]*import\s+(['"])([^'"]+)\1\s*;?/gm, (m, q, spec) => {
    const target = resolveImport(abs, spec);
    deps.push(target);
    return `await require(${JSON.stringify(target)});`;
  });

  // dynamic import -> require (require already returns a promise). The specifier
  // is rewritten to the canonical module id because require is not path-relative.
  src = src.replace(/(?:import|require)\s*\(\s*(['"])([^'"]+)\1\s*\)/g, (m, q, spec) => {
    if (!spec.startsWith('.')) return m;
    const target = resolveImport(abs, spec);
    deps.push(target);
    return `require(${JSON.stringify(target)})`;
  });
  src = src.replace(/\bimport\s*\(/g, 'require(');

  // ---- exports ---------------------------------------------------------
  src = src.replace(/^[ \t]*export\s+default\s+/gm, '__exports.default = ');

  const named = [];
  src = src.replace(/^[ \t]*export\s+(async\s+)?function\s+([A-Za-z_$][\w$]*)/gm, (m, a, name) => {
    named.push(name);
    return `${a || ''}function ${name}`;
  });
  src = src.replace(/^[ \t]*export\s+class\s+([A-Za-z_$][\w$]*)/gm, (m, name) => {
    named.push(name);
    return `class ${name}`;
  });
  src = src.replace(/^[ \t]*export\s+(const|let|var)\s+([A-Za-z_$][\w$]*)/gm, (m, kind, name) => {
    named.push(name);
    return `${kind} ${name}`;
  });
  src = src.replace(/^[ \t]*export\s*\{([^}]*)\}\s*;?/gm, (m, inner) => {
    for (const piece of inner.split(',')) {
      const s = piece.trim();
      if (!s) continue;
      const asMatch = s.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
      if (asMatch) named.push([asMatch[2], asMatch[1]]);
      else named.push(s);
    }
    return '';
  });

  const tail = named.map((n) => {
    if (Array.isArray(n)) return `__exports.${n[0]} = ${n[1]};`;
    return `__exports.${n} = ${n};`;
  }).join('\n');

  const exp = new Set(named.map((n) => (Array.isArray(n) ? n[0] : n)));
  if (/^[ \t]*export\s+default\s+/m.test(raw)) exp.add('default');
  exportsOf.set(id, exp);

  modules.push({ id, src, tail, abs });
  for (const d of deps) load(path.resolve(root, d));
  return id;
}

load(path.join(root, entry));

// ---- validate that every named import actually exists ------------------
const importErrors = [];
for (const imp of importsOf) {
  if (imp.star) continue;
  const avail = exportsOf.get(imp.target);
  if (!avail) { importErrors.push(`${imp.from}: cannot resolve module ${imp.target}`); continue; }
  for (const nm of imp.names) {
    if (!avail.has(nm)) {
      importErrors.push(`${imp.from}: "${nm}" is not exported by ${imp.target}`);
    }
  }
}
if (importErrors.length) {
  process.stdout.write('IMPORT ERRORS:\n  ' + importErrors.join('\n  ') + '\n');
  process.exitCode = 1;
}

const pieces = [];
pieces.push(`/*! Pure Line Room — bundled build.
 *  Source modules live in js/ ; this file is generated by _dev/bundle.mjs.
 *  It is a plain classic script so the piece also runs when index.html is
 *  opened straight from the file system (file://), where ES modules are
 *  blocked by the browser's CORS rules.
 *  No network, no external fonts, no external audio, no images.
 */`);
pieces.push('(function () {');
pieces.push('  "use strict";');
pieces.push('  var __defs = {};');
pieces.push('  var __cache = {};');
pieces.push('  function __require(id) {');
pieces.push('    if (Object.prototype.hasOwnProperty.call(__cache, id)) return __cache[id];');
pieces.push('    var p = (async function () {');
pieces.push('      var module = { exports: {} };');
pieces.push('      var fn = __defs[id];');
pieces.push('      if (!fn) throw new Error("module not found: " + id);');
pieces.push('      await fn(module, module.exports, __require);');
pieces.push('      module.exports.__ready = true;');
pieces.push('      return module.exports;');
pieces.push('    })();');
pieces.push('    __cache[id] = p;');
pieces.push('    return p;');
pieces.push('  }');

for (const m of modules) {
  pieces.push(`  /* ---------------------------------------------------------- ${m.id} */`);
  pieces.push(`  __defs[${JSON.stringify(m.id)}] = async function (module, exports, require) {`);
  pieces.push(`    const __exports = exports;`);
  pieces.push(m.src);
  if (m.tail) pieces.push(m.tail);
  pieces.push('  };');
}

pieces.push(`  __require(${JSON.stringify(entry)}).catch(function (e) {`);
pieces.push('    var el = document.getElementById("boot-error");');
pieces.push('    var msg = (e && e.stack) ? e.stack : String(e);');
pieces.push('    if (el) { el.style.display = "block"; el.textContent = "启动失败: " + msg; }');
pieces.push('    throw e;');
pieces.push('  });');
pieces.push('})();');

fs.writeFileSync(outFile, pieces.join('\n') + '\n', 'utf8');
process.stdout.write(`bundled ${modules.length} modules -> ${path.relative(root, outFile)}\n`);
