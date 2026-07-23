const MAX_BODY_BYTES = 16_384;

const ALLOWED = Object.freeze({
  ageBand: ["<25", "25-34", "35-44", "45-54", "55-64", "65+"],
  maritalStatus: [
    "Single",
    "Married",
    "Married with children",
    "Divorced / widowed",
  ],
  employmentType: [
    "Salaried",
    "Self-employed",
    "Business owner",
    "Homemaker",
    "Retired",
    "Student",
    "Others",
  ],
  monthlyPersonalIncome: ["<RM3k", "RM3-6k", "RM6-10k", "RM10-20k", ">RM20k"],
  existingInsurancePlans: [
    "Medical Card",
    "Life / Term",
    "Critical Illness",
    "Savings",
    "Legacy",
    "Not sure",
    "I don’t have one",
  ],
  financialPriorities: [
    "Plan for kids’ education",
    "Build emergency fund",
    "Retirement savings",
    "Increase my savings",
    "Venture into investment",
    "Manage my debts better",
    "Reduce medical expenses risk",
    "Protect income if I cannot work",
    "Plan for legacy / estate planning",
    "Review and optimize current policies",
    "Accident and disability coverage",
    "Critical illness planning",
  ],
  isGreatEasternStaff: ["Yes", "No"],
});

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

const cleanText = (value, field, { required = false, max = 100 } = {}) => {
  if (typeof value !== "string") {
    if (!required && (value === undefined || value === null)) return "";
    throw new Error(`${field} must be text.`);
  }
  const cleaned = value.trim();
  if (required && !cleaned) throw new Error(`${field} is required.`);
  if (cleaned.length > max) throw new Error(`${field} is too long.`);
  return cleaned;
};

const allowedValue = (value, field) => {
  const cleaned = cleanText(value, field, { required: true, max: 80 });
  if (!ALLOWED[field].includes(cleaned)) throw new Error(`${field} is invalid.`);
  return cleaned;
};

const allowedArray = (value, field) => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${field} must contain at least one selection.`);
  }
  if (
    value.length > ALLOWED[field].length ||
    value.some((item) => typeof item !== "string" || !ALLOWED[field].includes(item)) ||
    new Set(value).size !== value.length
  ) {
    throw new Error(`${field} contains an invalid selection.`);
  }
  return value;
};

const validDate = (value) => {
  const cleaned = cleanText(value, "date", { required: true, max: 10 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) throw new Error("date is invalid.");
  const [year, month, day] = cleaned.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("date is invalid.");
  }
  return cleaned;
};

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "POST") {
    return json({ success: false, error: "Method not allowed." }, 405);
  }

  const contentType = request.headers.get("content-type") || "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    return json({ success: false, error: "Content-Type must be application/json." }, 415);
  }

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return json({ success: false, error: "Request body is too large." }, 413);
  }

  let data;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
      return json({ success: false, error: "Request body is too large." }, 413);
    }
    data = JSON.parse(body);
    if (!data || Array.isArray(data) || typeof data !== "object") {
      throw new Error("Request body must be a JSON object.");
    }
  } catch (error) {
    return json({ success: false, error: error.message || "Invalid JSON." }, 400);
  }

  try {
    const date = validDate(data.date);
    const fullName = cleanText(data.fullName, "fullName", { required: true, max: 100 });
    const mobileNumber = cleanText(data.mobileNumber, "mobileNumber", {
      required: true,
      max: 25,
    });
    if (!/^[+\d()\s-]+$/.test(mobileNumber)) {
      throw new Error("mobileNumber contains invalid characters.");
    }
    const mobileDigits = mobileNumber.replace(/\D/g, "");
    if (mobileDigits.length < 8 || mobileDigits.length > 15) {
      throw new Error("mobileNumber must contain 8 to 15 digits.");
    }

    const icNum = cleanText(data.icNum, "icNum", { required: true, max: 4 });
    if (!/^\d{4}$/.test(icNum)) throw new Error("icNum must contain exactly four digits.");

    const agentName = cleanText(data.agentName, "agentName", { max: 100 });
    const agentId = cleanText(data.agentId, "agentId", { max: 50 });
    const gmName = cleanText(data.gmName, "gmName", { max: 100 });
    const currentInsuranceCompany = cleanText(
      data.currentInsuranceCompany,
      "currentInsuranceCompany",
      { max: 100 },
    );
    const ageBand = allowedValue(data.ageBand, "ageBand");
    const maritalStatus = allowedValue(data.maritalStatus, "maritalStatus");
    const employmentTypeChoice = allowedValue(data.employmentType, "employmentType");
    const employmentOther = cleanText(data.employmentOther, "employmentOther", { max: 80 });
    if (employmentTypeChoice === "Others" && !employmentOther) {
      throw new Error("employmentOther is required when employmentType is Others.");
    }
    if (employmentTypeChoice !== "Others" && employmentOther) {
      throw new Error("employmentOther is only valid when employmentType is Others.");
    }
    const employmentType =
      employmentTypeChoice === "Others" ? `Others: ${employmentOther}` : employmentTypeChoice;
    const monthlyPersonalIncome = allowedValue(
      data.monthlyPersonalIncome,
      "monthlyPersonalIncome",
    );
    const existingInsurancePlans = allowedArray(
      data.existingInsurancePlans,
      "existingInsurancePlans",
    );
    const financialPriorities = allowedArray(
      data.financialPriorities,
      "financialPriorities",
    );
    const geStaff = allowedValue(data.isGreatEasternStaff, "isGreatEasternStaff");
    if (data.consent !== true) throw new Error("consent must be true.");

    if (!env?.GOOGLE_SHEETS_WEBHOOK_URL) {
      console.error("GOOGLE_SHEETS_WEBHOOK_URL is not configured.");
      return json({ success: false, error: "Submission service is not configured." }, 500);
    }

    // Property insertion order is deliberate and covered by tests.
    const sheetPayload = {
      date,
      fullName,
      mobileNumber,
      icNum,
      geStaff,
      agentName,
      agentId,
      gmName,
      currentInsuranceCompany,
      ageBand,
      maritalStatus,
      employmentType,
      monthlyPersonalIncome,
      existingInsurancePlans: existingInsurancePlans.join(", "),
      financialPriorities: financialPriorities.join(", "),
    };

    let upstream;
    try {
      upstream = await fetch(env.GOOGLE_SHEETS_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sheetPayload),
      });
    } catch (error) {
      console.error("Google Apps Script request failed:", error);
      return json({ success: false, error: "Unable to save the survey right now." }, 502);
    }

    const responseText = await upstream.text();
    let upstreamResult;
    try {
      upstreamResult = JSON.parse(responseText);
    } catch {
      upstreamResult = null;
    }

    if (!upstream.ok || upstreamResult?.success !== true) {
      console.error("Google Apps Script rejected submission:", {
        status: upstream.status,
        response: responseText.slice(0, 500),
      });
      return json(
        {
          success: false,
          error: upstreamResult?.error || "Unable to save the survey right now.",
        },
        502,
      );
    }

    return json({ success: true });
  } catch (error) {
    return json({ success: false, error: error.message || "Invalid submission." }, 400);
  }
}
