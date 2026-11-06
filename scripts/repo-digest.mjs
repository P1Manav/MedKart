#!/usr/bin/env node
/**
 * repo-digest.mjs — builds ONE compact file (REPO_DIGEST.md) describing the whole repo,
 * so a reviewer (or an AI with a small context window) can audit it without reading every file.
 *
 * Usage (from the repo root):
 *   node scripts/repo-digest.mjs              # structure + static checks + command results
 *   node scripts/repo-digest.mjs --fast       # skip slow commands (build, tests, e2e)
 *   node scripts/repo-digest.mjs --out my.md  # custom output path
 *
 * Safe to share: values of .env files are never read; secret-looking strings are redacted.
 * No dependencies. Needs Node 20+.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const FAST = args.includes('--fast');
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'REPO_DIGEST.md';
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'coverage', 'playwright-report', 'test-results', '.vercel']);
const MAX_TAIL_LINES = 60;

const out = [];
const h = (t) => out.push(`\n## ${t}\n`);
const code = (body, lang = '') => out.push('```' + lang + '\n' + String(body).trimEnd() + '\n```');

const REDACT = [
  [/(postgres(ql)?:\/\/)[^\s'"]+/gi, '$1<redacted>'],
  [/\b(sk|rk|pk)_(live|test)_[A-Za-z0-9]{8,}/g, '<redacted-key>'],
  [/\bhf_[A-Za-z0-9]{20,}/g, '<redacted-hf>'],
  [/\bAKIA[0-9A-Z]{16}\b/g, '<redacted-aws>'],
  [/\b[6-9]\d{9}\b/g, '<10-digit-number>'],
  [/\b[\w.-]+@(okaxis|okhdfc|okicici|oksbi|ybl|paytm|upi|ibl|axl)\b/gi, '<upi-id>'],
];
const redact = (s) => REDACT.reduce((acc, [re, to]) => acc.replace(re, to), s);

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, files);
    else files.push(p);
  }
  return files;
}
const rel = (p) => relative(ROOT, p).split(sep).join('/');
const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };
const run = (cmd, timeout = 600000) => {
  try {
    const stdout = execSync(cmd, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], timeout, maxBuffer: 50 * 1024 * 1024 });
    return { ok: true, text: stdout.toString() };
  } catch (e) {
    return { ok: false, text: `${e.stdout ?? ''}${e.stderr ?? ''}` || String(e.message) };
  }
};
const tail = (text, n = MAX_TAIL_LINES) => text.split('\n').slice(-n).join('\n');

const files = walk(ROOT);
const textFiles = files.filter((f) => /\.(ts|tsx|js|mjs|json|md|prisma|sql|yml|yaml|css|example)$/.test(f) && !/package-lock\.json$/.test(f));

out.push('# REPO DIGEST');
out.push(`Generated: ${new Date().toISOString()}  |  Mode: ${FAST ? 'fast' : 'full'}`);

// 1. Overview
h('1. Overview');
const pkg = JSON.parse(read('package.json') || '{}');
code(JSON.stringify({ name: pkg.name, scripts: pkg.scripts, deps: Object.keys(pkg.dependencies ?? {}).length, devDeps: Object.keys(pkg.devDependencies ?? {}).length, next: pkg.dependencies?.next, node: pkg.engines?.node }, null, 2), 'json');
const loc = textFiles.filter((f) => /\.(ts|tsx)$/.test(f)).reduce((n, f) => n + read(f).split('\n').length, 0);
out.push(`Files (excluding node_modules/.next): ${files.length} | TS/TSX lines: ${loc}`);
const gitLog = run('git log --oneline -n 25');
out.push('\nRecent commits:');
code(gitLog.ok ? gitLog.text : 'no git history in this folder');
const commits = run('git rev-list --count HEAD');
if (commits.ok) out.push(`Total commits: ${commits.text.trim()}`);

// 2. Tree
h('2. File tree (src, prisma, tests, scripts, docs, config) with line counts');
const treeLines = files
  .map(rel)
  .filter((f) => /^(src|prisma|tests|scripts|docs|messages|\.github)\//.test(f) || !f.includes('/'))
  .sort()
  .map((f) => `${f}  (${read(f).split('\n').length}L)`);
code(treeLines.join('\n'));

// 3. API routes + guard detection
h('3. API routes and access control (heuristic)');
const GUARD = /(requireRole|requireUser|requireSession|getSession|requireAuth|verifyCron|CRON_SECRET|timingSafeEqual)/;
const rows = files.filter((f) => /src\/app\/api\/.*route\.ts$/.test(rel(f))).map((f) => {
  const s = read(f);
  const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].filter((m) => new RegExp(`export\\s+(async\\s+)?function\\s+${m}\\b|export\\s+const\\s+${m}\\b`).test(s));
  const guarded = GUARD.test(s);
  const zod = /zod|\.safeParse\(|\.parse\(/.test(s) || /from ['"]@\/lib\/validators/.test(s);
  const leaks = /err(or)?\.message|e\.message/.test(s);
  return { route: rel(f).replace('src/app', '').replace('/route.ts', ''), methods: methods.join(','), guarded, zod, leaks };
});
code('route | methods | auth-guard | validates-input | returns err.message\n' + rows.map((r) => `${r.route} | ${r.methods} | ${r.guarded ? 'yes' : 'NO'} | ${r.zod ? 'yes' : 'NO'} | ${r.leaks ? 'CHECK' : 'ok'}`).join('\n'));
out.push('\nUnguarded routes (confirm each is intentionally public):');
code(rows.filter((r) => !r.guarded).map((r) => r.route).join('\n') || 'none');

// 4. Pages
h('4. Pages and special files');
const pages = files.map(rel).filter((f) => /^src\/app\/.*(page|layout|loading|error|not-found|global-error)\.tsx$/.test(f));
code(pages.join('\n'));
const missing = ['error.tsx', 'not-found.tsx', 'loading.tsx'].filter((n) => !pages.some((p) => p.endsWith('/' + n)));
out.push(`Missing top-level special files: ${missing.join(', ') || 'none'}`);
out.push(`Route guard file: ${['src/proxy.ts', 'src/middleware.ts', 'proxy.ts', 'middleware.ts'].filter(existsSync).join(', ') || 'NONE'}`);

// 5. Env vars: code vs .env.example vs deployment docs
h('5. Environment variables: used in code vs documented');
const used = new Set();
for (const f of textFiles.filter((f) => /^(src|scripts|prisma)\//.test(rel(f)) || /config\.(ts|mjs|js)$/.test(rel(f)))) {
  for (const m of read(f).matchAll(/process\.env\.([A-Z0-9_]+)/g)) used.add(m[1]);
}
const exampleVars = new Set([...read('.env.example').matchAll(/^\s*#?\s*([A-Z][A-Z0-9_]{2,})\s*=/gm)].map((m) => m[1]));
const docText = ['README.md', 'deployment.md', 'docs/deployment.md'].map(read).join('\n');
const ignore = new Set(['NODE_ENV', 'CI', 'NEXT_RUNTIME', 'VERCEL', 'VERCEL_ENV', 'VERCEL_URL', 'PLAYWRIGHT']);
const u = [...used].filter((v) => !ignore.has(v)).sort();
code(
  `used in code but NOT in .env.example:\n  ${u.filter((v) => !exampleVars.has(v)).join('\n  ') || '-'}\n\n` +
    `in .env.example but NOT used in code:\n  ${[...exampleVars].filter((v) => !used.has(v)).join('\n  ') || '-'}\n\n` +
    `used in code but NOT in deployment docs:\n  ${u.filter((v) => !docText.includes(v)).join('\n  ') || '-'}`,
);
out.push('\nBranches on CI/NODE_ENV in src (security knobs should not depend on CI):');
code(textFiles.filter((f) => rel(f).startsWith('src/')).flatMap((f) => read(f).split('\n').map((l, i) => ({ l, i, f }))).filter(({ l }) => /process\.env\.CI|NODE_ENV\s*[!=]==?\s*'test'/.test(l)).map(({ l, i, f }) => `${rel(f)}:${i + 1}: ${l.trim()}`).join('\n') || 'none');

// 6. Static risk scan
h('6. Static risk scan');
const patterns = [
  ['Hardcoded UPI id / 10-digit phone in code or docs', /(@(okaxis|okhdfc|okicici|oksbi|ybl|paytm|ibl|axl)\b)|(['"`]\+?91?[6-9]\d{9}['"`])/],
  ['Secret-looking literals', /(sk_(live|test)_|AKIA[0-9A-Z]{16}|hf_[A-Za-z0-9]{20,}|BEGIN (RSA|PRIVATE) KEY)/],
  ['console.log in src', /console\.log\(/],
  ['@ts-ignore / as any / eslint-disable', /(@ts-ignore|@ts-nocheck|\bas any\b|eslint-disable)/],
  ['TODO / FIXME / HACK', /(TODO|FIXME|HACK|XXX)\b/],
  ['dangerouslySetInnerHTML / eval', /(dangerouslySetInnerHTML|\beval\(|new Function\()/],
  ['localStorage holding tokens/otp', /localStorage\.(set|get)Item\([^)]*(token|otp|session)/i],
  ['Raw SQL', /\$queryRawUnsafe|\$executeRawUnsafe/],
  ['Hardcoded demo OTP', /['"]123456['"]/],
  ['fetch without no-store in client pages', /useEffect\([^)]*fetch\(/s],
];
for (const [label, re] of patterns) {
  const hits = [];
  for (const f of textFiles) {
    if (/node_modules|package-lock/.test(f)) continue;
    read(f).split('\n').forEach((l, i) => { if (re.test(l)) hits.push(`${rel(f)}:${i + 1}: ${redact(l.trim()).slice(0, 140)}`); });
  }
  out.push(`\n**${label}** — ${hits.length} hit(s)`);
  if (hits.length) code(hits.slice(0, 25).join('\n') + (hits.length > 25 ? `\n... +${hits.length - 25} more` : ''));
}

// 7. Tests
h('7. Tests');
const testFiles = files.map(rel).filter((f) => /^tests\/.*\.(test|spec)\.ts$/.test(f));
code(testFiles.map((f) => `${f}  (${(read(f).match(/\b(it|test)\(/g) || []).length} cases)`).join('\n'));
const mutating = testFiles.filter((f) => /RX-502(11|14|19)/.test(read(f)) && /(update|delete|create)\(/.test(read(f)));
out.push(`Tests that touch canonical seed orders AND write (shared-state risk): ${mutating.join(', ') || 'none'}`);

// 8. Prisma
h('8. Database');
const schema = read('prisma/schema.prisma');
code(`models: ${(schema.match(/^model\s+\w+/gm) || []).map((m) => m.split(/\s+/)[1]).join(', ')}\nenums: ${(schema.match(/^enum\s+\w+/gm) || []).map((m) => m.split(/\s+/)[1]).join(', ')}\nindexes: ${(schema.match(/@@index/g) || []).length}  unique: ${(schema.match(/@@unique|@unique/g) || []).length}`);
if (existsSync('prisma/migrations')) code(readdirSync('prisma/migrations').join('\n'));

// 9. CI workflow summary
h('9. CI workflow steps');
const ci = ['.github/workflows/ci.yml', '.github/workflows/ci.yaml'].find(existsSync);
code(ci ? read(ci).split('\n').filter((l) => /^\s*-?\s*(name|run|uses):/.test(l)).join('\n') : 'no workflow found');

// 10. Commands
h('10. Command results');
if (!existsSync('node_modules')) out.push('node_modules missing: run `npm ci` first for real results.');
const cmds = [
  ['prisma validate', 'npx prisma validate', 120000],
  ['typecheck', 'npm run typecheck --silent', 600000],
  ['lint', 'npm run lint --silent', 600000],
  ['audit (prod deps)', 'npm audit --omit=dev', 120000],
];
if (!FAST) cmds.push(['unit+integration tests', 'npm test --silent', 900000], ['db tests', 'npm run test:db --silent', 900000], ['build', 'npm run build', 900000]);
for (const [name, cmd, t] of cmds) {
  if (name === 'typecheck' && !pkg.scripts?.typecheck) continue;
  const r = run(cmd, t);
  out.push(`\n**${name}** — ${r.ok ? 'PASS' : 'FAIL'}  (\`${cmd}\`)`);
  if (!r.ok || name.startsWith('audit')) code(redact(tail(r.text)));
}
const gh = run('gh run list --limit 3 --json status,conclusion,displayTitle,headSha');
if (gh.ok) {
  out.push('\n**Latest CI runs (gh)**');
  code(gh.text);
  const failing = run('gh run view --log-failed');
  if (failing.ok && failing.text.trim()) { out.push('\n**Failed CI log (tail)**'); code(redact(tail(failing.text, 120))); }
} else out.push('\nGitHub CLI not available: paste `gh run view --log-failed` output manually.');

// 11. Key files, trimmed (security-critical)
h('11. Security-critical files (first 120 lines each, redacted)');
for (const f of ['src/lib/auth/session.ts', 'src/lib/auth/otp.ts', 'src/proxy.ts', 'src/domain/assert-dispatchable.ts', 'next.config.ts', 'src/lib/payments/upi-config.ts']) {
  if (!existsSync(f)) { out.push(`\n${f}: MISSING`); continue; }
  out.push(`\n**${f}**`);
  code(redact(read(f).split('\n').slice(0, 120).join('\n')), 'ts');
}

const text = out.join('\n');
writeFileSync(OUT, text);
console.log(`Wrote ${OUT} (${Math.round(text.length / 1024)} KB). Share this file. It contains no .env values.`);
