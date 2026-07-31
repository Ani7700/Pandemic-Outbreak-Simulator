const fs=require('fs'),p=require('path');
// default to this script's own directory, so the generator runs wherever the repo sits
const ROOT=process.env.FRONTEND_ROOT || __dirname;
const OUT=process.env.ANSWER_KEY || p.join(ROOT,'..','..','ANSWER_KEY.md');
const ARMS=[['verrow','Verrow fever  (measles)'],['solvik','Solvik  (rubella)'],['tarnpox','Tarnpox  (mumps)']];
const ORDER=['C1','C_ratio','C5','C_diff','C_comp','C_step2','A_peakht','Q_gist','Q_band','B_cases','Fpeaktime','Q_nonlinear'];
// The starred set is score_risk_display: the items that read the step-3 display and therefore
// the only ones the prototype manipulation can move. Protocol v7 doubled it from four to eight.
const STAR=new Set(['C1','C_ratio','C_diff','C5','C_comp','C_step2']);
const PART=id=>ORDER.indexOf(id)<9?'P1':'P2';
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
(C1, C_ratio, C5, C_diff, C_comp, C_step2) are the only prototype-sensitive ones.
Use **\`score_risk_display\`** (0-6) as the primary DV.
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
  screen — the other area's peak, the area's own current count, its under-5 population, its total population,
  or the England-wide total. Both prompts now say "on the 'most likely' line" so the shaded range of outcomes
  cannot be misread as the answer.
- **\`Fpeaktime\` changed in Tarnpox** (Hackney's curve now falls away in the first week instead of rising).

**Second revision (2026-07-26): the interface counts confirmed cases active today, not cases since January.** Every number a
participant sees is the number of people ill at this moment, taken from day 0 of the same median projection the
outbreak chart plots. The six-month cumulative count is gone from the interface entirely — map panel, red dots,
choropleth, rank table, tooltip and briefings all speak one unit, so the figure beside the map and the figure the
curve starts from can no longer look like a contradiction. Current illness is the cumulative count times the
infectious period over 180 days, a constant within each arm, so the ranking of areas is unchanged and every
comparative item keeps its answer.

- **\`B_cases\` is now a current-illness read-off.** New prompt and new answer in all three arms. The keyed
  option index moved from 1 to 0 in Verrow and Tarnpox; Solvik was already 0.
- **\`XC\` wording only** — "more active {disease} cases today" rather than "more cases at the moment".
  The question always asked about the present; the page now actually answers it. Answer unchanged.
- **\`A_peakht\` and \`Fpeakht\` keep their answers.** Only distractors moved: the slot holding the area's
  six-month cumulative count held a number that no longer exists anywhere on screen, so it became the England
  current total or the area's own current count.
- **Nothing else moved** — \`A_level\`, \`A_cov_val\`, \`B_cov_val\`, \`XB\`, \`Fpeaktime\` and \`XD\` are untouched.

**Primary scale is six items, one per operation.** \`score_risk_display\` runs 0-6 over \`C1\` (read a stated
figure), \`C_ratio\` (relative comparison), \`C5\` (rescale the denominator), \`C_diff\` (difference across the
full range), \`C_comp\` (the complement) and \`C_step2\` (the one-dose to two-dose step). The self-report item
was dropped: it asked which figure the reader had used, which has no key that is true of the world.

\`C_comp\` and \`C_step2\` exist because the other four are arithmetic on numbers all three prototypes print
identically, so no graphic could show an advantage on any of them. The complement is the uncoloured dots on
the icon array; the one-dose to two-dose step is one segment's slope on the line chart. \`C_step2\` had been
cut as redundant with \`C_diff\` — true of the arithmetic, false of the display — and is reinstated.

**Option positions rotate.** Each item places its correct option at a different index in each of the three
diseases, and within any one disease no position is correct for more than two of the eight items. Before this,
C_dose2 was always first and C_ratio and C5 always third, so a participant answering by position alone could
score 4/4 on every trial without reading the display. They never see whether an answer was right, so nothing
could be learned — but a low-effort participant could still sweep the scale, which pushed it towards its
ceiling. \`verify_survey_keys.js\` enforces both rules.

**Questionnaire trimmed to fourteen scored items (protocol v7).** Seven items were removed before fielding:
\`B_cov_val\`, \`XB\`, \`XC\` and \`Fpeakht\` from the comprehension block, and TLX frustration, pace and
self-rated performance from the workload block. Each was redundant, repeated an operation another item already
tested, or produced only descriptive data that no inferential test uses. No risk-display item was touched, so
\`score_risk_display\` is unaffected; \`score_shared\` now runs 0-6 rather than 0-10. Per trial the count fell
from 27 items to 20, and per participant from 81 to 60.

**Note on the change log above.** Entries dated before this trim still discuss \`B_cov_val\`, \`XB\`, \`XC\` and
\`Fpeakht\`. They describe revisions made while those items were still in the survey and are kept for the
record. Those four items are no longer asked, and no table below contains them.
- **Watch Tarnpox Q9 against Q12.** Hackney's Tarnpox curve is flat, so its current count and its six-week peak
  are both 6 — the two questions share a numeric answer, and a participant who reads only the map panel gets
  Q12 right without reading the chart. Consider a different Part 2 area for that arm.

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
| Cambridgeshire cases active today | 28 | 24 | 32 |
| Cambridgeshire six-week peak | 162, still rising | 36, creeping up | 32, easing to 24 |
| Cambridgeshire band | VERY HIGH | LOW | LOW |
| Hackney 2nd-dose coverage | 96% | 56% | 71% |
| Hackney cases active today | 6 | 13 | 4 |
| Hackney six-week peak | 6, gone within a week | 2,267 at week 5, falling to 1,448 | 150, still rising |
| Hackney band | LOW | VERY HIGH | MEDIUM |
| Cambridgeshire under-5 population | 35,406 | 35,406 | 35,406 |
| Hackney under-5 population | 16,303 | 16,303 | 16,303 |
| England total cases active today | 2,177 | 2,389 | 2,944 |

Peaks are the highest point of the median ("most likely") line over days 0-42, and are the number of children
under 5 ill at the same time. The susceptible pool is the under-5 cohort only, so a projection can never exceed
the area's child population, let alone its total population.
`;
fs.writeFileSync(OUT,md);
console.log('wrote '+OUT+' ('+md.length+' bytes)');
