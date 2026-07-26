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
  chk('A_cov_val',nearest(radio(s,'A_cov_val').opts,camCov),'Cambs coverage '+camCov+'%');
  chk('A_level',bc.k,'Cambs band');
  chk('A_peakht',nearest(radio(s,'A_peakht').opts,bc.pk),'Cambs peak '+bc.pk);
  chk('B_cov_val',nearest(radio(s,'B_cov_val').opts,hacCov),'Hackney coverage '+hacCov+'%');
  chk('B_cases',nearest(radio(s,'B_cases').opts,hacN),'Hackney ill now '+hacN);
  chk('XB',camCov>hacCov?0:1,`${camCov} vs ${hacCov}`);
  chk('XC',camN>hacN?0:1,`${camN} vs ${hacN}`);
  chk('Fpeakht',nearest(radio(s,'Fpeakht').opts,bh.pk),'Hackney peak '+bh.pk);
  const shape = bh.day>=41 ? 0 : (bh.end < bh.pk*0.98 ? 2 : 1);
  chk('Fpeaktime',shape,`peak d${bh.day} end ${bh.end} of ${bh.pk}`);
  chk('XD',bc.Re>bh.Re?0:1,`Re ${bc.Re.toFixed(2)} vs ${bh.Re.toFixed(2)}`);
  // every numeric distractor must be a number visible on the same screen
  const screen=[bc.pk,bh.pk,camN,hacN,U[CAM].under5,U[HAC].under5,U[CAM].pop,U[HAC].pop,Math.round(camCov),Math.round(hacCov),
                Object.values(C).reduce((a,b)=>a+b,0)];
  for(const id of ['A_peakht','Fpeakht','B_cases']){
    radio(s,id).opts.forEach(o=>{const m=o.replace(/[^0-9]/g,'');if(!m)return;const v=+m;
      if(!screen.some(x=>Math.abs(Math.log10(Math.max(x,1))-Math.log10(Math.max(v,1)))<0.16 && Math.abs(x-v)/Math.max(x,v)<0.35))
        bad(`${arm} ${id}: distractor "${o}" is not a number shown on screen`);});
  }
}

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

console.log('\n'+(fail?`### ${fail} FAILURE(S)`:'### ALL CHECKS PASSED'));
