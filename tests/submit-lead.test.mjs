import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { onRequest } from "../functions/api/submit-lead.js";

const validPayload = () => ({
  date: "2026-07-23",
  fullName: "  Alex Tan  ",
  mobileNumber: "+60 12-345 6789",
  icNum: "1234",
  agentName: "",
  agentId: "",
  gmName: "",
  currentInsuranceCompany: " Prudential ",
  ageBand: "25-34",
  maritalStatus: "Single",
  employmentType: "Salaried",
  employmentOther: "",
  monthlyPersonalIncome: "RM3-6k",
  existingInsurancePlans: ["Medical Card", "Savings"],
  financialPriorities: ["Build emergency fund"],
  participantType: "GDG KL Participant",
  consent: true,
});

const call = (payload = validPayload(), options = {}) =>
  onRequest({
    request: new Request("https://survey.example/api/submit-lead", {
      method: options.method || "POST",
      headers: { "Content-Type": options.contentType || "application/json" },
      body:
        (options.method || "POST") === "GET"
          ? undefined
          : options.rawBody ?? JSON.stringify(payload),
    }),
    env: {
      GOOGLE_SHEETS_WEBHOOK_URL: "https://script.google.test/web-app",
      ...options.env,
    },
  });

test("rejects non-POST methods", async () => {
  const response = await call(undefined, { method: "GET" });
  assert.equal(response.status, 405);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Method not allowed.",
  });
});

test("rejects invalid content types", async () => {
  const response = await call(validPayload(), { contentType: "text/plain" });
  assert.equal(response.status, 415);
});

test("rejects oversized bodies", async () => {
  const response = await call(undefined, {
    rawBody: JSON.stringify({ padding: "x".repeat(17_000) }),
  });
  assert.equal(response.status, 413);
});

test("rejects invalid dropdown values before calling Apps Script", async (t) => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response('{"success":true}');
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const payload = validPayload();
  payload.ageBand = "18-99";
  const response = await call(payload);
  assert.equal(response.status, 400);
  assert.equal(called, false);
});

test("requires consent and non-empty checkbox arrays", async () => {
  const payload = validPayload();
  payload.consent = false;
  payload.existingInsurancePlans = [];
  const response = await call(payload);
  assert.equal(response.status, 400);
  const result = await response.json();
  assert.match(result.error, /at least one selection/i);
});

test("forwards only expected trimmed Sheet fields in exact key order", async (t) => {
  const originalFetch = globalThis.fetch;
  let forwarded;
  globalThis.fetch = async (_url, init) => {
    forwarded = JSON.parse(init.body);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const response = await call();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  assert.deepEqual(Object.keys(forwarded), [
    "date",
    "fullName",
    "mobileNumber",
    "icNum",
    "whoAreYou",
    "agentName",
    "agentId",
    "gmName",
    "currentInsuranceCompany",
    "ageBand",
    "maritalStatus",
    "employmentType",
    "monthlyPersonalIncome",
    "existingInsurancePlans",
    "financialPriorities",
  ]);
  assert.equal(forwarded.fullName, "Alex Tan");
  assert.equal(forwarded.currentInsuranceCompany, "Prudential");
  assert.equal(forwarded.existingInsurancePlans, "Medical Card, Savings");
  assert.equal(forwarded.whoAreYou, "GDG KL Participant");
  assert.equal("consent" in forwarded, false);
  assert.equal("participantType" in forwarded, false);
  assert.equal("employmentOther" in forwarded, false);
});

test("formats an Others employment value only after validating its detail", async (t) => {
  const originalFetch = globalThis.fetch;
  let forwarded;
  globalThis.fetch = async (_url, init) => {
    forwarded = JSON.parse(init.body);
    return new Response('{"success":true}');
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  const payload = validPayload();
  payload.employmentType = "Others";
  payload.employmentOther = "Freelancer";
  const response = await call(payload);
  assert.equal(response.status, 200);
  assert.equal(forwarded.employmentType, "Others: Freelancer");
});

test("propagates Google Apps Script JSON failures without exposing its URL", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  console.error = () => {};
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ success: false, error: "Header mismatch." }), {
      status: 200,
    });
  t.after(() => {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  });

  const response = await call();
  assert.equal(response.status, 502);
  const result = await response.json();
  assert.deepEqual(result, { success: false, error: "Header mismatch." });
  assert.equal(JSON.stringify(result).includes("script.google.test"), false);
});

test("frontend submits only to /api/submit-lead and contains no webhook secret", async () => {
  const sourceFiles = (await readdir("src")).filter((name) => /\.(jsx?|css)$/.test(name));
  const source = (
    await Promise.all(sourceFiles.map((name) => readFile(join("src", name), "utf8")))
  ).join("\n");
  const fetchTargets = [...source.matchAll(/fetch\(\s*["'`]([^"'`]+)["'`]/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(fetchTargets, ["/api/submit-lead"]);
  assert.equal(source.includes("GOOGLE_SHEETS_WEBHOOK_URL"), false);
  assert.equal(/script\.google(?:usercontent)?\.com/i.test(source), false);
});
