# GDev Survey

A mobile-friendly roadshow lead survey built with React and Vite. Submissions follow this path:

```text
React form
  -> POST /api/submit-lead
  -> Cloudflare Pages Function
  -> Google Apps Script Web App
  -> "GDev Leads Gathering" Google Sheet tab
```

The browser never receives or calls the Apps Script URL. There is no login or form access code.

Roadshow Location is restricted to Gleneagles, Mahkota Medical Center, KPJ Specialist Hospital, Sunway Medical Center, and Hospital Seri Botani.

## Local development

Requirements: Node.js 18 or newer.

```sh
npm install
npm run dev
npm test
npm run build
```

Vite alone serves the frontend locally; the Pages Function is exercised by the automated tests. For full local integration, run the project with Wrangler Pages and provide the secret as a local environment binding. Never use a `VITE_` prefix for the webhook.

## Cloudflare Pages deployment

1. Create a Pages project from this repository.
2. Use `npm run build` as the build command and `dist` as the output directory.
3. In **Settings > Environment variables**, add the encrypted variable:

   ```text
   GOOGLE_SHEETS_WEBHOOK_URL=<deployed Apps Script Web App URL>
   ```

4. Deploy/redeploy the Pages project. Changes to the frontend or `functions/` only become live after a Cloudflare Pages redeployment.

Do not commit a real webhook URL. `.env.example` intentionally contains only an empty placeholder.

## Google Sheet setup

Create or use a sheet tab named exactly `GDev Leads Gathering`. Row 1 must have these exact headers, in this order:

1. Date
2. Roadshow Location
3. Roadshow State
4. Full Name
5. Mobile Number
6. IC Num (last 4 digits)
7. Agent Name
8. Agent ID
9. GM Name
10. Current Insurance Company
11. Age Band
12. Marital Status
13. Employment Type
14. Monthly Income
15. Existing Insurance Plan
16. Financial Priorities in the next 12 months
17. Presentation done
18. Potential follow up
19. On the spot close case
20. ANP
21. Submission Timestamp
22. Submission ID

Apps Script verifies row 1 without modifying it and uses a script-wide lock. The first submit appends the 16 lead fields, four blank outcome cells, a timestamp, and a UUID. The popup submit finds that UUID and updates only the four outcome cells in the same row. `Submission ID` can be hidden in Google Sheets but must not be deleted.

## Google Apps Script deployment

1. Open **Extensions > Apps Script** from the target spreadsheet.
2. Replace the script contents with `google-apps-script/Code.gs`.
3. Select **Deploy > New deployment > Web app**.
4. Run as the deploying account and grant the intended access for roadshow submissions.
5. Copy the `/exec` Web App URL into Cloudflare's `GOOGLE_SHEETS_WEBHOOK_URL` secret.

Every Apps Script code change requires a **new Web App deployment version** (or editing the deployment to use a new version). Saving the script alone does not update the live Web App. After the Web App URL or Cloudflare secret changes, redeploy Pages.

## Submission contract

The Pages Function accepts only `POST` with `application/json`, limits request size, trims text, and validates the GE question set, required checkbox groups, consent, the three Yes/No popup fields, and numeric ANP.

It forwards only these keys to Apps Script, in this order:

```json
{
  "action": "create",
  "date": "",
  "roadshowLocation": "",
  "roadshowState": "",
  "fullName": "",
  "mobileNumber": "",
  "icLast4": "",
  "agentName": "",
  "agentId": "",
  "gmName": "",
  "currentInsuranceCompany": "",
  "ageBand": "",
  "maritalStatus": "",
  "employmentType": "",
  "monthlyPersonalIncome": "",
  "existingInsurancePlans": "",
  "financialPriorities": ""
}
```

The popup sends a second request with `action: "complete"`, the UUID, the three Yes/No answers, and ANP. Checkbox arrays are converted to comma-separated strings and consent is validated but not forwarded.

The frontend does not set a short request timeout or automatically retry. It disables submission immediately and also uses an in-flight guard against duplicate clicks. Values are cleared only after confirmed success and retained after failure.

For substantially higher volume or strong retry deduplication guarantees, put a durable queue/database in front of Sheets and add an idempotency key stored and checked server-side. Apps Script locking protects a few concurrent writes, but Sheets remains the main bottleneck.
