const fs=require('fs'),p=require('path');
const ROOT='/sessions/rcw-01pkc2mww83bfqwm5a8gy588/mnt/dissertation/offline_morl-main/frontend';
const OUT='/sessions/rcw-01pkc2mww83bfqwm5a8gy588/mnt/dissertation/ANSWER_KEY.md';
const ARMS=[['verrow','Verrow fever  (measles)'],['solvik','Solvik  (rubella)'],['tarnpox','Tarnpox  (mumps)']];
const ORDER=['A_cov_val','A_level','C1','C_dose2','C_ratio','C5','A_peakht',
             'B_cov_val','B_cases','XB','XC','Fpeakht','Fpeaktime','XD'];
const STAR=new Set(['C1','C_dose2','C_ratio','C5']);
const PART=id=>ORDER.indexOf(id)<7?'P1':'P2';
const RL=["Low","Medium","High","Very high","Not sure"];

function radios(s){
  const out={};
  for(const id of ORDER){
    const i=s.indexOf('RADIO("'+id+'"'); if(i<0) throw new Error('missing '+id);
    let d=0,j=s.indexOf('(',i),e=-1;
    for(let k=j;k<s.length;k++){if(s[k]==='(')d++;else if(s[k]===')'){d--;if(d===0){e=k;break;}}}
    const seg=s.slice(i,e+1);
    const pm=seg.match(/RADIO\("[^"]+","((?:[^"\\]|\\.)*)"/);
    const om=seg.match(/\[[^\]]*\]/);
    const key=+seg.slice(seg.lastIndexOf(',')+1,-1).trim();
    const opts=om?JSON.parse(om[0]):RL;
    out[id]={prompt:pm[1].replace(/\\"/g,'"'),opts,key,ans:opts[key]};
  }
  return out;
}

const HEAD=`# Comprehension answer key (all 3 diseases)

Q1-Q14 match on-screen numbers and data column prefixes (Q0N_<id>). Score: Q0N_<id>_correct (1=correct).
Cross-disease pooling: join on <id> (numbers differ because each arm carries its own coverage and case data).

**Prototype comparison:** arms (survey1/2/3 = versions 1/2/7) differ ONLY in the step-3 risk display; the ★ items
(C1, C_dose2, C_ratio, C5) are the only prototype-sensitive ones. Use **\`score_risk_display\`** (0-4) as the primary DV.
All 3 arms display the same values (out of 100); answer units are matched so no format gets a free read.

**This file is generated** from \`{arm}/survey.html\` by \`gen_key.js\` — regenerate it after any survey edit rather
than hand-editing, so the key cannot drift from what participants actually see.

**Risk band now read off the curve (2026-07-26).** The community risk badge is no longer computed from coverage.
\`riskFromCurve()\` takes the highest point of the six-week median projection, divides by the area's under-5
population, and bands that rate against per-disease cut-points (35th / 68th / 87th percentile of areas with a
reportable peak), with a floor of 10 people and a cap of MEDIUM wherever Re < 1. Badge and chart are therefore
computed from the same numbers and cannot disagree. Consequences for this key:

- **Cambridgeshire is no longer MEDIUM in any arm.** It is VERY HIGH in Tarnpox (coverage 72%, well under the
  85% threshold) and LOW in Verrow and Solvik (coverage 91% and 90%, at or over threshold). \`A_level\` changed
  in Verrow and Solvik.
- **Case counts were redrawn independently of coverage** (corr fell from -0.94 to about 0). Cambridgeshire now has
  more recorded cases than Hackney in all three arms, so \`XC\` is "Cambridge / Cambridgeshire" in all three —
  it was "Hackney" in Verrow and Solvik.
- **\`B_cases\` changed from a comparative judgement to a direct read-off.** With cases drawn independently of
  coverage Hackney lands mid-pack (43rd, 70th and 25th percentile), and nothing on screen tells a participant
  where an area sits in the national distribution, so "compared with other areas" was no longer answerable.
  The comparative construct survives in XB, XC and XD.
- **\`A_peakht\` / \`Fpeakht\` options were rebuilt** so that every distractor is a number printed on the same
  screen — the other area's peak, the area's case count, its under-5 population, its total population, or the
  England-wide case total. Both prompts now say "on the 'most likely' line" so the shaded range of outcomes
  cannot be misread as the answer.
- **\`Fpeaktime\` changed in Tarnpox** (Hackney's curve now falls away in the first week instead of rising).

`;

let md=HEAD;
const facts=[];
for(const [arm,title] of ARMS){
  const s=fs.readFileSync(p.join(ROOT,arm,'survey.html'),'utf8');
  const R=radios(s);
  md+=`## ${title}\n\n| Q# | Part | DV | Data column | Question | Correct answer |\n|---|---|---|---|---|---|\n`;
  ORDER.forEach((id,n)=>{
    const q=String(n+1).padStart(2,'0');
    md+=`| Q${n+1} | ${PART(id)} | ${STAR.has(id)?'★':''} | \`Q${q}_${id}\` | ${R[id].prompt} | **${R[id].ans}** |\n`;
  });
  md+='\n';
}
md+=`## Underlying numbers (for checking the keys above)

| | Tarnpox | Verrow | Solvik |
|---|---|---|---|
| Herd-immunity threshold | 85% | 93% | 89% |
| Cambridgeshire 2nd-dose coverage | 72% | 91% | 90% |
| Cambridgeshire cases (6 months) | 715 | 539 | 648 |
| Cambridgeshire six-week peak | 162, still rising | 36, creeping up | 32, easing to 24 |
| Cambridgeshire band | VERY HIGH | LOW | LOW |
| Hackney 2nd-dose coverage | 96% | 56% | 71% |
| Hackney cases (6 months) | 145 | 289 | 77 |
| Hackney six-week peak | 6, gone within a week | 2,267 at week 5, falling to 1,448 | 150, still rising |
| Hackney band | LOW | VERY HIGH | MEDIUM |
| Cambridgeshire under-5 population | 35,406 | 35,406 | 35,406 |
| Hackney under-5 population | 16,303 | 16,303 | 16,303 |
| England total cases (6 months) | 55,839 | 53,701 | 58,749 |

Peaks are the highest point of the median ("most likely") line over days 0-42, and are the number of children
under 5 ill at the same time. The susceptible pool is the under-5 cohort only, so a projection can never exceed
the area's child population, let alone its total population.
`;
fs.writeFileSync(OUT,md);
console.log('wrote '+OUT+' ('+md.length+' bytes)');
