# Survey site — setup (free, ~10 minutes)

The survey (`survey.html`) randomly assigns each participant to one of the 22 interface
versions, embeds that version, asks the questions, and saves one row per participant to a
**Google Sheet** via a Google Apps Script Web App.

## 1. Create the Google Sheet + script
1. Go to <https://sheets.new> and name it e.g. **Measles study responses**.
2. **Extensions → Apps Script**. Delete the default code.
3. Paste the contents of **`survey_apps_script.gs`** and click **Save**.

## 2. Deploy the script as a Web App
1. In Apps Script: **Deploy → New deployment**.
2. Gear icon → type **Web app**.
3. Set **Execute as: Me**, **Who has access: Anyone**.
4. **Deploy**, authorise when prompted, and **copy the Web app URL**
   (looks like `https://script.google.com/macros/s/AKfy…/exec`).

## 3. Point the survey at your sheet
Open **`survey.html`** and replace the placeholder near the top:
```js
const ENDPOINT = "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";
```
with the URL you copied. Save.

## 4. Publish
Push `survey.html` with the rest of the `frontend/` folder. Participants go to:
```
https://ani7700.github.io/Pandemic-Outbreak-Simulator/survey.html
```
Each visit is randomly assigned a version and embeds `./1/` … `./22/`.

## Handy URL parameters
- `?v=7` — force a specific version (for piloting / screenshots).
- `?PROLIFIC_PID=xxxx` or `?pid=xxxx` — record a recruitment-platform ID (Prolific passes `PROLIFIC_PID` automatically).

## What each row records
`participantId, version, assignedUrl, timestamp, seconds_total, seconds_on_tool,
C1…C7` (raw answer + `C1_correct…C7_correct`), `comprehension_score`, `comprehension_max`,
`U1, U2, E1…E5, RP1, IN1, IN2, BG_*`, `user_agent`.
Answers are stored as option indices (0-based) for multiple choice and 1–5 for scales.

## Before going live
- Replace the **consent / participant-information** box in `survey.html` with your
  ethics-approved wording and data-handling statement.
- Confirm the **fixed area** in the task instruction (currently postcode `CB3 9DF` →
  Cambridgeshire, ~90.8% coverage). The comprehension answer key (e.g. C6 = “Below”,
  C7 = “Low”) assumes that area; update the keys in `survey.html` if you change it.
- Pilot with `?v=1` … `?v=22` and check a row lands in the sheet each time.

## Note on the sample
22 arms is a lot for a between-subjects design — expect to need ~30–50 completes per
version. If recruitment is limited, consider fewer arms or grouping versions into
families (number / graphic / interactive / combined) for the main analysis.
