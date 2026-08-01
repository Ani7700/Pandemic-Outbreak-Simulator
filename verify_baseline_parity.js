#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Does the baseline condition carry every number its questions need?
//
// The baseline arm (infochat: prose briefing + scripted assistant) is scored on
// the SAME items as the three visual prototypes, and score_shared is the DV for
// the visual-vs-baseline comparison. So any quantity the tool renders but the
// briefing omits is not a comprehension difference — it is a floor, and it
// inflates that comparison by construction.
//
// This is how Q_band shipped broken: its stem said "The chart draws a lighter
// range around the most likely line", the key was the top of that range
// (45 / 458 / 82), and the briefing described the range only in words, with no
// figure anywhere. Baseline participants could not answer it at all.
//
// Written deliberately SEPARATELY from verify_survey_keys.js and sharing no code
// with it: every value below is re-derived from the data files, then looked for
// in the briefing prose by parsing the prose's own number words. A verifier that
// reads the same constants it is checking proves nothing.
//
//   node verify_baseline_parity.js
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs'), p = require('path');
const ROOT = __dirname, ARMS = ['solvik', 'tarnpox', 'verrow'];
const CAM = 'E10000003', HAC = 'E09000012';
const CAM_NAME = 'Cambridgeshire', HAC_NAME = 'Hackney';
const WINDOW = 43;                       // six weeks inclusive of day 0, as the chart slices it
let failures = 0;
const bad = m => { failures++; console.log('  ✗ ' + m); };

// ── prose → numbers ──────────────────────────────────────────────────────────
const UNIT = {zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,
  eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,
  nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};

// Pull every quantity the prose states, in whatever form it states it.
function numbersIn(text) {
  const out = [];
  const t = text.toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[-–—]/g, ' ')     // ninety-three -> ninety three
    .replace(/[,.;:()]/g, ' ')
    .replace(/\s+/g, ' ');
  const w = t.split(' ');

  // digits, with or without thousands separators
  for (const m of text.matchAll(/\b\d[\d,]*\b/g)) out.push(+m[0].replace(/,/g, ''));

  // "half a dozen" = 6, "a dozen" = 12
  for (let i = 0; i < w.length; i++) {
    if (w[i] === 'dozen') out.push(w[i - 2] === 'half' ? 6 : 12);
  }

  // word numerals, greedily: [n] thousand [n] hundred [and] [n]
  for (let i = 0; i < w.length; i++) {
    if (!(w[i] in UNIT) && !(w[i] === 'a' && /^(hundred|thousand)$/.test(w[i + 1] || ''))) continue;
    let j = i, total = 0, chunk = 0, used = false;
    while (j < w.length) {
      const tok = w[j];
      if (tok in UNIT) { chunk += UNIT[tok]; used = true; j++; }
      else if (tok === 'a' && /^(hundred|thousand)$/.test(w[j + 1] || '')) { chunk += 1; used = true; j++; }
      else if (tok === 'hundred') { chunk = (chunk || 1) * 100; j++; }
      else if (tok === 'thousand') { total += (chunk || 1) * 1000; chunk = 0; j++; }
      else if (tok === 'and' && j + 1 < w.length && (w[j + 1] in UNIT)) { j++; }
      else break;
    }
    if (used) { out.push(total + chunk); i = j - 1; }
  }

  // rates the prose writes as a ratio: "five in ten" = 50 per 100, "seven in a hundred" = 7
  const rate = /(\w+|\d+) in (?:a )?(ten|hundred|10|100)\b/g;
  for (const m of t.matchAll(rate)) {
    const n = (m[1] in UNIT) ? UNIT[m[1]] : (/^\d+$/.test(m[1]) ? +m[1] : null);
    if (n === null) continue;
    out.push(/ten|10/.test(m[2]) ? n * 10 : n);
  }
  return out;
}

// ── data, re-derived ─────────────────────────────────────────────────────────
function armFacts(arm) {
  const proj = {};
  { const sandbox = {}; new Function('window', fs.readFileSync(p.join(ROOT, arm, 'sim_projections.js'), 'utf8'))(sandbox);
    Object.assign(proj, sandbox.__SIMPROJ__); }
  const utla = JSON.parse(fs.readFileSync(p.join(ROOT, arm, 'utla_data.json'), 'utf8'));
  const dots = JSON.parse(fs.readFileSync(p.join(ROOT, arm, 'case_dots.json'), 'utf8'));
  const tool = fs.readFileSync(p.join(ROOT, arm, 'index.html'), 'utf8');
  const num = re => { const m = tool.match(re); if (!m) throw new Error(`${arm}: ${re} not found`); return +m[1]; };
  const sar = num(/sar:\s*([0-9.]+)/), ve1 = num(/ve1:\s*([0-9.]+)/), ve2 = num(/ve2:\s*([0-9.]+)/);
  const win = code => ({ med: proj[code].med.slice(0, WINDOW), hi: proj[code].hi.slice(0, WINDOW) });
  const cam = win(CAM), hac = win(HAC);
  const per100 = pr => Math.round(pr * 100);

  return [
    ['herd-immunity threshold (%)',            dots.herdPct],
    [`${CAM_NAME} 2nd-dose coverage (%)`,      Math.round(utla[CAM].mmr2 * 100)],
    [`${CAM_NAME} 1st-dose coverage (%)`,      Math.round(utla[CAM].mmr1 * 100)],
    [`${HAC_NAME} 2nd-dose coverage (%)`,      Math.round(utla[HAC].mmr2 * 100)],
    [`${HAC_NAME} 1st-dose coverage (%)`,      Math.round(utla[HAC].mmr1 * 100)],
    ['if exposed, no doses (per 100)',         per100(sar)],
    ['if exposed, 1 dose (per 100)',           per100(sar * (1 - ve1))],
    ['if exposed, 2 doses (per 100)',          per100(sar * (1 - ve2))],
    ['of 200 unvaccinated, infected',          Math.round(200 * sar)],
    [`${CAM_NAME} active today`,               cam.med[0]],
    [`${HAC_NAME} active today`,               hac.med[0]],
    [`${CAM_NAME} six-week peak (most likely)`, Math.max(...cam.med)],
    [`${HAC_NAME} six-week peak (most likely)`, Math.max(...hac.med)],
    [`${CAM_NAME} top of range  <- Q_band`,    Math.max(...cam.hi)],
    [`${HAC_NAME} top of range`,               Math.max(...hac.hi)],
  ];
}

// ── run ──────────────────────────────────────────────────────────────────────
console.log('=== EVERY NUMBER THE ITEMS NEED IS ALSO IN THE BASELINE BRIEFING ===');
console.log('(values re-derived from sim_projections.js / utla_data.json / case_dots.json / index.html,');
console.log(' then matched against numbers parsed out of the briefing prose)\n');

for (const arm of ARMS) {
  const brief = fs.readFileSync(p.join(ROOT, arm, 'infochat', 'index.html'), 'utf8')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' ');
  const said = numbersIn(brief);
  console.log(`── ${arm} ──`);
  for (const [label, want] of armFacts(arm)) {
    let best = null, err = Infinity;
    for (const n of said) {
      const e = want === 0 ? Math.abs(n) : Math.abs(n - want) / want;
      if (e < err) { err = e; best = n; }
    }
    const ok = err <= 0.06;                       // the prose rounds; 458 -> "four hundred and sixty"
    console.log(`  ${ok ? '✓' : '✗'} ${label.padEnd(42)} data ${String(want).padStart(6)}   briefing ${String(best).padStart(6)}`);
    if (!ok) bad(`${arm}: the briefing never states ${label} (${want}); nearest number in the prose is ${best}`);
  }
  console.log('');
}

// ── no graded item may be phrased in one condition's medium ──────────────────
// The items are shared, so a stem or option that names something only one condition has
// (a chart, a line, shading, an axis, a hover) is answerable in that condition and not the
// other. This is the wording half of the same bug: Q_band used to open "The chart draws a
// lighter range around the most likely line". "page" is allowed — both conditions are pages.
const MEDIUM = /\b(chart|graph|graphic|line|lighter|shaded|shading|axis|axes|badge|slider|hover|click|tap|colour|color|map|dot|dots|briefing|assistant)\b/i;
console.log('=== NO GRADED ITEM IS PHRASED IN ONE CONDITION\'S MEDIUM ===');
for (const arm of ARMS) {
  const s = fs.readFileSync(p.join(ROOT, arm, 'survey.html'), 'utf8');
  let n = 0, flagged = 0;
  for (const m of s.matchAll(/RADIO\("([A-Za-z_0-9]+)","((?:[^"\\]|\\.)*)",\s*(\[[^\]]*\]|RL)\s*,/gs)) {
    n++;
    const text = (m[2] + ' || ' + m[3]).replace(/<[^>]+>/g, ' ');
    const hit = text.match(MEDIUM);
    if (hit) { flagged++; bad(`${arm} ${m[1]}: stem/options say "${hit[0]}" — only one condition has that`); }
  }
  console.log(`  ${flagged ? '✗' : '✓'} ${arm.padEnd(8)} ${n} graded items scanned`);
}

// ── the item that started this: Q_band's key must be the band top ────────────
console.log('\n=== Q_band: key == top of the Cambridgeshire band ===');
for (const arm of ARMS) {
  const s = fs.readFileSync(p.join(ROOT, arm, 'survey.html'), 'utf8');
  const m = s.match(/RADIO\("Q_band","((?:[^"\\]|\\.)*)",\s*\[([^\]]*)\],\s*(\d+)\)/s);
  if (!m) { bad(`${arm}: no Q_band item`); continue; }
  const opts = JSON.parse('[' + m[2] + ']'), key = opts[+m[3]];
  const keyN = +String(key).replace(/[^0-9]/g, '');
  const sandbox = {}; new Function('window', fs.readFileSync(p.join(ROOT, arm, 'sim_projections.js'), 'utf8'))(sandbox);
  const top = Math.max(...sandbox.__SIMPROJ__[CAM].hi.slice(0, WINDOW));
  if (Math.abs(keyN - top) / top > 0.06) bad(`${arm} Q_band: key ${keyN}, band top ${top}`);
  console.log(`  ✓ ${arm.padEnd(8)} key ${String(keyN).padStart(5)}  band top ${String(top).padStart(5)}`);
}

// ── A_peakht and Q_band must not be confusable: both figures stated, and distinct ──
console.log('\n=== A_peakht (most likely peak) and Q_band (top of range) stay distinguishable ===');
for (const arm of ARMS) {
  const sandbox = {}; new Function('window', fs.readFileSync(p.join(ROOT, arm, 'sim_projections.js'), 'utf8'))(sandbox);
  const w = sandbox.__SIMPROJ__[CAM];
  const peak = Math.max(...w.med.slice(0, WINDOW)), top = Math.max(...w.hi.slice(0, WINDOW));
  const brief = fs.readFileSync(p.join(ROOT, arm, 'infochat', 'index.html'), 'utf8')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' ');
  const said = numbersIn(brief);
  const near = v => said.some(n => Math.abs(n - v) / v <= 0.06);
  if (!near(peak)) bad(`${arm}: briefing never states the most-likely peak (${peak}), so A_peakht is unanswerable`);
  if (!near(top))  bad(`${arm}: briefing never states the top of the range (${top}), so Q_band is unanswerable`);
  if (top / peak < 1.2) bad(`${arm}: peak ${peak} and range top ${top} are too close to tell apart`);
  console.log(`  ✓ ${arm.padEnd(8)} peak ${String(peak).padStart(5)}  vs top of range ${String(top).padStart(5)}  — both in the briefing, ${(top / peak).toFixed(1)}x apart`);
}

console.log(failures ? `\n### ${failures} PROBLEM(S)` : '\n### ALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
