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
2. Full Name
3. Mobile Number
4. IC Number
5. Who Are You
6. Agent Name
7. Agent ID
8. GM Name
9. Current Insurance Company
10. Age Band
11. Marital Status
12. Employment Type
13. Monthly Income
14. Existing Insurance Plan
15. Financial Priorities in the next 12 months

The current survey does not collect agent/GM details, so Apps Script writes blank values for those columns. The browser collects the full IC for the participant's convenience, but sends only its last four digits to the `IC Number` column.

Apps Script verifies row 1 without modifying it, escapes formula-like text, and uses a script-wide lock around each append.

## Google Apps Script deployment

1. Open **Extensions > Apps Script** from the target spreadsheet.
2. Replace the script contents with `google-apps-script/Code.gs`.
3. Select **Deploy > New deployment > Web app**.
4. Run as the deploying account and grant the intended access for roadshow submissions.
5. Copy the `/exec` Web App URL into Cloudflare's `GOOGLE_SHEETS_WEBHOOK_URL` secret.

Every Apps Script code change requires a **new Web App deployment version** (or editing the deployment to use a new version). Saving the script alone does not update the live Web App. After the Web App URL or Cloudflare secret changes, redeploy Pages.

## Submission contract

The Pages Function accepts only `POST` with `application/json`, limits request size, trims text, validates dates, phone numbers, IC last-four digits, allowlisted choices, required checkbox groups, conditional employment detail, participant type, and consent.

It forwards only these keys to Apps Script, in this order:

```json
{
  "date": "",
  "fullName": "",
  "mobileNumber": "",
  "icNum": "",
  "whoAreYou": "",
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

Checkbox arrays are converted to comma-separated strings. Consent and conditional helper fields are validated but not forwarded. The participant type is forwarded as `whoAreYou`.

The frontend does not set a short request timeout or automatically retry. It disables submission immediately and also uses an in-flight guard against duplicate clicks. Values are cleared only after confirmed success and retained after failure.

For substantially higher volume or strong retry deduplication guarantees, put a durable queue/database in front of Sheets and add an idempotency key stored and checked server-side. Apps Script locking protects a few concurrent writes, but Sheets remains the main bottleneck.
