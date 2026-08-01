const fs=require('fs'),p=require('path'),cp=require('child_process');
const ROOT=process.env.FRONTEND_ROOT || __dirname;
const ARMS=['tarnpox','verrow','solvik'];
const MEAS={tarnpox:{R0:3.1,ve2:0.80},verrow:{R0:5.5,ve2:0.88},solvik:{R0:5.0,ve2:0.90}};
const CUTS={tarnpox:{m:117,h:221,v:367},verrow:{m:1038,h:7332,v:11112},solvik:{m:238,h:1282,v:2772}};
const CAM='E10000003',HAC='E09000012';
let fail=0; const bad=m=>{console.log('  FAIL '+m);fail++;};

function loadProj(arm){const src=fs.readFileSync(p.join(ROOT,arm,'sim_projections.js'),'utf8');
  const sb={window:{}};new Function('window','globalThis',src).call(sb,sb.window,sb);return sb.window.__SIMPROJ__;}
function band(arm,code,P,U){const d=U[code],w=P[code].med.slice(0,43),pk=Math.max(...w);
  const r=pk/d.under5*1e5,Re=MEAS[arm].R0*(1-d.mmr2*MEAS[arm].ve2),c=CUTS[arm];
  let k=pk>=10?(r>=c.v?3:r>=c.h?2:r>=c.m?1:0):0; if(Re<1&&k>1)k=1;
  return {k,pk,day:w.indexOf(pk),end:w[42],Re};}
function radio(s,id){const i=s.indexOf('RADIO("'+id+'"');if(i<0)return null;
  let d=0,j=s.indexOf('(',i),e=-1;for(let k=j;k<s.length;k++){if(s[k]==='(')d++;else if(s[k]===')'){d--;if(d===0){e=k;break;}}}
  const seg=s.slice(i,e+1),o=seg.match(/\[[^\]]*\]/);
  return {opts:o?JSON.parse(o[0]):null,key:+seg.slice(seg.lastIndexOf(',')+1,-1).trim(),seg};}
// nearest option to a target number, ignoring "Not sure"
function nearest(opts,t){let bi=-1,bd=Infinity;
  opts.forEach((o,i)=>{const m=o.replace(/[^0-9]/g,'');if(!m)return;const v=+m;const d=Math.abs(v-t);if(d<bd){bd=d;bi=i;}});
  return bi;}

console.log('=== 1. SURVEY ANSWER KEYS re-derived from the data files ===');
for(const arm of ARMS){
  const P=loadProj(arm),U=JSON.parse(fs.readFileSync(p.join(ROOT,arm,'utla_data.json'),'utf8'));
  // people ill right now = day 0 of the median curve, which is what the page now shows
  const C={}; for(const code in U){const q=P[code]; if(q&&q.med&&q.med.length) C[U[code].name]=q.med[0];}
  const s=fs.readFileSync(p.join(ROOT,arm,'survey.html'),'utf8');
  const bc=band(arm,CAM,P,U), bh=band(arm,HAC,P,U);
  const camCov=U[CAM].mmr2*100, hacCov=U[HAC].mmr2*100;
  const camN=C['Cambridgeshire'], hacN=C['Hackney'];
  console.log(`-- ${arm}: Cambs cov ${camCov}% ill-now ${camN} band ${bc.k} peak ${bc.pk} | Hackney cov ${hacCov}% ill-now ${hacN} band ${bh.k} peak ${bh.pk}`);
  const chk=(id,want,note)=>{const r=radio(s,id);if(!r)return bad(id+' missing');
    if(r.key!==want) bad(`${arm} ${id}: key=${r.key} but data says ${want} (${note})`);};
  chk('A_peakht',nearest(radio(s,'A_peakht').opts,bc.pk),'Cambs peak '+bc.pk);
  chk('B_cases',nearest(radio(s,'B_cases').opts,hacN),'Hackney ill now '+hacN);
  const shape = bh.day>=41 ? 0 : (bh.end < bh.pk*0.98 ? 2 : 1);
  chk('Fpeaktime',shape,`peak d${bh.day} end ${bh.end} of ${bh.pk}`);
  // Every numeric distractor must be a number the participant can actually see on the
  // screen the item is asked on. This list used to be written by hand and included the
  // under-5 and total populations, which the interface never displays anywhere -- four
  // distractors (35,000 / 710,000 / 16,000 / 270,000) passed this check by matching
  // figures that are not on screen at all. It is now derived: the curve's start and
  // six-week peak, the three y-axis gridline values the chart prints, the two coverage
  // percentages, the England total in the map panel, and the three dose-card values.
  const axisTicks = code => {
    const m=P[code].med.slice(0,43), h=P[code].hi.slice(0,43);
    const ym=Math.max(1, Math.max(...m)*1.15, Math.max(...h)*1.05);
    return [ym/3, 2*ym/3, ym];
  };
  const DOSE={tarnpox:[40,20,8],verrow:[60,27,7],solvik:[50,20,5]}[arm];
  const screen=[bc.pk,bh.pk,camN,hacN,P[CAM].med[0],P[HAC].med[0],
                Math.round(camCov),Math.round(hacCov),
                Object.values(C).reduce((a,b)=>a+b,0),
                ...axisTicks(CAM),...axisTicks(HAC),...DOSE];
  for(const id of ['A_peakht','B_cases']){
    radio(s,id).opts.forEach(o=>{const m=o.replace(/[^0-9]/g,'');if(!m)return;const v=+m;
      if(!screen.some(x=>Math.abs(Math.log10(Math.max(x,1))-Math.log10(Math.max(v,1)))<0.16 && Math.abs(x-v)/Math.max(x,v)<0.35))
        bad(`${arm} ${id}: distractor "${o}" is not a number shown on screen`);});
  }
}

console.log('\n=== 1b. RISK-DISPLAY ITEMS re-derived from the disease model ===');
// The eight primary-scale items read the step-3 display. The interface does not store those
// percentages; it computes them from the disease model as sar*(1-ve). So parse sar/ve1/ve2 out
// of the deployed interface and recompute, rather than restating the numbers here -- that is how
// the one-dose collision (50*0.40 and 40*0.50 both give 20) was found in the first place.
function model(arm){
  const s=fs.readFileSync(p.join(ROOT,arm,'index.html'),'utf8');
  const g=re=>{const m=s.match(re); if(!m) throw new Error(arm+' has no '+re); return +m[1];};
  return {sar:g(/sar:\s*([\d.]+)/), ve1:g(/ve1:\s*([\d.]+)/), ve2:g(/ve2:\s*([\d.]+)/)};
}
// first number in an option string: "About 60 in 100" is 60, not 60100
const numOf=o=>{const m=o.match(/(\d[\d,]*)/); return m?+m[1].replace(/,/g,''):null;};
const RISK_IDS=['Q_dgist','C_ratio','C_diff','C_comp','C_step2','Q_dapply'];
// Every scored risk-display item is re-derived from the model rather than trusted.
//
// Two changes from the five-item set. The self-report item was dropped: it asked which figure
// the reader used, which has no key that is true of the world, and it was being summed into
// the primary score beside four items that do. C_comp (the complement) and C_step2 (the
// one-dose to two-dose step) were added.
//
// C_step2 had been cut as redundant with C_diff, on the grounds that both are subtractions.
// That is true of the arithmetic and false of the display. C_diff spans the two end rows,
// which every prototype prints; C_step2 spans two adjacent rows, which on the line chart is
// one segment's slope. The complement is likewise a subtraction, and on the icon array it is
// the uncoloured dots. Without these two, every scored item was arithmetic on numbers printed
// identically by all three prototypes, so no graphic could show an advantage on any of them.
//
// 2026-08-01. That argument justified C_comp and C_step2; it never justified C1 and C5, and
// with those two in, the whole scale was one read-off plus five one-step operations on the
// same three numbers — the same skill measured six times, all of it near the floor of what
// the manipulation can distinguish. C1 (read the top row) and C5 (multiply the top row by
// two) are out. In their place:
//
//   Q_dgist   the top row as a coarse fraction. No arithmetic. This is the part-whole
//             judgement the icon array is supposed to be good at and the percentage display
//             is supposed to be bad at, so it is the one item whose format effect is
//             predicted by direction and not just by size.
//   Q_dapply  two rows used together: 100 unvaccinated and 100 fully vaccinated, all exposed.
//             Two look-ups, two scalings and a sum, and the only item in the scale that
//             cannot be answered from a single row.
//
// The scale is still six items, so the primary DV keeps its length and its power.
const ARITH=['C_ratio','C_diff','C_comp','C_step2','Q_dapply'];
// Q_dgist's options are fractions, not counts, so it is checked separately: read each option
// as a fraction and the key must be the one nearest the model's attack rate.
const fracOf=o=>{const m=o.match(/(\d+)\s*in\s*(\d+)/); return m?+m[1]/+m[2]:null;};
const keyIdx={}, keyTxt={};
for(const arm of ARMS){
  const m=model(arm), nd=m.sar*100, d1=nd*(1-m.ve1), d2=nd*(1-m.ve2);
  const want={C_ratio:Math.round(nd/d2), C_diff:Math.round(nd-d2),
              C_comp:Math.round(100-d2), C_step2:Math.round(d1-d2),
              Q_dapply:Math.round(nd+d2)};
  const s=fs.readFileSync(p.join(ROOT,arm,'survey.html'),'utf8');
  keyIdx[arm]={}; keyTxt[arm]={};
  console.log(`-- ${arm}: display shows ${Math.round(nd)} / ${Math.round(d1)} / ${Math.round(d2)} per 100`);
  for(const id of RISK_IDS){
    const r=radio(s,id);
    if(!r){ bad(`${arm} ${id} missing from the item bank`); continue; }
    keyIdx[arm][id]=r.key; keyTxt[arm][id]=r.opts[r.key];
    if(ARITH.includes(id)){
      const got=numOf(r.opts[r.key]);
      if(got!==want[id]) bad(`${arm} ${id}: keyed option says ${got}, the model gives ${want[id]}`);
    }
    if(id==='Q_dgist'){
      let bi=-1,bd=Infinity;
      r.opts.forEach((o,i)=>{const f=fracOf(o); if(f==null)return;
        const d=Math.abs(f-m.sar); if(d<bd){bd=d;bi=i;}});
      if(r.key!==bi)
        bad(`${arm} Q_dgist: key is "${r.opts[r.key]}", but ${Math.round(nd)} in 100 is nearest "${r.opts[bi]}"`);
    }
  }
  // Q_thresh and Q_gist turn on where this area's coverage sits relative to the threshold the
  // page prints. Derive the gap and check the keyed band, rather than trusting the item bank.
  {
    const P=loadProj(arm);
    const iface=fs.readFileSync(p.join(ROOT,arm,'index.html'),'utf8');
    const herd=+iface.match(/herd:\s*([\d.]+)/)[1]*100;
    const cov=JSON.parse(fs.readFileSync(p.join(ROOT,arm,'utla_data.json'),'utf8'))[CAM].mmr2*100;
    const gap=cov-herd;
    const wantG = gap>=0?0 : gap>-10?1 : 2;
    const rg=radio(s,'Q_gist');
    if(rg && rg.key!==wantG)
      bad(`${arm} Q_gist: key ${rg.key}, coverage ${cov.toFixed(0)} vs threshold ${herd.toFixed(0)} gives ${wantG}`);
    // Q_nonlinear: which area's six-week peak is bigger, and by a few times or tens of times
    const cp=Math.max(...P[CAM].med.slice(0,43)), hp=Math.max(...P[HAC].med.slice(0,43));
    const ratio = cp>hp ? cp/hp : hp/cp;
    const wantN = cp>hp ? (ratio<10?0:1) : (ratio<10?2:3);
    const rn=radio(s,'Q_nonlinear');
    if(rn && rn.key!==wantN)
      bad(`${arm} Q_nonlinear: key ${rn.key}, peaks ${cp.toFixed(0)} vs ${hp.toFixed(0)} (${ratio.toFixed(1)}x) give ${wantN}`);
    // Q_band: the top of the shaded range at the Cambridgeshire peak
    const chi=Math.max(...P[CAM].hi.slice(0,43));
    const rb=radio(s,'Q_band');
    if(rb){
      const got=numOf(rb.opts[rb.key]);
      if(Math.abs(got-chi)/chi > 0.20)
        bad(`${arm} Q_band: key says ${got}, the top of the band is ${chi.toFixed(0)}`);
    }
  }
  const decl=s.match(/const RISK_IDS\s*=\s*\[([^\]]*)\]/);
  const inPage=decl?JSON.parse('['+decl[1]+']'):[];
  if(inPage.join()!==RISK_IDS.join())
    bad(`${arm}: page sums score_risk_display over [${inPage.join()}]`);
}
// A key shared by two diseases would let an answer transfer between trials.
for(const id of RISK_IDS){
  const ks=ARMS.map(a=>keyTxt[a][id]);
  if(new Set(ks).size!==ARMS.length) bad(`${id}: key repeats across diseases (${ks.join(' / ')})`);
}
// Constraint 1 (protocol v7 section 6.3): no answer POSITION transfers between trials.
for(const id of RISK_IDS){
  const ix=ARMS.map(a=>keyIdx[a][id]);
  if(new Set(ix).size!==ARMS.length) bad(`${id}: correct option at the same index in two diseases (${ix.join(',')})`);
}
// Constraint 2: within one trial, no single position may be correct for more than two of the
// eight, so a participant answering by position alone scores 2/8 rather than 8/8.
for(const arm of ARMS){
  const c={}; RISK_IDS.forEach(id=>{c[keyIdx[arm][id]]=(c[keyIdx[arm][id]]||0)+1;});
  // Relaxed from two to four. The old scale was eight variations of one arithmetic operation,
  // so its distractors were free to be anything and the positions could be balanced exactly.
  // The new scale has semantically ordered options (below -> above the threshold; small ->
  // large outbreak) and numeric options in ascending order with distractors that are named
  // misreadings; both fix where the key can sit. Item quality is worth more than positional
  // balance here, particularly since participants never learn whether an answer was right, so
  // no position can be learned. Section 9 flags participants whose responses sit at a constant
  // position instead.
  for(const k in c) if(c[k]>3) bad(`${arm}: position ${k} is correct for ${c[k]} of the eight items`);
}
console.log('  6 items x 3 diseases: keys match the model, positions rotate, no position sweeps a trial');

console.log('\n=== 1c. TRIMMED ITEMS stay out ===');
// Seven items were cut because they were redundant or descriptive-only (protocol v7 section
// 6.3). If one is reinstated by hand the answer key and the analysis plan drift apart, so
// assert their absence rather than trusting it.
// C_step2 is deliberately absent from this list: it was cut, then reinstated (see 1b).
const CUT=['B_cov_val','XB','XC','Fpeakht','C_scale2','A_cov_val','A_level','XD','Q_whichfig',
           'Q_quantity','C_dose2','C_half','Q_thresh','TLX_frustration','TLX_pace','TLX_perf',
           // 2026-08-01: the read-off and the x2 rescale, replaced by Q_dgist and Q_dapply
           'C1','C5'];
for(const arm of ARMS){
  const s=fs.readFileSync(p.join(ROOT,arm,'survey.html'),'utf8');
  for(const id of CUT) if(s.includes('"'+id+'"')) bad(`${arm}: ${id} was cut but is present again`);
  const n=(s.match(/RADIO\(/g)||[]).length + (s.match(/LIK\(/g)||[]).length;
  if(n!==18) bad(`${arm}: ${n} items per trial, expected 18`);
}
console.log('  18 items per trial: 6 risk-display (1 gist + 4 arithmetic + 1 applied) + 6 shared + 4 subjective + 2 workload');

console.log('\n=== 1d. NO ITEM ANSWERS ANOTHER, AND NONE IS ON THE WRONG PAGE ===');
// Two faults were shipped and caught by eye rather than by a check. Q_band's stem stated the
// six-week peak, which is A_peakht's answer five questions earlier and revisable with the Back
// button. Q_gist said "this area" from inside the Hackney block while every key was computed
// from Cambridgeshire. Both are now asserted rather than trusted.
for(const arm of ARMS){
  const s=fs.readFileSync(p.join(ROOT,arm,'survey.html'),'utf8');
  const RLm=s.match(/RL\s*=\s*(\[[^\]]*\])/);
  const RL=RLm?JSON.parse(RLm[1]):[];
  const items={};
  const re1=/RADIO\("([A-Za-z_0-9]+)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*,\s*(\[[^\]]*\]|RL)\s*,\s*(\d+)\)/gs;
  let m; while((m=re1.exec(s))){
    const opts = m[3]==='RL' ? RL : JSON.parse(m[3]);
    items[m[1]]={stem:m[2], key:opts[+m[4]]};
  }
  // (a) no stem may contain another item's numeric answer
  const generic=new Set(['100','200','50','6']);
  for(const q in items){
    const nums=new Set((items[q].stem.match(/\b\d[\d,]*\b/g)||[]).filter(x=>!generic.has(x)));
    for(const q2 in items){
      if(q2===q) continue;
      const kn=(items[q2].key.match(/\b\d[\d,]*\b/g)||[])[0];
      if(kn && nums.has(kn))
        bad(`${arm}: ${q}'s stem states ${kn}, which is ${q2}'s answer`);
    }
  }
  // (b) an item naming one area must sit in that area's block
  const blocks=[...s.matchAll(/\{tool:(?:true|false),([\s\S]*?)\n \]\}/g)].map(x=>x[1]);
  ['Cambridge','Hackney'].forEach((area,bi)=>{
    const other=bi===0?'Hackney':'Cambridge';
    const ids=[...(blocks[bi]||'').matchAll(/RADIO\("([A-Za-z_0-9]+)"/g)].map(x=>x[1]);
    for(const id of ids){
      const st=items[id].stem, o=blocks[bi];
      const seg=o.slice(o.indexOf('RADIO("'+id+'"'));
      const optBlock=(seg.match(/\[[^\]]*\]/)||[''])[0];
      const namesBoth=optBlock.includes('Cambridge')&&optBlock.includes('Hackney');
      if(!namesBoth && st.includes(other))
        bad(`${arm}: ${id} names ${other} but sits in the ${area} block`);
    }
  });
}
console.log('  no stem states another answer; no item names the area it is not shown beside');

console.log('\n=== 2. COPIES byte-identical to their source ===');
for(const arm of ARMS){
  const idx=fs.readFileSync(p.join(ROOT,arm,'index.html')), sv=fs.readFileSync(p.join(ROOT,arm,'survey.html'));
  for(let v=1;v<=30;v++){const f=p.join(ROOT,arm,String(v),'index.html');
    if(fs.existsSync(f)&&!fs.readFileSync(f).equals(idx)) bad(`${arm}/${v}/index.html differs from source`);}
  for(const n of ['survey1.html','survey2.html','survey3.html'])
    if(!fs.readFileSync(p.join(ROOT,arm,n)).equals(sv)) bad(`${arm}/${n} differs`);
  if(!fs.readFileSync(p.join(ROOT,arm,'baseline','index.html')).equals(sv)) bad(`${arm}/baseline differs`);
}
console.log('  checked 3 arms x (30 copies + 3 surveys + baseline)');

console.log('\n=== 3. JS SYNTAX of every edited file ===');
const vm=require('vm');
for(const arm of ARMS){
  for(const rel of ['index.html','survey.html','infochat/index.html']){
    const s=fs.readFileSync(p.join(ROOT,arm,rel),'utf8');
    const blocks=[...s.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
    blocks.forEach((b,i)=>{try{new vm.Script(b[1]);}catch(e){bad(`${arm}/${rel} script#${i}: ${e.message}`);}});
  }
}
console.log('  all inline <script> blocks parse');

console.log('\n=== 4. NO STALE NUMBERS left in the briefings ===');
const STALE=[/sixty-seven thousand/,/67,000/,/about 111/,/about 20 confirmed/,/around 28 in the past/,/about 85 in the past/,/n\/130/,/riskFromCov/,/~91%, medium risk/,
  // the interface is current-illness only now: no cumulative wording may come back
  /in the past 6 months/,/cases in the past \\d+ months/i,/people ill right now/i,/measles_cases\.json/];
for(const arm of ARMS){
  for(const rel of ['index.html','survey.html','infochat/index.html']){
    const s=fs.readFileSync(p.join(ROOT,arm,rel),'utf8');
    STALE.forEach(re=>{if(re.test(s)) bad(`${arm}/${rel} still contains ${re}`);});
  }
}
console.log('  no stale values found');

console.log('\n=== 5. CACHE BUST consistent ===');
for(const arm of ARMS){const s=fs.readFileSync(p.join(ROOT,arm,'index.html'),'utf8');
  const m=s.match(/const DATA_V\s*=\s*"(\?v=\d+)"/); console.log(`  ${arm}: DATA_V=${m?m[1]:'MISSING'}`);
  if(!m) bad(arm+' DATA_V missing');}

console.log('\n=== 6. STUDY WRAPPER sequences ===');
// The wrapper is the only place the design lives in code, so the balance is asserted here
// rather than trusted. Both wrappers must agree; study_brutalist.html is the live one.
for(const f of ['study_brutalist.html','study.html']){
  const s=fs.readFileSync(p.join(ROOT,f),'utf8');
  const m=s.match(/const SEQUENCES = \{([\s\S]*?)\n\};/);
  if(!m){ bad(`${f}: no SEQUENCES block`); continue; }
  const rows=[...m[1].matchAll(/\d+:\[(.*?)\],\s*\/\/\s*skips (\w+)/g)];
  if(rows.length!==9){ bad(`${f}: ${rows.length} sequences, expected 9`); continue; }
  const cp={},cd={},dp={},sk={};
  for(const [,body,skip] of rows){
    const tr=[...body.matchAll(/\["(\w+)","(D\d)"\]/g)].map(x=>[x[1],x[2]]);
    if(tr.length!==3) bad(`${f}: a sequence has ${tr.length} trials`);
    if(new Set(tr.map(x=>x[1])).size!==3) bad(`${f}: a sequence repeats a disease`);
    if(tr.some(x=>x[0]===skip)) bad(`${f}: sequence marked "skips ${skip}" contains ${skip}`);
    if(!tr.some(x=>x[0]==='C')) bad(`${f}: a sequence has no control trial`);
    sk[skip]=(sk[skip]||0)+1;
    tr.forEach(([c,d],i)=>{cp[c+i]=(cp[c+i]||0)+1; cd[c+d]=(cd[c+d]||0)+1; dp[d+i]=(dp[d+i]||0)+1;});
  }
  for(const [c,want] of [['C',3],['F1',2],['F2',2],['F3',2]])
    for(let i=0;i<3;i++){
      if((cp[c+i]||0)!==want) bad(`${f}: ${c} appears ${cp[c+i]||0}x in position ${i+1}, want ${want}`);
      const d='D'+(i+1);
      if((cd[c+d]||0)!==want) bad(`${f}: ${c} appears ${cd[c+d]||0}x on ${d}, want ${want}`);
    }
  for(let i=0;i<3;i++) for(const d of ['D1','D2','D3'])
    if((dp[d+i]||0)!==3) bad(`${f}: ${d} appears ${dp[d+i]||0}x in position ${i+1}, want 3`);
  if(Object.values(sk).sort().join()!=='3,3,3') bad(`${f}: skipped-prototype counts ${JSON.stringify(sk)}`);
  if(!/seq<=9/.test(s)) bad(`${f}: seq range does not reach 9`);
  if(!/FIRST_PROTO/.test(s)) bad(`${f}: onboarding tour is still tied to the trial index`);
  if(!/baseline\//.test(s)) bad(`${f}: no route to the baseline path`);
}
console.log('  9 sequences, control 3x per position and 3x per disease, each prototype 2x/2x,');
console.log('  no repeated disease, tour decoupled from consent, baseline route present');

console.log('\n'+(fail?`### ${fail} FAILURE(S)`:'### ALL CHECKS PASSED'));
