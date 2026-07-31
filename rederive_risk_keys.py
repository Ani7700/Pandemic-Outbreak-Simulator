#!/usr/bin/env python3
"""
Independent re-derivation of the six risk-display keys.

Deliberately shares NO code with verify_survey_keys.js -- different language, different
parser, different derivation path. It starts from sar/ve1/ve2 in each arm's index.html,
recomputes what the step-3 dose card must print, derives what each item's answer must be,
and only then looks at what the survey files claim. The point is that a fault would have
to be made twice, independently, to survive.

Run:  python3 rederive_risk_keys.py
"""
import re, sys, os

ARMS = ("verrow", "solvik", "tarnpox")
ROOT = os.path.dirname(os.path.abspath(__file__))
fail = []

def check(ok, msg):
    print(("  ok   " if ok else "  FAIL ") + msg)
    if not ok:
        fail.append(msg)

# ---- 1. dose-card values, from the model constants ------------------------------------
print("=== 1. DOSE CARD re-derived from sar/ve1/ve2 ===")
card = {}
for arm in ARMS:
    src = open(os.path.join(ROOT, arm, "index.html"), encoding="utf-8").read()
    g = lambda k: float(re.search(r"\b%s\s*:\s*([0-9.]+)" % k, src).group(1))
    sar, ve1, ve2 = g("sar"), g("ve1"), g("ve2")
    # the renderers all print Math.round(exp*100), exp = sar * (1 - veInd)
    card[arm] = [round(sar * (1 - v) * 100) for v in (0.0, ve1, ve2)]
    print("  %-8s sar=%.2f ve1=%.2f ve2=%.2f  ->  %s" % (arm, sar, ve1, ve2, card[arm]))

# ---- 2. what each item's answer must be -----------------------------------------------
OPS = {
    "C1":     lambda n, o, t: n,          # read the stated no-dose frequency
    "C_ratio":lambda n, o, t: n / t,      # relative comparison
    "C5":     lambda n, o, t: n * 2,      # rescale to 200
    "C_diff": lambda n, o, t: n - t,      # absolute difference, full range
    "C_comp": lambda n, o, t: 100 - t,    # complement / framing flip
    "C_step2": lambda n, o, t: o - t,      # adjacent-level step
}
derived = {a: {k: f(*card[a]) for k, f in OPS.items()} for a in ARMS}

# ---- 3. what the survey files actually say --------------------------------------------
print("\n=== 2. DEPLOYED options vs re-derived answers ===")
def num(text):
    m = re.search(r"[-+]?[0-9][0-9,]*\.?[0-9]*", text)
    return float(m.group(0).replace(",", "")) if m else None

deployed = {}
for arm in ARMS:
    s = open(os.path.join(ROOT, arm, "survey.html"), encoding="utf-8").read()
    deployed[arm] = {}
    for iid in OPS:
        m = re.search(r'RADIO\(\s*"%s"\s*,(.*?)\]\s*,\s*(\d+)\s*\)' % iid, s, re.S)
        if not m:
            check(False, "%s/%s: item not found" % (arm, iid)); continue
        opts = re.findall(r'"((?:[^"\\]|\\.)*)"', m.group(1))[1:]  # drop the stem
        k = int(m.group(2))
        deployed[arm][iid] = (opts, k)
        got, want = num(opts[k]), derived[arm][iid]
        ok = got is not None and abs(got - want) <= (1.0 if iid == "C_ratio" else 0.5)
        check(ok, "%-8s %-8s key='%s'  re-derived=%.4g" % (arm, iid, opts[k], want))

# ---- 4. cross-arm properties -----------------------------------------------------------
print("\n=== 3. KEYS DISTINCT across the three diseases (no transfer between trials) ===")
for iid in OPS:
    vals = [num(deployed[a][iid][0][deployed[a][iid][1]]) for a in ARMS]
    check(len(set(vals)) == 3, "%-8s %s" % (iid, vals))

print("\n=== 4. NO DISTRACTOR equals another disease's key for the same item ===")
for iid in OPS:
    keys = {a: num(deployed[a][iid][0][deployed[a][iid][1]]) for a in ARMS}
    for a in ARMS:
        opts, k = deployed[a][iid]
        others = {keys[b] for b in ARMS if b != a}
        bad = [o for i, o in enumerate(opts) if i != k and num(o) is not None and num(o) in others]
        check(not bad, "%-8s %-8s %s" % (a, iid, "clean" if not bad else "LEAKS " + str(bad)))

print("\n=== 5. KEY POSITION differs across the three diseases ===")
for iid in OPS:
    pos = [deployed[a][iid][1] for a in ARMS]
    check(len(set(pos)) == 3, "%-8s positions %s" % (iid, pos))

print("\n=== 6. SCORED SET is the six risk-display items, in all three arms ===")
for arm in ARMS:
    s = open(os.path.join(ROOT, arm, "survey.html"), encoding="utf-8").read()
    m = re.search(r'RISK_IDS\s*=\s*\[([^\]]*)\]', s)
    got = [x.strip().strip('"') for x in m.group(1).split(",")]
    check(sorted(got) == sorted(OPS), "%-8s %s" % (arm, got))
    check("Q_whichfig" not in s, "%-8s Q_whichfig removed" % arm)

print("\n" + ("### RE-DERIVATION FAILED: %d\n" % len(fail) + "\n".join(fail)
              if fail else "### RE-DERIVATION CLEAN"))
sys.exit(1 if fail else 0)
