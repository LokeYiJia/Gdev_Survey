var SHEET_NAME = "GDev Leads Gathering";
var EXPECTED_HEADERS = [
  "Date",
  "Full Name",
  "Mobile Number",
  "IC Number",
  "Who Are You",
  "Agent Name",
  "Agent ID",
  "GM Name",
  "Current Insurance Company",
  "Existing Insurance Plan",
  "Financial Priorities in the next 12 months"
];

function jsonResponse_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function safeCell_(value) {
  var text = value === null || value === undefined ? "" : String(value);
  // Prefix formula-like values with an apostrophe so Sheets stores plain text.
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function forcedTextCell_(value) {
  var text = value === null || value === undefined ? "" : String(value);
  // A leading apostrophe tells Sheets to preserve the value as text. The
  // apostrophe is not displayed in the cell.
  return text === "" ? "" : "'" + text;
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("Missing request body.");
    }

    var data = JSON.parse(e.postData.contents);
    lock.waitLock(30000);

    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    spreadsheet.setSpreadsheetTimeZone("Asia/Kuala_Lumpur");
    var sheet = spreadsheet.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error("Sheet tab not found: " + SHEET_NAME);

    var actualHeaders = sheet
      .getRange(1, 1, 1, EXPECTED_HEADERS.length)
      .getDisplayValues()[0];
    for (var i = 0; i < EXPECTED_HEADERS.length; i++) {
      if (actualHeaders[i] !== EXPECTED_HEADERS[i]) {
        throw new Error(
          "Header mismatch in column " + (i + 1) +
          '. Expected "' + EXPECTED_HEADERS[i] +
          '", found "' + actualHeaders[i] + '".'
        );
      }
    }

    // Google Sheets tables may copy "Automatic" formatting into new rows.
    // Enforce plain text for all Mobile Number and IC Number data cells before
    // writing so leading zeroes cannot be interpreted as numeric formatting.
    var existingDataRowCount = sheet.getMaxRows() - 1;
    if (existingDataRowCount > 0) {
      sheet.getRange(2, 3, existingDataRowCount, 1).setNumberFormat("@");
      sheet.getRange(2, 4, existingDataRowCount, 1).setNumberFormat("@");
    }

    var row = [
      safeCell_(data.date),
      safeCell_(data.fullName),
      forcedTextCell_(data.mobileNumber),
      forcedTextCell_(data.icNum),
      safeCell_(data.whoAreYou),
      safeCell_(data.agentName),
      safeCell_(data.agentId),
      safeCell_(data.gmName),
      safeCell_(data.currentInsuranceCompany),
      safeCell_(data.existingInsurancePlans),
      safeCell_(data.financialPriorities)
    ];

    var targetRow = sheet.getLastRow() + 1;
    // Keep Mobile Number and IC Number as text so leading zeroes are not removed.
    sheet.getRange(targetRow, 3).setNumberFormat("@");
    sheet.getRange(targetRow, 4).setNumberFormat("@");
    sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
    // Reapply after writing in case a Sheets table copied its column format.
    sheet.getRange(targetRow, 3).setNumberFormat("@");
    sheet.getRange(targetRow, 4).setNumberFormat("@");
    SpreadsheetApp.flush();
    return jsonResponse_({ success: true });
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return jsonResponse_({
      success: false,
      error: error && error.message ? error.message : "Unable to append survey."
    });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}
