// Regenerate {arm}/case_dots.js so that 1 red dot = 1 person ill right now.
//
// The previous case_dots.js was an unvaccinated-children / herd-immunity-shortfall
// layer (metadata herdPct:85, VE:0.8) that was later relabelled "1 confirmed case"
// in the legend without ever being regenerated.  corr(dots, cases) was ~0.08-0.23,
// corr(dots, immunity gap) was ~0.62 -- i.e. the overlay disagreed with the numbers
// printed next to it.  This script rebuilds it straight off measles_cases.json.
//
// usage:  node gen_case_dots.js <arm>

const fs = require("fs");
const path = require("path");

const BASE = __dirname;
const arm  = process.argv[2];
if (!arm) { console.error("usage: node gen_case_dots.js <arm>"); process.exit(1); }

const rd = f => JSON.parse(fs.readFileSync(path.join(BASE, arm, f), "utf8"));
const geo   = rd("utla.geojson");
const meta  = rd("utla_data.json");

// ---- how many people are ill right now, by area ----
// Day 0 of the median projection -- the same array the outbreak chart plots -- so the
// dots, the number in the map panel and the curve's starting point are one figure.
function loadProj(){
  const src = fs.readFileSync(path.join(BASE, arm, "sim_projections.js"), "utf8");
  const sb = { window: {} };
  new Function("window", "globalThis", src).call(sb, sb.window, sb);
  return sb.window.__SIMPROJ__;
}
function illNowByName(meta){
  const proj = loadProj(), out = {};
  for (const code in meta){
    const p = proj[code];
    if (p && p.med && p.med.length) out[meta[code].name] = p.med[0];
  }
  return out;
}
const byUTLA = illNowByName(meta);

// ---- deterministic PRNG so re-running the script reproduces the same map ----
function mulberry32(a){
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedOf(s){ let h = 2166136261; for (let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// ---- geometry ----
// GeoJSON rings are [lon, lat]; Leaflet wants [lat, lon].  Convert on output only.
function ringArea(r){                       // shoelace, absolute, in degree^2
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0]*r[i][1] - r[i][0]*r[j][1];
  return Math.abs(a / 2);
}
function bbox(r){
  let x0 =  Infinity, y0 =  Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of r){ if(p[0]<x0)x0=p[0]; if(p[0]>x1)x1=p[0]; if(p[1]<y0)y0=p[1]; if(p[1]>y1)y1=p[1]; }
  return [x0, y0, x1, y1];
}
function inRing(x, y, r){                   // ray casting
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++){
    const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

// Flatten a feature into a list of simple parts: {outer, holes, bbox, area}
function partsOf(g){
  if (!g) return [];
  const polys = g.type === "Polygon" ? [g.coordinates]
              : g.type === "MultiPolygon" ? g.coordinates
              : [];
  const out = [];
  for (const poly of polys){
    if (!poly || !poly.length || poly[0].length < 4) continue;
    const outer = poly[0], holes = poly.slice(1);
    let a = ringArea(outer);
    for (const h of holes) a -= ringArea(h);
    if (!(a > 0)) continue;
    out.push({ outer, holes, bbox: bbox(outer), area: a });
  }
  return out;
}

function samplePoints(parts, n, rnd){
  const pts = [];
  if (!parts.length || n <= 0) return pts;
  const total = parts.reduce((s, p) => s + p.area, 0);
  const cum = []; let acc = 0;
  for (const p of parts){ acc += p.area / total; cum.push(acc); }

  let guard = 0, budget = n * 400 + 5000;
  while (pts.length < n && guard < budget){
    guard++;
    const u = rnd();
    let k = 0; while (k < cum.length - 1 && u > cum[k]) k++;
    const p = parts[k], b = p.bbox;
    const x = b[0] + rnd() * (b[2] - b[0]);
    const y = b[1] + rnd() * (b[3] - b[1]);
    // test the ROUNDED point, not the raw one: rounding to 5 dp (~1 m) can otherwise
    // push a point that sat a fraction of a metre inside the boundary just outside it
    const rx = +x.toFixed(5), ry = +y.toFixed(5);
    if (!inRing(rx, ry, p.outer)) continue;
    let hole = false;
    for (const h of p.holes) if (inRing(rx, ry, h)) { hole = true; break; }
    if (hole) continue;
    pts.push([ ry, rx ]);   // [lat, lon]
  }
  return pts;
}

// ---- build ----
const areas = {};
let totCases = 0, totDots = 0, missing = [], short = [];

for (const f of geo.features){
  const code = f.properties && f.properties.code;
  const m    = code && meta[code];
  const name = (m && m.name) || (f.properties && f.properties.name);
  if (!name) { missing.push(code || "?"); continue; }

  let n = byUTLA[name];
  if (n == null) { missing.push(name); n = 0; }
  n = Math.max(0, Math.round(n));
  totCases += n;

  const parts = partsOf(f.geometry);
  const d = samplePoints(parts, n, mulberry32(seedOf(arm + "|" + name)));
  if (d.length < n) short.push(name + " " + d.length + "/" + n);
  totDots += d.length;

  areas[name] = { tgtN: n, d: d };
}

const payload = {
  dotValue: 1,
  basis: "people ill right now (sim_projections.js med[0])",
  totNow: totCases,
  totTgt: totCases,
  areas: areas
};

// Compact JSON: keep the coordinate arrays on one line each, as before.
const out = "window.__CASEDOTS__=" + JSON.stringify(payload) + ";\n";
const dest = path.join(BASE, arm, "case_dots.js");
fs.writeFileSync(dest, out);

console.log(arm + ": " + geo.features.length + " areas, " + totCases + " ill now -> " + totDots +
            " dots, " + (out.length/1048576).toFixed(2) + " MB");
if (missing.length) console.log("  no case count for: " + missing.slice(0,10).join(", ") + (missing.length>10 ? " (+"+(missing.length-10)+")" : ""));
if (short.length)   console.log("  UNDER-SAMPLED: " + short.join(", "));
