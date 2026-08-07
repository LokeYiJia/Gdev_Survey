var SHEET_NAME = "GDev Leads Gathering";
var SCRIPT_BUILD = "2026-08-07-ge-schema-two-stage-v1";
var EXPECTED_HEADERS = [
  "Date", "Roadshow Location", "Roadshow State", "Full Name", "Mobile Number",
  "IC Num (last 4 digits)", "Agent Name", "Agent ID", "GM Name",
  "Current Insurance Company", "Age Band", "Marital Status", "Employment Type",
  "Monthly Income", "Existing Insurance Plan",
  "Financial Priorities in the next 12 months", "Presentation done",
  "Potential follow up", "On the spot close case", "ANP",
  "Submission Timestamp", "Submission ID"
];
var BASE_COLUMN_KEYS = [
  "date", "roadshowLocation", "roadshowState", "fullName", "mobileNumber",
  "icLast4", "agentName", "agentId", "gmName", "currentInsuranceCompany",
  "ageBand", "maritalStatus", "employmentType", "monthlyPersonalIncome",
  "existingInsurancePlans", "financialPriorities"
];
var OUTCOME_COLUMN_KEYS = [
  "presentationDone", "potentialFollowUp", "onTheSpotCloseCase", "anp"
];

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    if (!e || !e.postData || !e.postData.contents) throw new Error("Missing request body");
    var data = JSON.parse(e.postData.contents);
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid payload");

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error("Sheet tab not found: " + SHEET_NAME);
    verifyHeaders_(sheet);

    lock.waitLock(30000);
    if (data.action === "create") return createSubmission_(sheet, data);
    if (data.action === "complete") return completeSubmission_(sheet, data);
    throw new Error("Invalid submission action");
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return jsonResponse_({
      success: false,
      error: "[" + SCRIPT_BUILD + "] " + (error && error.message ? error.message : "Unable to process survey")
    });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function createSubmission_(sheet, data) {
  var baseRow = BASE_COLUMN_KEYS.map(function (key) {
    if (key === "mobileNumber" || key === "icLast4") return forcedTextCell_(data[key]);
    return safeCell_(data[key]);
  });
  var emptyOutcomes = OUTCOME_COLUMN_KEYS.map(function () { return ""; });
  var timestamp = new Date();
  var submissionId = Utilities.getUuid();
  var row = baseRow.concat(emptyOutcomes, [timestamp, submissionId]);
  var targetRow = sheet.getLastRow() + 1;

  sheet.getRange(targetRow, 5).setNumberFormat("@");
  sheet.getRange(targetRow, 6).setNumberFormat("@");
  sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
  sheet.getRange(targetRow, 21).setNumberFormat("yyyy-mm-dd hh:mm:ss");
  SpreadsheetApp.flush();
  return jsonResponse_({ success: true, submissionId: submissionId });
}

function completeSubmission_(sheet, data) {
  var submissionId = data.submissionId == null ? "" : String(data.submissionId).trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(submissionId)) {
    throw new Error("Invalid submission ID");
  }
  validateOutcomes_(data);
  var rowCount = sheet.getLastRow() - 1;
  if (rowCount < 1) throw new Error("Submission not found");
  var idCell = sheet.getRange(2, 22, rowCount, 1)
    .createTextFinder(submissionId).matchEntireCell(true).findNext();
  if (!idCell) throw new Error("Submission not found");
  var outcomes = OUTCOME_COLUMN_KEYS.map(function (key) { return safeCell_(data[key]); });
  sheet.getRange(idCell.getRow(), 17, 1, outcomes.length).setValues([outcomes]);
  SpreadsheetApp.flush();
  return jsonResponse_({ success: true });
}

function validateOutcomes_(data) {
  ["presentationDone", "potentialFollowUp", "onTheSpotCloseCase"].forEach(function (key) {
    if (data[key] !== "Yes" && data[key] !== "No") throw new Error(key + " must be Yes or No");
  });
  var anp = data.anp == null ? "" : String(data.anp).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(anp)) {
    throw new Error("ANP must be a number with no more than two decimal places");
  }
}

function verifyHeaders_(sheet) {
  var headers = sheet.getRange(1, 1, 1, EXPECTED_HEADERS.length).getDisplayValues()[0];
  var mismatches = [];
  EXPECTED_HEADERS.forEach(function (expected, index) {
    if (headers[index] !== expected) {
      mismatches.push("Column " + (index + 1) + ': expected "' + expected + '", found "' + (headers[index] || "(blank)") + '"');
    }
  });
  if (mismatches.length) throw new Error("Sheet header mismatch. " + mismatches.join("; "));
}

function safeCell_(value) {
  var text = value === null || value === undefined ? "" : String(value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function forcedTextCell_(value) {
  var text = value === null || value === undefined ? "" : String(value);
  return text === "" ? "" : "'" + text;
}

function jsonResponse_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
