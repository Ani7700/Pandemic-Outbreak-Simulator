// Independent check of the regenerated case_dots.js:
//   1. every area's dot count equals its confirmed-case count
//   2. every dot lies inside the polygon of the area it is filed under
//      (winding number -- a different algorithm from the ray casting used to generate)
//   3. no dot is misfiled into a neighbouring area
//   4. nothing escapes the GB bounding box
const fs = require("fs"), path = require("path"), BASE = __dirname;

function loadDots(arm){
  const src = fs.readFileSync(path.join(BASE, arm, "case_dots.js"), "utf8");
  const sb = { window: {} };
  new Function("window", "globalThis", src).call(sb, sb.window, sb);
  return sb.window.__CASEDOTS__;
}
// winding number, independent of the generator's ray casting
function wnInside(x, y, r){
  let wn = 0;
  for (let i = 0; i < r.length - 1; i++){
    const x0 = r[i][0], y0 = r[i][1], x1 = r[i+1][0], y1 = r[i+1][1];
    const side = (x1 - x0) * (y - y0) - (x - x0) * (y1 - y0);
    if (y0 <= y){ if (y1 > y && side > 0) wn++; }
    else        { if (y1 <= y && side < 0) wn--; }
  }
  return wn !== 0;
}
function featInside(x, y, g){
  const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
  for (const poly of polys){
    if (!wnInside(x, y, poly[0])) continue;
    let hole = false;
    for (let k = 1; k < poly.length; k++) if (wnInside(x, y, poly[k])) { hole = true; break; }
    if (!hole) return true;
  }
  return false;
}

let fail = 0;
for (const arm of ["tarnpox", "verrow", "solvik"]){
  const D    = loadDots(arm);
  const geo  = JSON.parse(fs.readFileSync(path.join(BASE, arm, "utla.geojson"), "utf8"));
  const meta = JSON.parse(fs.readFileSync(path.join(BASE, arm, "utla_data.json"), "utf8"));
  const cs   = JSON.parse(fs.readFileSync(path.join(BASE, arm, "measles_cases.json"), "utf8")).byUTLA;

  const featByName = {};
  for (const f of geo.features){ const m = meta[f.properties.code]; if (m) featByName[m.name] = f; }

  // 1. counts
  let bad = [], tot = 0, totCase = 0;
  for (const name in cs){
    const n = cs[name], got = D.areas[name] ? D.areas[name].d.length : -1;
    totCase += n; tot += Math.max(0, got);
    if (got !== n) bad.push(name + " " + got + "!=" + n);
  }
  const extra = Object.keys(D.areas).filter(n => !(n in cs));

  // 2/3. geometry -- every dot of a 25-area sample, checked against its own polygon
  const names = Object.keys(D.areas).sort();
  const step = Math.max(1, Math.floor(names.length / 25));
  let checked = 0, outside = 0, misfiled = 0, oob = 0;
  for (let i = 0; i < names.length; i += step){
    const name = names[i], f = featByName[name];
    if (!f) continue;
    for (const ll of D.areas[name].d){
      const lat = ll[0], lon = ll[1];
      checked++;
      if (lat < 49.7 || lat > 61.1 || lon < -8.7 || lon > 2.1) oob++;
      if (!featInside(lon, lat, f.geometry)) outside++;
    }
  }
  // 3. a smaller sample checked against every OTHER area
  let cross = 0, crossBad = 0;
  for (let i = 0; i < names.length; i += step){
    const name = names[i], d = D.areas[name].d;
    for (let j = 0; j < d.length; j += Math.max(1, Math.floor(d.length / 4))){
      const lat = d[j][0], lon = d[j][1]; cross++;
      for (const f of geo.features){
        const m = meta[f.properties.code];
        if (!m || m.name === name) continue;
        if (featInside(lon, lat, f.geometry)) { crossBad++; break; }
      }
    }
  }

  const ok = !bad.length && !extra.length && !outside && !oob && !crossBad && tot === totCase;
  if (!ok) fail++;
  console.log((ok ? "PASS " : "FAIL ") + arm +
    ": " + tot + " dots = " + totCase + " cases across " + Object.keys(D.areas).length + " areas" +
    " | geom " + checked + " dots checked, " + outside + " outside own area, " + oob + " out of GB bbox" +
    " | cross " + cross + " sampled, " + crossBad + " also inside another area");
  if (bad.length)   console.log("   count mismatch: " + bad.slice(0,8).join("; "));
  if (extra.length) console.log("   areas with dots but no case count: " + extra.slice(0,8).join(", "));
}

// the case Jessy reported
console.log("");
const V = loadDots("verrow");
const cv = JSON.parse(fs.readFileSync(path.join(BASE, "verrow", "measles_cases.json"), "utf8")).byUTLA;
for (const n of ["Cambridgeshire", "Bedford", "Central Bedfordshire", "Peterborough"]){
  if (V.areas[n]) console.log("  verrow " + n + ": " + cv[n] + " cases, " + V.areas[n].d.length + " dots");
}
process.exit(fail ? 1 : 0);
