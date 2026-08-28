# Google Sheet backup

With this connected, every weekly report submitted on the site is appended to a Google
Sheet within seconds, and the dashboard's **Export Data** page gets a **Send Full Backup to
Google Sheet** button that pushes the complete history.

## 1. Create the sheet and script

1. Create a new Google Sheet (e.g. **VRG Tracker Backup**) in the group's Google account.
2. In the sheet: **Extensions → Apps Script**. Delete any starter code and paste:

```javascript
const SHEET_NAME = "Submissions";
const HEADERS = [
  "Submitted At", "Meeting Date", "Member", "Attended", "Absence Reason", "Visitors",
  "Referrals", "Referrals Detail", "One-to-Ones", "One-to-Ones Detail",
  "Money Total", "Money Detail",
];

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const rows = body.rows || [];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) sh.appendRow(HEADERS);
  if (rows.length) {
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEADERS.length)
      .setValues(rows.map((r) => HEADERS.map((_, i) => r[i] ?? "")));
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. Save (name it anything, e.g. "VRGTrack Backup").

## 2. Deploy the script as a web app

1. Click **Deploy → New deployment**.
2. Gear icon next to "Select type" → **Web app**.
3. Set **Execute as: Me**, and **Who has access: Anyone**. ("Anyone" here only means the
   URL accepts requests — the URL is long, random, and stored as a secret. Anyone who had
   it could at most append rows to this one sheet.)
4. Click **Deploy**, authorize when Google asks, and copy the **Web app URL**
   (it ends in `/exec`).

## 3. Give the URL to the site

1. Cloudflare dashboard → **Workers & Pages** → the Pages project → **Settings** →
   **Variables and Secrets** → **Add**.
2. Type **Secret**, name `SHEETS_WEBHOOK_URL`, value = the web app URL.
3. **Deployments** tab → latest deployment → **⋯ → Retry deployment**.

## 4. First backup

Sign into the dashboard → **Export Data** → **Send Full Backup to Google Sheet**. The
complete submission history lands in the "Submissions" tab. From then on every new report
appends automatically.

Notes:
- Re-running the full backup appends the history again (it doesn't dedupe). For a clean
  refresh, clear the "Submissions" tab first, or just rely on the automatic per-submission
  rows.
- If you ever update the Apps Script code, use **Deploy → Manage deployments → Edit →
  New version** — creating a brand-new deployment changes the URL and needs the secret
  updated to match.
