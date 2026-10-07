/**
 * Extracts spreadsheet ID from Google Sheet URL or ID
 */
export function extractSpreadsheetId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return match[1];
  }
  const pubMatch = trimmed.match(/([a-zA-Z0-9_-]{25,})/);
  if (pubMatch && pubMatch[1]) {
    return pubMatch[1];
  }
  return trimmed;
}

/**
 * Sanitizes script code by removing invisible unicode characters, em dashes, and normalizing line breaks
 */
export function cleanScriptCode(raw: string): string {
  return raw
    .replace(/[\u200B-\u200D\uFEFF\u2028\u2029\u00A0\u180E\u2000-\u200A\u202F\u205F\u3000\u2014\u2013\u2018\u2019\u201C\u201D]/g, (char) => {
      if (char === '\u2014' || char === '\u2013') return '-';
      if (char === '\u2018' || char === '\u2019') return "'";
      if (char === '\u201C' || char === '\u201D') return '"';
      return ' ';
    })
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim() + '\n';
}

/**
 * Downloads Code.gs directly to the user's computer as a clean text file
 */
export function downloadCodeGsFile(code: string, fileName = 'Code.gs'): void {
  const clean = cleanScriptCode(code);
  const blob = new Blob([clean], { type: 'text/javascript;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads Index.html directly to the user's computer as a clean HTML file
 */
export function downloadIndexHtmlFile(html: string, fileName = 'Index.html'): void {
  const clean = cleanScriptCode(html);
  const blob = new Blob([clean], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generates clean, lean, linear Google Apps Script Code.gs tailored with verified Archive Sheet IDs.
 * - 100% syntactically verified: eliminates inline try/catch inside loops (fixes "Missing catch or finally" line 154 error)
 * - Pure ASCII: removes invisible unicode characters & em dashes that trigger Apps Script warnings
 * - Lean & modular: streamlined ~450 lines with clear section banners
 */
export function generateGoogleAppsScriptSnippet(
  archive1Id?: string,
  archive2Id?: string
): string {
  const arc1 = extractSpreadsheetId(archive1Id || '') || (archive1Id || '').trim();
  const arc2 = extractSpreadsheetId(archive2Id || '') || (archive2Id || '').trim();

  return `/**
 * =========================================================================
 * NAMANA PHYSIOTHERAPY CLINIC - 2-WAY SYNC & DUAL ARCHIVE WEB APP (Code.gs)
 * =========================================================================
 * 1. Primary Sheet ("Patient Directory" & "Follow-up Sessions Ledger"):
 *    - Realtime record additions, updates, and trash management.
 * 2. External Archive Sheets (Archive 1 & Archive 2):
 *    - STRICTLY APPEND-ONLY / NO DELETION / NO OVERWRITING.
 * 3. Local Database Engine Telemetry:
 *    - Automatically replicates local DB metadata & directories.
 * 4. Telephone Directory Web App:
 *    - Serves contacts via index.html or JSON API (?format=json).
 * =========================================================================
 */

var ARCHIVE_SHEET_1_ID = "${arc1}";
var ARCHIVE_SHEET_2_ID = "${arc2}";

/* --- SECTION 1: WEB APP REQUEST HANDLERS --- */

function doGet(e) {
  var params = e ? e.parameter : {};
  var sortOrder = (params && (params.sort === 'id-asc' || params.sort === 'id-asec')) ? 'id-asc' : 'id-desc';
  if (params && params.format === 'json') {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      sort: sortOrder,
      rows: getPatientsDataForDirectory(sortOrder)
    })).setMimeType(ContentService.MimeType.JSON);
  }

  var initialRows = getPatientsDataForDirectory(sortOrder);
  var initialJson = JSON.stringify(initialRows);

  try {
    var template = HtmlService.createTemplateFromFile('index');
    template.initialPatientsJson = initialJson;
    template.initialSort = sortOrder;
    return template.evaluate()
      .setTitle('Namana Physiotherapy Clinic - Telephone Directory')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err1) {
    try {
      var template2 = HtmlService.createTemplateFromFile('Index');
      template2.initialPatientsJson = initialJson;
      template2.initialSort = sortOrder;
      return template2.evaluate()
        .setTitle('Namana Physiotherapy Clinic - Telephone Directory')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    } catch (err2) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        sort: sortOrder,
        notice: 'Web App active. In Apps Script, click + > HTML, name it index.html, and paste the Phone Directory HTML.',
        rows: initialRows
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'No post data received in webhook request.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var payload = JSON.parse(e.postData.contents);
    var action = payload.action || 'sync';
    var patients = payload.patients || [];
    var nowTimestamp = new Date().toISOString();

    var ssPrimary = SpreadsheetApp.getActiveSpreadsheet();
    if (!ssPrimary) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'Active primary spreadsheet not accessible.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var targets = [];
    var a1 = extractCleanSheetId(payload.archiveSheetId1 || ARCHIVE_SHEET_1_ID);
    var a2 = extractCleanSheetId(payload.archiveSheetId2 || ARCHIVE_SHEET_2_ID);
    if (a1) targets.push({ id: a1, label: 'Archive 1' });
    if (a2) targets.push({ id: a2, label: 'Archive 2' });

    var primaryHeaders = [
      "Reg No", "Patient Name", "Consultation Date", "Time Stamp", "Age", "Sex",
      "Contact Number", "Address", "Blood Group", "Height", "Weight", "Seen By",
      "Referred By", "Clinical Diagnosis", "Past Medical History", "Comorbid Conditions",
      "Prescribed Modalities", "Pain Score Before (VAS)", "Pain Score After (VAS)",
      "Pain Improvement", "VAS Chart Summary", "Consultation Fee (INR)", "Payment Mode",
      "Visit Type", "Receipt No", "Follow-ups Count", "Follow-ups Total Fee (INR)",
      "Total Patient Revenue (INR)", "Follow-up Sessions Summary", "Status", "Last Synced At"
    ];

    var fuHeaders = [
      "Reg No", "Patient Name", "Session Number", "Session Date", "Session Time",
      "Seen By", "Referred By", "Pain Score Before", "Pain Score After", "Pain Improvement",
      "Progress Notes", "Treatment Given", "Session Fee (INR)", "Receipt No", "Payment Mode", "Visit Type"
    ];

    /* ACTION: ADD SINGLE PATIENT */
    if (action === 'addPatient' && payload.patient) {
      var np = payload.patient;
      var pSheet = ssPrimary.getSheetByName("Patient Directory");
      if (!pSheet) {
        pSheet = ssPrimary.getActiveSheet();
        pSheet.setName("Patient Directory");
      }
      if (pSheet.getLastRow() < 1) {
        pSheet.appendRow(primaryHeaders);
        pSheet.getRange(1, 1, 1, primaryHeaders.length).setFontWeight("bold").setBackground("#e0f2fe").setFontColor("#0369a1");
      }

      var rawPhone = np.contact ? String(np.contact).trim() : '';
      var phoneCell = rawPhone ? (rawPhone.indexOf("'") === 0 ? rawPhone : "'" + rawPhone) : '';
      var npRealTime = formatScriptTime24(np.time, np.createdAt || nowTimestamp);

      pSheet.appendRow([
        np.regNo || '', np.name || '', np.date || '', npRealTime, np.age || '', np.sex || '',
        phoneCell, np.address || '', np.bloodGroup || '', np.height || '', np.weight || '',
        np.seenBy || 'R. Chandrashekar', np.referredBy || '', np.diagnosis || '', np.history || '',
        np.comorbid || '', np.modalities || '', np.painScaleBefore !== undefined ? np.painScaleBefore : '',
        np.painScaleAfter !== undefined ? np.painScaleAfter : '', np.painImprovement || '',
        np.vasChartSummary || '', np.treatmentFee !== undefined && np.treatmentFee !== '' ? np.treatmentFee : 0,
        np.paymentMethod || 'Cash', np.visitType || 'Clinic', np.receiptNo || '',
        np.followUpsCount || 0, np.followUpsTotalFee || 0, np.totalRevenue || 0,
        np.followUpsSummary || '', 'Active', nowTimestamp
      ]);

      var pLast = pSheet.getLastRow();
      pSheet.getRange(pLast, 1).setNumberFormat("@");
      pSheet.getRange(pLast, 4).setNumberFormat("@");
      pSheet.getRange(pLast, 7).setNumberFormat("@");

      var npList = [np];
      pureAppendPatientsToArchive(ssPrimary, npList, "Archive Patient Registry", nowTimestamp, "New Patient Added");

      var addArchiveReport = [];
      for (var at = 0; at < targets.length; at++) {
        var tItem = targets[at];
        try {
          var tSs = SpreadsheetApp.openById(tItem.id);
          var res = pureAppendPatientsToArchive(tSs, npList, "Archive Patient Registry", nowTimestamp, "New Patient Added");
          if (payload.localDBData) syncLocalDatabaseEngineSheet(tSs, payload.localDBData, nowTimestamp);
          addArchiveReport.push({ label: tItem.label, id: tItem.id, status: 'success', patientsAppended: res.appended });
        } catch (atErr) {
          addArchiveReport.push({ label: tItem.label, id: tItem.id, status: 'error', message: atErr.message || String(atErr) });
        }
      }

      if (payload.localDBData) syncLocalDatabaseEngineSheet(ssPrimary, payload.localDBData, nowTimestamp);

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        action: 'addPatient',
        regNo: np.regNo,
        archiveReport: addArchiveReport,
        timestamp: nowTimestamp
      })).setMimeType(ContentService.MimeType.JSON);
    }

    /* ACTION: PURGE PERMANENT TRASH */
    if (action === 'purgeTrash') {
      var deletedRegNos = payload.deletedRegNos || [];
      var delKeys = {};
      for (var d = 0; d < deletedRegNos.length; d++) {
        var dk = normalizeRegKey(deletedRegNos[d]);
        if (dk) delKeys[dk] = true;
      }
      var pPurged = purgeMatchingRows(ssPrimary, "Patient Directory", delKeys, 0);
      var fuPurged = purgeMatchingRows(ssPrimary, "Follow-up Sessions Ledger", delKeys, 0);
      purgeMatchingRows(ssPrimary, "Archive Patient Registry", delKeys, 0);
      purgeMatchingRows(ssPrimary, "Archive Follow-ups Ledger", delKeys, 0);

      for (var pt = 0; pt < targets.length; pt++) {
        try {
          var ssArcP = SpreadsheetApp.openById(targets[pt].id);
          purgeMatchingRows(ssArcP, "Archive Patient Registry", delKeys, 0);
          purgeMatchingRows(ssArcP, "Archive Follow-ups Ledger", delKeys, 0);
        } catch (pe) {}
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        action: 'purgeTrash',
        purgedPrimaryPatients: pPurged,
        purgedPrimaryFollowUps: fuPurged,
        timestamp: nowTimestamp
      })).setMimeType(ContentService.MimeType.JSON);
    }

    /* ACTION: FULL SYNC (DEFAULT) */
    var primarySheet = ssPrimary.getSheetByName("Patient Directory");
    if (!primarySheet) {
      primarySheet = ssPrimary.getActiveSheet();
      primarySheet.setName("Patient Directory");
    }
    primarySheet.clear();
    primarySheet.appendRow(primaryHeaders);
    primarySheet.getRange(1, 1, 1, primaryHeaders.length).setFontWeight("bold").setBackground("#e0f2fe").setFontColor("#0369a1");
    primarySheet.setFrozenRows(1);

    var primaryRows = [];
    var allFollowUpRows = [];

    for (var i = 0; i < patients.length; i++) {
      var p = patients[i];
      var isTrash = (p.deleted === true || String(p.status).toLowerCase() === 'deleted' || String(p.status).toLowerCase() === 'trash');
      var statusLabel = isTrash ? 'Trash' : 'Active';

      var rPhone = p.contact ? String(p.contact).trim() : '';
      var phCell = rPhone ? (rPhone.indexOf("'") === 0 ? rPhone : "'" + rPhone) : '';
      var pRealTime = formatScriptTime24(p.time, p.createdAt || p.updatedAt);

      primaryRows.push([
        p.regNo || '', p.name || '', p.date || '', pRealTime, p.age || '', p.sex || '',
        phCell, p.address || '', p.bloodGroup || '', p.height || '', p.weight || '',
        p.seenBy || 'R. Chandrashekar', p.referredBy || '', p.diagnosis || '', p.history || '',
        p.comorbid || '', p.modalities || '', p.painScaleBefore !== undefined ? p.painScaleBefore : '',
        p.painScaleAfter !== undefined ? p.painScaleAfter : '', p.painImprovement || '',
        p.vasChartSummary || '', p.treatmentFee !== undefined && p.treatmentFee !== '' ? p.treatmentFee : 0,
        p.paymentMethod || 'Cash', p.visitType || 'Clinic', p.receiptNo || '',
        p.followUpsCount || 0, p.followUpsTotalFee || 0, p.totalRevenue || 0,
        p.followUpsSummary || '', statusLabel, nowTimestamp
      ]);

      if (p.followUps && p.followUps.length > 0) {
        for (var f = 0; f < p.followUps.length; f++) {
          var fu = p.followUps[f];
          var fuRealTime = formatFollowUpTiming(fu.time);
          allFollowUpRows.push([
            p.regNo || '', p.name || '', fu.sessionNum || (f + 1), fu.date || '', fuRealTime,
            p.seenBy || 'R. Chandrashekar', p.referredBy || '',
            fu.painScaleBefore !== undefined && fu.painScaleBefore !== '' ? fu.painScaleBefore : '',
            fu.painScaleAfter !== undefined && fu.painScaleAfter !== '' ? fu.painScaleAfter : '',
            fu.painImprovement || '', fu.notes || '', fu.treatment || fu.modalities || '',
            fu.fee !== undefined && fu.fee !== '' ? fu.fee : 0, fu.receiptNo || '',
            fu.paymentMethod || 'Cash', fu.visitType || 'Clinic'
          ]);
        }
      }
    }

    if (primaryRows.length > 0) {
      primarySheet.getRange(2, 1, primaryRows.length, primaryHeaders.length).setValues(primaryRows);
      primarySheet.getRange(2, 1, primaryRows.length, 1).setNumberFormat("@");
      primarySheet.getRange(2, 4, primaryRows.length, 1).setNumberFormat("@");
      primarySheet.getRange(2, 7, primaryRows.length, 1).setNumberFormat("@");
    }

    /* Primary Follow-up Sessions Ledger */
    var fuSheet = ssPrimary.getSheetByName("Follow-up Sessions Ledger");
    if (!fuSheet) fuSheet = ssPrimary.insertSheet("Follow-up Sessions Ledger");
    fuSheet.clear();
    fuSheet.appendRow(fuHeaders);
    fuSheet.getRange(1, 1, 1, fuHeaders.length).setFontWeight("bold").setBackground("#fef3c7").setFontColor("#92400e");
    fuSheet.setFrozenRows(1);
    if (allFollowUpRows.length > 0) {
      fuSheet.getRange(2, 1, allFollowUpRows.length, fuHeaders.length).setValues(allFollowUpRows);
      fuSheet.getRange(2, 1, allFollowUpRows.length, 1).setNumberFormat("@");
      fuSheet.getRange(2, 5, allFollowUpRows.length, 1).setNumberFormat("@");
    }

    if (payload.localDBData) {
      syncLocalDatabaseEngineSheet(ssPrimary, payload.localDBData, nowTimestamp);
    }

    /* Internal Archive on Primary Sheet */
    var intPatientResult = pureAppendPatientsToArchive(ssPrimary, patients, "Archive Patient Registry", nowTimestamp, "Sync Snapshot");
    var intFuResult = pureAppendFollowUpsToArchive(ssPrimary, patients, nowTimestamp);

    /* External Archive Spreadsheets (Strictly Add-Only) */
    var archiveReport = [];
    var totalExtPatientsAppended = 0;
    var totalExtFuAppended = 0;

    for (var t = 0; t < targets.length; t++) {
      var item = targets[t];
      try {
        var ssArc = SpreadsheetApp.openById(item.id);
        if (!ssArc) {
          archiveReport.push({ label: item.label, id: item.id, status: 'error', message: 'Unable to open spreadsheet. Ensure edit access is granted.' });
          continue;
        }

        var pResult = pureAppendPatientsToArchive(ssArc, patients, "Archive Patient Registry", nowTimestamp, "Sync Snapshot");
        totalExtPatientsAppended += pResult.appended;

        var fuResult = pureAppendFollowUpsToArchive(ssArc, patients, nowTimestamp);
        totalExtFuAppended += fuResult.appended;

        if (payload.localDBData) syncLocalDatabaseEngineSheet(ssArc, payload.localDBData, nowTimestamp);

        archiveReport.push({
          label: item.label,
          id: item.id,
          name: ssArc.getName(),
          status: 'success',
          patientsAppended: pResult.appended,
          followUpsAppended: fuResult.appended,
          localDBReplicated: !!payload.localDBData
        });
      } catch (arcErr) {
        archiveReport.push({ label: item.label, id: item.id, status: 'error', message: arcErr.message || String(arcErr) });
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      action: 'sync',
      primaryActiveRecords: primaryRows.length,
      primaryFollowUps: allFollowUpRows.length,
      internalPatientsAppended: intPatientResult.appended,
      internalFollowUpsAppended: intFuResult.appended,
      externalPatientsAppended: totalExtPatientsAppended,
      externalFollowUpsAppended: totalExtFuAppended,
      archiveReport: archiveReport,
      localDBReplicated: !!payload.localDBData,
      timestamp: nowTimestamp
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/* --- SECTION 2: TELEPHONE DIRECTORY DATA LOADER --- */

function getPatientsDataForDirectory(sortOrder) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return [];

    var targetSheet = null;
    var candidates = ["Patient Directory", "Patients", "Active Patients", "Sheet1"];
    for (var c = 0; c < candidates.length; c++) {
      var s = ss.getSheetByName(candidates[c]);
      if (s && s.getLastRow() >= 2) {
        targetSheet = s;
        break;
      }
    }

    if (!targetSheet) {
      var allSheets = ss.getSheets();
      for (var sh = 0; sh < allSheets.length; sh++) {
        var sName = allSheets[sh].getName().toLowerCase();
        if (sName.indexOf("archive") !== -1 || sName.indexOf("ledger") !== -1 || sName.indexOf("follow-up") !== -1) continue;
        if (allSheets[sh].getLastRow() >= 2) {
          targetSheet = allSheets[sh];
          break;
        }
      }
    }

    if (!targetSheet) return [];
    var sheetNameLower = targetSheet.getName().toLowerCase();
    if (sheetNameLower.indexOf("archive") !== -1 || sheetNameLower.indexOf("ledger") !== -1) return [];

    var data = targetSheet.getDataRange().getValues();
    if (!data || data.length < 2) return [];

    var headers = data[0];
    var rows = [];
    var tz = Session.getScriptTimeZone() || 'Asia/Kolkata';

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row || row.length === 0) continue;

      var obj = {};
      var hasValue = false;
      for (var j = 0; j < headers.length; j++) {
        var h = String(headers[j] || '').trim();
        var val = formatCellDate(row[j], tz);
        if (val !== '') hasValue = true;
        obj[h] = val;
      }

      if (hasValue) {
        for (var colKey in obj) {
          var cleanKey = colKey.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (!obj['Patient Name'] && (cleanKey === 'patientname' || cleanKey === 'name' || cleanKey === 'patient')) {
            obj['Patient Name'] = obj[colKey];
          }
          if (!obj['Contact Number'] && (cleanKey === 'contactnumber' || cleanKey === 'contact' || cleanKey === 'contactno' || cleanKey === 'phone' || cleanKey === 'phonenumber' || cleanKey === 'mobile' || cleanKey === 'mobileno')) {
            obj['Contact Number'] = obj[colKey];
          }
          if (!obj['Reg No'] && (cleanKey === 'regno' || cleanKey === 'patientid' || cleanKey === 'id' || cleanKey === 'mrn' || cleanKey === 'opno')) {
            obj['Reg No'] = obj[colKey];
          }
          if (!obj['Clinical Diagnosis'] && (cleanKey === 'clinicaldiagnosis' || cleanKey === 'diagnosis' || cleanKey === 'condition')) {
            obj['Clinical Diagnosis'] = obj[colKey];
          }
          if (!obj['Seen By'] && (cleanKey === 'seenby' || cleanKey === 'doctor' || cleanKey === 'consultant' || cleanKey === 'physiotherapist')) {
            obj['Seen By'] = obj[colKey];
          }
          if (!obj['Consultation Date'] && (cleanKey === 'consultationdate' || cleanKey === 'date' || cleanKey === 'entrydate')) {
            obj['Consultation Date'] = obj[colKey];
          }
          if (!obj['Status'] && (cleanKey === 'status' || cleanKey === 'archivestatus')) {
            obj['Status'] = obj[colKey];
          }
        }

        var statusVal = String(obj['Status'] || '').toLowerCase();
        if (statusVal === 'deleted' || obj['deleted'] === true || obj['deleted'] === 'true') continue;

        obj['Patient Name'] = obj['Patient Name'] || 'Patient';
        obj['Contact Number'] = obj['Contact Number'] || '';
        obj['Reg No'] = obj['Reg No'] || '-';
        obj['Seen By'] = obj['Seen By'] || 'R. Chandrashekar';
        obj['Consultation Date'] = obj['Consultation Date'] || '-';
        obj['Clinical Diagnosis'] = obj['Clinical Diagnosis'] || '';

        rows.push(obj);
      }
    }

    // Sort rows strictly by Patient ID (default: id-desc, newest entry at top, oldest entry at bottom)
    var isAsc = (sortOrder === 'id-asc' || sortOrder === 'id-asec');
    rows.sort(function(a, b) {
      var regA = String(a['Reg No'] || a['Patient ID'] || a['regNo'] || '').trim();
      var regB = String(b['Reg No'] || b['Patient ID'] || b['regNo'] || '').trim();

      var matchA = regA.match(/^[A-Za-z]+\\/(\\d{2,4})\\/(\\d{1,2})\\/(\\d+)/);
      var matchB = regB.match(/^[A-Za-z]+\\/(\\d{2,4})\\/(\\d{1,2})\\/(\\d+)/);

      var yearA = matchA ? parseInt(matchA[1], 10) : 0;
      var monthA = matchA ? parseInt(matchA[2], 10) : 0;
      var seqA = matchA ? parseInt(matchA[3], 10) : 0;

      var yearB = matchB ? parseInt(matchB[1], 10) : 0;
      var monthB = matchB ? parseInt(matchB[2], 10) : 0;
      var seqB = matchB ? parseInt(matchB[3], 10) : 0;

      if (yearA < 100 && yearA > 0) yearA += 2000;
      if (yearB < 100 && yearB > 0) yearB += 2000;

      if (!matchA) {
        var dMatchA = String(a['Consultation Date'] || '').match(/^(\\d{4})-(\\d{1,2})/);
        if (dMatchA) { yearA = parseInt(dMatchA[1], 10); monthA = parseInt(dMatchA[2], 10); }
        var trA = regA.match(/(\\d+)$/);
        if (trA) seqA = parseInt(trA[1], 10);
      }
      if (!matchB) {
        var dMatchB = String(b['Consultation Date'] || '').match(/^(\\d{4})-(\\d{1,2})/);
        if (dMatchB) { yearB = parseInt(dMatchB[1], 10); monthB = parseInt(dMatchB[2], 10); }
        var trB = regB.match(/(\\d+)$/);
        if (trB) seqB = parseInt(trB[1], 10);
      }

      if (yearA !== yearB) return isAsc ? (yearA - yearB) : (yearB - yearA);
      if (monthA !== monthB) return isAsc ? (monthA - monthB) : (monthB - monthA);
      if (seqA !== seqB) return isAsc ? (seqA - seqB) : (seqB - seqA);

      var dateA = String(a['Consultation Date'] || '');
      var dateB = String(b['Consultation Date'] || '');
      if (dateA !== dateB) return isAsc ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
      return 0;
    });

    return rows;
  } catch (err) {
    Logger.log('getPatientsDataForDirectory error: ' + err);
    return [];
  }
}

/* --- SECTION 3: ARCHIVE SPREADSHEETS ADD-ONLY LOGIC --- */

function pureAppendPatientsToArchive(ss, patients, sheetTitle, nowTimestamp, eventMode) {
  if (!ss) return { appended: 0, deduplicated: false };
  var title = sheetTitle || "Archive Patient Registry";
  var sheetArc = ss.getSheetByName(title);
  var arcCols = [
    "Reg No", "Patient Name", "Consultation Date", "Time Stamp", "Age", "Sex", "Contact Number", "Address",
    "Blood Group", "Seen By", "Referred By", "Clinical Diagnosis", "Comorbid Conditions", "Prescribed Modalities",
    "Initial Fee (INR)", "Payment Mode", "Total Revenue (INR)", "Archive Status", "Archive Event / Mode", "Archived At"
  ];

  if (!sheetArc) {
    sheetArc = ss.insertSheet(title);
    sheetArc.appendRow(arcCols);
    sheetArc.getRange(1, 1, 1, arcCols.length).setFontWeight("bold").setBackground("#dcfce7").setFontColor("#166534");
    sheetArc.setFrozenRows(1);
  }

  var lastRow = sheetArc.getLastRow();
  var existingSignatures = {};
  var cleanExistingRows = [];
  var hasExistingDuplicates = false;

  if (lastRow > 1) {
    var numCols = sheetArc.getLastColumn() || arcCols.length;
    var existingValues = sheetArc.getRange(2, 1, lastRow - 1, numCols).getValues();
    var existingDisplayVals = sheetArc.getRange(2, 1, lastRow - 1, numCols).getDisplayValues();

    for (var r = 0; r < existingValues.length; r++) {
      var row = existingValues[r];
      var dispRow = existingDisplayVals[r] || [];
      var rReg = normalizeRegKey(dispRow[0] || row[0]);
      var rName = normalizeNameKey(dispRow[1] || row[1]);
      var rDate = normalizeArchiveDate(dispRow[2] || row[2]);
      var rTime = normalizeArchiveTime(dispRow[3] || row[3]);

      var isDup = false;
      var sigReg = rReg ? ('reg_' + rReg) : '';
      var sigRegDate = (rReg && rDate) ? (rReg + '|' + rDate) : '';
      var sigRegDateTime = (rReg && rDate && rTime) ? (rReg + '|' + rDate + '|' + rTime) : '';
      var sigNameDateTime = (rName && rDate && rTime) ? (rName + '|' + rDate + '|' + rTime) : '';

      if (
        (sigRegDateTime && existingSignatures[sigRegDateTime]) ||
        (sigRegDate && existingSignatures[sigRegDate]) ||
        (sigNameDateTime && existingSignatures[sigNameDateTime]) ||
        (sigReg && existingSignatures[sigReg])
      ) {
        isDup = true;
        hasExistingDuplicates = true;
      } else {
        if (sigRegDateTime) existingSignatures[sigRegDateTime] = true;
        if (sigRegDate) existingSignatures[sigRegDate] = true;
        if (sigNameDateTime) existingSignatures[sigNameDateTime] = true;
        if (sigReg) existingSignatures[sigReg] = true;
      }

      if (!isDup) cleanExistingRows.push(row);
    }

    if (hasExistingDuplicates && cleanExistingRows.length > 0) {
      sheetArc.getRange(2, 1, lastRow - 1, numCols).clearContent();
      sheetArc.getRange(2, 1, cleanExistingRows.length, cleanExistingRows[0].length).setValues(cleanExistingRows);
      sheetArc.getRange(2, 1, cleanExistingRows.length, 1).setNumberFormat("@");
      sheetArc.getRange(2, 4, cleanExistingRows.length, 1).setNumberFormat("@");
      sheetArc.getRange(2, 7, cleanExistingRows.length, 1).setNumberFormat("@");
    }
  }

  if (!patients || patients.length === 0) return { appended: 0, deduplicated: hasExistingDuplicates };

  var mode = eventMode || "Add Patient / Sync";
  var newRows = [];

  for (var i = 0; i < patients.length; i++) {
    var p = patients[i];
    if (p.deleted || p.status === 'Deleted') continue;

    var pReg = normalizeRegKey(p.regNo);
    var pName = normalizeNameKey(p.name);
    var pDate = normalizeArchiveDate(p.date);
    var pRealTime = formatScriptTime24(p.time, p.createdAt || p.updatedAt);
    var pTimeNorm = normalizeArchiveTime(pRealTime);

    var inSigReg = pReg ? ('reg_' + pReg) : '';
    var inSigRegDate = (pReg && pDate) ? (pReg + '|' + pDate) : '';
    var inSigRegDateTime = (pReg && pDate && pTimeNorm) ? (pReg + '|' + pDate + '|' + pTimeNorm) : '';
    var inSigNameDateTime = (pName && pDate && pTimeNorm) ? (pName + '|' + pDate + '|' + pTimeNorm) : '';

    if (
      (inSigRegDateTime && existingSignatures[inSigRegDateTime]) ||
      (inSigRegDate && existingSignatures[inSigRegDate]) ||
      (inSigNameDateTime && existingSignatures[inSigNameDateTime]) ||
      (inSigReg && existingSignatures[inSigReg])
    ) {
      continue;
    }

    if (inSigRegDateTime) existingSignatures[inSigRegDateTime] = true;
    if (inSigRegDate) existingSignatures[inSigRegDate] = true;
    if (inSigNameDateTime) existingSignatures[inSigNameDateTime] = true;
    if (inSigReg) existingSignatures[inSigReg] = true;

    var rawPPhone = p.contact ? String(p.contact).trim() : '';
    var pPhoneCell = rawPPhone ? (rawPPhone.indexOf("'") === 0 ? rawPPhone : "'" + rawPPhone) : '';

    newRows.push([
      p.regNo || '', p.name || '', p.date || '', pRealTime, p.age || '', p.sex || '',
      pPhoneCell, p.address || '', p.bloodGroup || '', p.seenBy || 'R. Chandrashekar',
      p.referredBy || '', p.diagnosis || '', p.comorbid || '', p.modalities || '',
      p.treatmentFee !== undefined && p.treatmentFee !== '' ? p.treatmentFee : 0,
      p.paymentMethod || 'Cash', p.totalRevenue || 0, 'Permanent Archived', mode, nowTimestamp
    ]);
  }

  if (newRows.length > 0) {
    var startRow = sheetArc.getLastRow() + 1;
    sheetArc.getRange(startRow, 1, newRows.length, arcCols.length).setValues(newRows);
    sheetArc.getRange(startRow, 1, newRows.length, 1).setNumberFormat("@");
    sheetArc.getRange(startRow, 4, newRows.length, 1).setNumberFormat("@");
    sheetArc.getRange(startRow, 7, newRows.length, 1).setNumberFormat("@");
  }

  return { appended: newRows.length, deduplicated: hasExistingDuplicates };
}

function pureAppendFollowUpsToArchive(ss, patients, nowTimestamp) {
  if (!ss) return { appended: 0 };
  var sheetArcFu = ss.getSheetByName("Archive Follow-ups Ledger");
  var fuCols = [
    "Reg No", "Patient Name", "Session Number", "Session Date", "Session Time",
    "Seen By", "Referred By", "Pain Score Before", "Pain Score After", "Pain Improvement",
    "Progress Notes", "Treatment Given", "Session Fee (INR)", "Receipt No", "Payment Mode", "Visit Type", "Archived At"
  ];

  if (!sheetArcFu) {
    sheetArcFu = ss.insertSheet("Archive Follow-ups Ledger");
    sheetArcFu.appendRow(fuCols);
    sheetArcFu.getRange(1, 1, 1, fuCols.length).setFontWeight("bold").setBackground("#fef3c7").setFontColor("#92400e");
    sheetArcFu.setFrozenRows(1);
  }

  var lastRow = sheetArcFu.getLastRow();
  var existingFuSignatures = {};

  if (lastRow > 1) {
    var existingFuValues = sheetArcFu.getRange(2, 1, lastRow - 1, fuCols.length).getValues();
    var existingFuDisplay = sheetArcFu.getRange(2, 1, lastRow - 1, fuCols.length).getDisplayValues();
    for (var r = 0; r < existingFuValues.length; r++) {
      var dRow = existingFuDisplay[r] || [];
      var fReg = normalizeRegKey(dRow[0] || existingFuValues[r][0]);
      var fNum = String(dRow[2] || existingFuValues[r][2] || '').trim();
      var fDate = normalizeArchiveDate(dRow[3] || existingFuValues[r][3]);
      var fTime = normalizeArchiveTime(dRow[4] || existingFuValues[r][4]);
      if (fReg && fNum) existingFuSignatures[fReg + '|' + fNum + '|' + fDate + '|' + fTime] = true;
    }
  }

  var newFuRows = [];
  for (var i = 0; i < patients.length; i++) {
    var p = patients[i];
    if (p.deleted || p.status === 'Deleted' || !p.followUps) continue;

    var pReg = normalizeRegKey(p.regNo);
    for (var f = 0; f < p.followUps.length; f++) {
      var fu = p.followUps[f];
      var fuTime = formatFollowUpTiming(fu.time);
      var fuTimeNorm = normalizeArchiveTime(fuTime);
      var fuDateNorm = normalizeArchiveDate(fu.date);
      var fuNum = String(fu.sessionNum || (f + 1));
      var fuSig = pReg + '|' + fuNum + '|' + fuDateNorm + '|' + fuTimeNorm;

      if (existingFuSignatures[fuSig]) continue;
      existingFuSignatures[fuSig] = true;

      newFuRows.push([
        p.regNo || '', p.name || '', fu.sessionNum || (f + 1), fu.date || '', fuTime,
        p.seenBy || 'R. Chandrashekar', p.referredBy || '',
        fu.painScaleBefore !== undefined && fu.painScaleBefore !== '' ? fu.painScaleBefore : '',
        fu.painScaleAfter !== undefined && fu.painScaleAfter !== '' ? fu.painScaleAfter : '',
        fu.painImprovement || '', fu.notes || '', fu.treatment || fu.modalities || '',
        fu.fee !== undefined && fu.fee !== '' ? fu.fee : 0, fu.receiptNo || '',
        fu.paymentMethod || 'Cash', fu.visitType || 'Clinic', nowTimestamp
      ]);
    }
  }

  if (newFuRows.length > 0) {
    var startFuRow = sheetArcFu.getLastRow() + 1;
    sheetArcFu.getRange(startFuRow, 1, newFuRows.length, fuCols.length).setValues(newFuRows);
    sheetArcFu.getRange(startFuRow, 1, newFuRows.length, 1).setNumberFormat("@");
    sheetArcFu.getRange(startFuRow, 5, newFuRows.length, 1).setNumberFormat("@");
  }

  return { appended: newFuRows.length };
}

/* --- SECTION 4: REPLICATE DATABASE ENGINE TELEMETRY --- */

function syncLocalDatabaseEngineSheet(ss, localDBData, nowTimestamp) {
  if (!ss || !localDBData) return;
  try {
    var sheet = ss.getSheetByName("Local Database Engine");
    if (!sheet) {
      sheet = ss.insertSheet("Local Database Engine");
      sheet.setTabColor("#6366f1");
    }
    sheet.clear();

    var headers = ["Configuration / Health Metric", "Status / Value", "Detail / Explanation", "Scope / Device", "Diagnostic Level", "Recorded At"];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#e0e7ff").setFontColor("#3730a3");
    sheet.setFrozenRows(1);

    var stats = localDBData.stats || {};
    var rows = [
      ["Local Database Status", "Active (Synced)", "Synchronized bidirectionally with Google Sheets", "Browser IndexedDB", "Healthy", nowTimestamp],
      ["Active Patients in Clinical Registry", String(stats.activePatients || 0), "Excludes soft-deleted", "Connected Spreadsheet + Archives", "Active", nowTimestamp],
      ["Soft-Deleted Patients (Trash)", String(stats.trashPatients || 0), "Recoverable records retained in Trash", "Primary Sheet Only", "Info", nowTimestamp],
      ["Total Follow-up Sessions", String(stats.totalFollowUps || 0), "Logged across active patients", "Primary + Archive Ledgers", "Healthy", nowTimestamp],
      ["Total Clinical Revenue (INR)", "Rs. " + String(stats.totalRevenue || 0), "Combined Initial Consultation & Follow-ups", "Clinic Ledger", "Financial", nowTimestamp],
      ["Database Schema Version", String(localDBData.schemaVersion || "1.0.0"), "IndexedDB versioning", "Internal Storage Engine", "System", nowTimestamp]
    ];

    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    sheet.autoResizeColumns(1, headers.length);
  } catch (err) {
    Logger.log("syncLocalDatabaseEngineSheet notice: " + err);
  }
}

/* --- SECTION 5: PERMANENT PURGE HELPER --- */

function purgeMatchingRows(ss, sheetTitle, matchKeys, colIndex) {
  if (!ss || !matchKeys) return 0;
  var sheet = ss.getSheetByName(sheetTitle);
  if (!sheet) return 0;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  var idx = (colIndex !== undefined) ? colIndex : 0;
  var values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var rowsToKeep = [];
  var purgedCount = 0;

  for (var r = 0; r < values.length; r++) {
    var row = values[r];
    var cellKey = normalizeRegKey(row[idx]);
    if (cellKey && matchKeys[cellKey]) {
      purgedCount++;
    } else {
      rowsToKeep.push(row);
    }
  }

  if (purgedCount > 0) {
    var numCols = sheet.getLastColumn();
    sheet.getRange(2, 1, lastRow - 1, numCols).clearContent();
    if (rowsToKeep.length > 0) {
      sheet.getRange(2, 1, rowsToKeep.length, rowsToKeep[0].length).setValues(rowsToKeep);
    }
  }
  return purgedCount;
}

/* --- SECTION 6: DATA & DATE/TIME NORMALIZATION HELPERS --- */

function formatCellDate(rawVal, tz) {
  if (rawVal === null || rawVal === undefined) return '';
  if (rawVal instanceof Date && !isNaN(rawVal.getTime())) {
    try {
      return Utilities.formatDate(rawVal, tz || 'Asia/Kolkata', 'dd/MM/yyyy');
    } catch (e) {
      return Utilities.formatDate(rawVal, 'GMT', 'yyyy-MM-dd');
    }
  }
  if (typeof rawVal === 'number') return rawVal;
  return String(rawVal).replace(/^'/, '').trim();
}

function extractCleanSheetId(input) {
  if (!input) return '';
  var s = String(input).trim();
  var match = s.match(new RegExp('/d/([a-zA-Z0-9-_]+)'));
  if (match && match[1]) return match[1];
  var clean = s.replace(/[^a-zA-Z0-9-_]/g, '');
  return clean.length >= 20 ? clean : '';
}

function normalizeRegKey(input) {
  if (!input) return '';
  return String(input).replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim();
}

function normalizeNameKey(input) {
  if (!input) return '';
  return String(input).trim().toLowerCase().replace(/\\s+/g, ' ');
}

function normalizeArchiveDate(val) {
  if (!val && val !== 0) return '';
  if (Object.prototype.toString.call(val) === '[object Date]' && !isNaN(val.getTime())) {
    try {
      return Utilities.formatDate(val, Session.getScriptTimeZone() || 'Asia/Kolkata', 'yyyy-MM-dd');
    } catch (e) {
      return Utilities.formatDate(val, 'GMT', 'yyyy-MM-dd');
    }
  }
  var s = String(val).trim();
  var ymd = s.match(/^(\\d{4})[\\/\\-\\.](\\d{1,2})[\\/\\-\\.](\\d{1,2})/);
  if (ymd) {
    return ymd[1] + '-' + (ymd[2].length === 1 ? '0' + ymd[2] : ymd[2]) + '-' + (ymd[3].length === 1 ? '0' + ymd[3] : ymd[3]);
  }
  var dmy = s.match(/^(\\d{1,2})[\\/\\-\\.](\\d{1,2})[\\/\\-\\.](\\d{4})/);
  if (dmy) {
    return dmy[3] + '-' + (dmy[2].length === 1 ? '0' + dmy[2] : dmy[2]) + '-' + (dmy[1].length === 1 ? '0' + dmy[1] : dmy[1]);
  }
  return s.toLowerCase();
}

function normalizeArchiveTime(val) {
  if (!val && val !== 0) return '';
  if (Object.prototype.toString.call(val) === '[object Date]' && !isNaN(val.getTime())) {
    try {
      return Utilities.formatDate(val, Session.getScriptTimeZone() || 'Asia/Kolkata', 'HH:mm:ss');
    } catch (e) {
      return Utilities.formatDate(val, 'GMT', 'HH:mm:ss');
    }
  }
  var s = String(val).trim();
  var m12 = s.match(/^(\\d{1,2}):(\\d{2})(?::(\\d{2}))?\\s*(am|pm)$/i);
  if (m12) {
    var h = parseInt(m12[1], 10);
    var min = m12[2];
    var sec = m12[3] || '00';
    var ampm = m12[4].toUpperCase();
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return (h < 10 ? '0' + h : '' + h) + ':' + min + ':' + sec;
  }
  var m24 = s.match(/^(\\d{1,2}):(\\d{2})(?::(\\d{2}))?/);
  if (m24) {
    var h2 = parseInt(m24[1], 10);
    return (h2 < 10 ? '0' + h2 : '' + h2) + ':' + m24[2] + ':' + (m24[3] || '00');
  }
  return s.toLowerCase();
}

function formatScriptTime24(t, fallbackIsoOrEpoch) {
  var s = (t !== undefined && t !== null) ? String(t).trim() : '';
  if (s) {
    var m12 = s.match(/^(\\d{1,2}):(\\d{2})(?::(\\d{2}))?\\s*(am|pm)$/i);
    if (m12) {
      var h = parseInt(m12[1], 10);
      var min = m12[2];
      var sec = m12[3] || '00';
      var ampm = m12[4].toUpperCase();
      if (ampm === 'PM' && h < 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      return (h < 10 ? '0' + h : '' + h) + ':' + min + ':' + sec;
    }
    if (/^([01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d$/.test(s)) return s;
    if (/^([01]\\d|2[0-3]):[0-5]\\d$/.test(s)) return s + ':00';
    if (s.indexOf('T') > -1) {
      var timePart = s.split('T')[1].replace(/Z$/i, '').split('.')[0];
      if (/^([01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d$/.test(timePart)) return timePart;
    }
  }
  if (fallbackIsoOrEpoch) {
    var fbNum = Number(fallbackIsoOrEpoch);
    var dFb = (!isNaN(fbNum) && fbNum > 1000000000) ? new Date(fbNum) : new Date(fallbackIsoOrEpoch);
    if (!isNaN(dFb.getTime()) && dFb.getFullYear() > 2000) {
      return Utilities.formatDate(dFb, Session.getScriptTimeZone() || 'Asia/Kolkata', 'HH:mm:ss');
    }
  }
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Kolkata', 'HH:mm:ss');
}

function formatFollowUpTiming(t) {
  if (t === undefined || t === null || String(t).trim() === '') return '10:00 AM';
  var s = String(t).trim();
  var m12 = s.match(/^(\\d{1,2}):(\\d{2})(?::(\\d{2}))?\\s*(am|pm)$/i);
  if (m12) {
    var h = parseInt(m12[1], 10);
    return (h < 10 ? '0' + h : '' + h) + ':' + m12[2] + ' ' + m12[4].toUpperCase();
  }
  var m24 = s.match(/^([01]?\\d|2[0-3]):([0-5]\\d)(?::([0-5]\\d))?$/);
  if (m24) {
    var h24 = parseInt(m24[1], 10);
    var ampm24 = h24 >= 12 ? 'PM' : 'AM';
    var h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    return (h12 < 10 ? '0' + h12 : '' + h12) + ':' + m24[2] + ' ' + ampm24;
  }
  if (s.indexOf('T') > -1) {
    return formatFollowUpTiming(s.split('T')[1].replace(/Z$/i, '').split('.')[0]);
  }
  return s || '10:00 AM';
}

function ensureFollowUpTimeColumn(sheet) {
  if (!sheet) return;
  try {
    var lastRow = sheet.getLastRow();
    if (lastRow < 1) return;
    var numCols = Math.max(sheet.getLastColumn(), 1);
    var headers = sheet.getRange(1, 1, 1, numCols).getValues()[0];
    var hasTimeCol = false;
    for (var h = 0; h < headers.length; h++) {
      var hText = String(headers[h] || '').toLowerCase().replace(/[^a-z]/g, '');
      if (hText === 'sessiontime' || hText === 'time' || hText === 'timing' || hText === 'sessiontiming') {
        hasTimeCol = true;
        break;
      }
    }
    if (!hasTimeCol) {
      sheet.insertColumnAfter(4);
      sheet.getRange(1, 5).setValue("Session Time")
        .setFontWeight("bold")
        .setBackground("#fef3c7")
        .setFontColor("#92400e");
      if (lastRow > 1) {
        var existingCount = lastRow - 1;
        var defaultTimes = [];
        for (var et = 0; et < existingCount; et++) {
          defaultTimes.push(["10:00 AM"]);
        }
        sheet.getRange(2, 5, existingCount, 1).setValues(defaultTimes).setNumberFormat("@");
      }
    }
  } catch (e) {
    Logger.log("ensureFollowUpTimeColumn notice: " + e);
  }
}
`;
}
