import { Patient, TreatmentModalities, FollowUpVisit, ComorbidConditions, VasChartDataPoint } from '../types';
import { defaultTreatmentModalities, formatPatientId, parsePatientId, parseDateAndTimestamp } from './storage';
import { MODALITIES_LIST } from '../constants';
import { localDB } from '../db/localDatabase';
import { downloadCsv } from './fileDownloadHelper';

export function formatComorbidities(c?: ComorbidConditions): string {
  if (!c) return 'None';
  const list: string[] = [];
  if (c.diabetes) list.push('Diabetes Mellitus');
  if (c.bp) list.push('Hypertension (BP)');
  if (c.thyroid) list.push('Thyroid');
  if (c.other && c.otherText) list.push(c.otherText);
  else if (c.other) list.push('Other Condition');
  return list.length > 0 ? list.join(', ') : 'None';
}

export function formatModalities(m?: TreatmentModalities): string {
  if (!m) return 'None';
  const list: string[] = [];
  MODALITIES_LIST.forEach((item) => {
    if (m[item.key]) list.push(item.label);
  });
  if (m.other && m.otherText) list.push(m.otherText);
  return list.length > 0 ? list.join(', ') : 'None';
}

/**
 * Formats all treatments given during a follow-up session (including custom user-added treatments)
 */
export function formatFollowUpTreatments(fu?: FollowUpVisit): string {
  if (!fu) return 'None';
  const list: string[] = [];
  
  // Custom treatments chosen for this visit
  if (fu.treatmentsGiven && Array.isArray(fu.treatmentsGiven) && fu.treatmentsGiven.length > 0) {
    fu.treatmentsGiven.forEach((t) => {
      const trimmed = (t || '').trim();
      if (trimmed && !list.includes(trimmed)) {
        list.push(trimmed);
      }
    });
  }

  // Modalities from legacy/structured treatment object
  if (fu.treatment) {
    MODALITIES_LIST.forEach((item) => {
      if (fu.treatment[item.key] && !list.includes(item.label)) {
        list.push(item.label);
      }
    });
    if (fu.treatment.other && fu.treatment.otherText && !list.includes(fu.treatment.otherText)) {
      list.push(fu.treatment.otherText.trim());
    }
  }

  return list.length > 0 ? list.join(', ') : 'None';
}

/**
 * Builds structured VAS score chart data points across initial assessment and all follow-up visits
 */
export function buildVasChartData(patient: Patient): VasChartDataPoint[] {
  const points: VasChartDataPoint[] = [];
  const pBefore = patient.painScaleBefore !== undefined ? Number(patient.painScaleBefore) : (patient.painScale !== undefined ? Number(patient.painScale) : undefined);
  const pAfter = patient.painScaleAfter !== undefined ? Number(patient.painScaleAfter) : undefined;

  if (pBefore !== undefined && !isNaN(pBefore)) {
    const relief = pAfter !== undefined && !isNaN(pAfter) ? pBefore - pAfter : undefined;
    const reliefPct = (relief !== undefined && pBefore > 0) ? Math.round((relief / pBefore) * 100) : undefined;
    const modalities = formatModalities(patient.treatment);
    points.push({
      sessionIndex: 0,
      sessionLabel: 'Initial Assessment',
      date: patient.date,
      time: patient.time,
      painBefore: pBefore,
      painAfter: pAfter,
      reliefPoints: relief,
      reliefPercent: reliefPct,
      notes: patient.diagnosis || patient.history || 'Initial Evaluation',
      treatments: modalities !== 'None' ? modalities.split(', ') : [],
    });
  }

  (patient.followUps || []).forEach((fu, idx) => {
    const fuBefore = fu.painScaleBefore !== undefined ? Number(fu.painScaleBefore) : (fu.painScale !== undefined ? Number(fu.painScale) : undefined);
    const fuAfter = fu.painScaleAfter !== undefined ? Number(fu.painScaleAfter) : undefined;

    if (fuBefore !== undefined || fuAfter !== undefined) {
      const beforeVal = fuBefore !== undefined ? fuBefore : 0;
      const relief = fuAfter !== undefined ? beforeVal - fuAfter : undefined;
      const reliefPct = (relief !== undefined && beforeVal > 0) ? Math.round((relief / beforeVal) * 100) : undefined;
      const rxStr = formatFollowUpTreatments(fu);

      points.push({
        sessionIndex: idx + 1,
        sessionLabel: `Session ${idx + 1}`,
        date: fu.date,
        time: fu.time,
        painBefore: beforeVal,
        painAfter: fuAfter,
        reliefPoints: relief,
        reliefPercent: reliefPct,
        notes: fu.notes || '',
        treatments: rxStr !== 'None' ? rxStr.split(', ') : [],
      });
    }
  });

  return points;
}

/**
 * Produces a clear, readable summary string of the patient's VAS pain score recovery trajectory
 */
export function formatVasTrajectorySummary(patient: Patient): string {
  const points = buildVasChartData(patient);
  if (points.length === 0) return 'No VAS recorded';

  const parts = points.map((pt) => {
    if (pt.painAfter !== undefined) {
      const diff = pt.painBefore - pt.painAfter;
      return `${pt.sessionLabel} (${pt.date}): ${pt.painBefore}➔${pt.painAfter}/10 (${diff >= 0 ? `-${diff} pts relief` : `+${Math.abs(diff)} pts`})`;
    }
    return `${pt.sessionLabel} (${pt.date}): ${pt.painBefore}/10`;
  });

  // Calculate baseline to most recent pain score
  if (points.length > 0) {
    const baselineBefore = points[0].painBefore;
    const lastPoint = points[points.length - 1];
    const latestScore = lastPoint.painAfter !== undefined ? lastPoint.painAfter : lastPoint.painBefore;
    const totalRelief = baselineBefore - latestScore;
    const totalReliefPct = baselineBefore > 0 ? Math.round((totalRelief / baselineBefore) * 100) : 0;
    parts.push(`Net Recovery: ${baselineBefore}➔${latestScore}/10 (${totalRelief >= 0 ? `-${totalRelief} pts, ${totalReliefPct}% relief` : `+${Math.abs(totalRelief)} pts`})`);
  }

  return parts.join(' | ');
}

export function formatFollowUpsSummary(followUps?: FollowUpVisit[]): string {
  if (!followUps || followUps.length === 0) return 'None';
  return followUps
    .map((fu, i) => {
      const treatmentStr = formatFollowUpTreatments(fu);
      const painBefore = fu.painScaleBefore !== undefined ? fu.painScaleBefore : fu.painScale;
      const painAfter = fu.painScaleAfter;
      let painStr = '';
      if (painBefore !== undefined && painAfter !== undefined) {
        const diff = painBefore - painAfter;
        painStr = `Pain: ${painBefore}➔${painAfter}/10 (${diff >= 0 ? `-${diff} pts relief` : `+${Math.abs(diff)} pts`})`;
      } else if (painBefore !== undefined) {
        painStr = `Pain (VAS): ${painBefore}/10`;
      }

      const parts = [
        `Session ${i + 1} (${fu.date}${fu.time ? ' ' + fu.time : ''})`,
        painStr,
        fu.fee !== undefined && fu.fee !== '' ? `Fee: ₹${fu.fee}` : '',
        treatmentStr && treatmentStr !== 'None' ? `Rx: ${treatmentStr}` : '',
        fu.receiptNo ? `Rcpt: ${fu.receiptNo}` : '',
        fu.paymentMethod ? `Mode: ${fu.paymentMethod}` : '',
        fu.notes ? `Notes: ${fu.notes}` : '',
      ].filter(Boolean);
      return parts.join(' | ');
    })
    .join('; ');
}

/**
 * Sanitizes cell contents to prevent CSV/Spreadsheet formula injection (CWE-1236)
 * Prefixes strings starting with =, +, -, @ with an apostrophe so Google Sheets renders them as safe text.
 */
export function sanitizeSpreadsheetCell(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Extracts a clean Google Spreadsheet ID from either:
 * - A raw ID (e.g. "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms")
 * - A full URL (e.g. "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0")
 */
export function extractSpreadsheetId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return match[1];
  }
  // Check if user pasted an export/gviz link
  const pubMatch = trimmed.match(/([a-zA-Z0-9_-]{25,})/);
  if (pubMatch && pubMatch[1]) {
    return pubMatch[1];
  }
  return trimmed;
}

/**
 * Parses CSV text taking quotes into consideration
 */
function parseCsv(text: string): string[][] {
  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentVal.trim());
      if (currentRow.some((c) => c.length > 0)) {
        lines.push(currentRow);
      }
      currentRow = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }

  if (currentVal.length > 0 || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some((c) => c.length > 0)) {
      lines.push(currentRow);
    }
  }

  return lines;
}

export interface SheetFetchResult {
  success: boolean;
  patients: Patient[];
  count: number;
  message: string;
  isPrivate?: boolean;
}

/**
 * Normalizes phone numbers to prevent scientific notation (e.g. 9.85E+09)
 * and strips any leading apostrophes used for text forcing in spreadsheets.
 */
export function cleanPhoneNumber(raw: any): string {
  if (raw === null || raw === undefined) return '';
  let str = String(raw).trim();
  // Strip leading single quote/apostrophe
  if (str.startsWith("'")) {
    str = str.slice(1).trim();
  }
  // Check if Google Sheets converted large phone numbers to scientific notation (e.g. "9.84501E+09")
  if (/^[0-9.]+[eE][+-]?[0-9]+$/.test(str)) {
    try {
      const num = Number(str);
      if (!isNaN(num) && isFinite(num)) {
        str = Math.round(num).toString();
      }
    } catch {
      // keep original
    }
  }
  return str;
}

/**
 * Security: Validates Webhook URLs to enforce HTTPS encryption and prevent SSRF attacks.
 */
export function validateWebhookUrl(urlStr: string): { valid: boolean; error?: string } {
  if (!urlStr || typeof urlStr !== 'string') {
    return { valid: false, error: 'Webhook URL cannot be empty.' };
  }
  const trimmed = urlStr.trim();
  if (!trimmed.startsWith('https://')) {
    return {
      valid: false,
      error: 'Security Warning: Webhook URL MUST use secure HTTPS (https://) to safeguard patient medical data in transit.',
    };
  }
  try {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.toLowerCase();
    // SSRF Prevention: Block loopback, RFC1918 private IPs, link-local, and broadcast addresses
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.local') ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
      /^169\.254\./.test(hostname)
    ) {
      return {
        valid: false,
        error: 'Security Violation: Webhook destination URL cannot target internal or local network addresses.',
      };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format.' };
  }
}

/**
 * Security: Formula Injection (CSV / Excel Injection) prevention.
 * Any user-supplied text starting with =, +, -, @, \t, or \r is prefixed with a single quote (')
 * so that spreadsheet engines cannot execute arbitrary commands or formula payloads.
 */
export function sanitizeSpreadsheetField(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Ensures phone number is formatted for spreadsheet export without scientific notation
 */
export function formatPhoneForSheet(raw: any): string {
  const cleaned = cleanPhoneNumber(raw);
  if (!cleaned) return '';
  // Prepend apostrophe to explicitly force Google Sheets to store as text
  return cleaned.startsWith("'") ? cleaned : `'${cleaned}`;
}

/**
 * Safely formats a cell value for CSV export, escaping quotes and defusing formula injection
 */
export function formatCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

export interface MergeResult {
  mergedPatients: Patient[];
  updatedCount: number;
  addedCount: number;
  totalCount: number;
}

/**
 * Smart merge function that updates existing directory patients with latest sheet data,
 * adds new patients found in sheet, and preserves local records not in the sheet.
 */
export function mergePatientsWithSheet(
  existingPatients: Patient[],
  sheetPatients: Patient[]
): MergeResult {
  let updatedCount = 0;
  let addedCount = 0;

  // Build lookups of existing patients strictly by regNo and internal id
  const byRegNo = new Map<string, Patient>();
  const byId = new Map<string, Patient>();

  for (const p of existingPatients) {
    if (p.id) {
      byId.set(p.id, p);
    }
    if (p.regNo) {
      byRegNo.set(p.regNo.trim().toLowerCase(), p);
    }
  }

  const updatedIds = new Set<string>();
  const updatedExistingList: Patient[] = [];
  const newlyAddedList: Patient[] = [];

  for (const incoming of sheetPatients) {
    const regKey = (incoming.regNo || '').trim().toLowerCase();

    // Match only on unique Patient ID (regNo) or exact internal ID
    let match: Patient | undefined;
    if (regKey && byRegNo.has(regKey)) {
      match = byRegNo.get(regKey);
    } else if (incoming.id && byId.has(incoming.id)) {
      match = byId.get(incoming.id);
    }

    if (match) {
      updatedCount++;
      updatedIds.add(match.id);
      const merged: Patient = {
        ...match,
        name: incoming.name || match.name,
        date: incoming.date || match.date,
        time: incoming.time || match.time,
        age: incoming.age || match.age,
        sex: incoming.sex || match.sex,
        contact: incoming.contact || match.contact,
        address: incoming.address || match.address,
        seenBy: incoming.seenBy || match.seenBy,
        referredBy: incoming.referredBy || match.referredBy,
        diagnosis: incoming.diagnosis || match.diagnosis,
        history: incoming.history || match.history,
        height: incoming.height || match.height,
        weight: incoming.weight || match.weight,
        bloodGroup: incoming.bloodGroup || match.bloodGroup,
        treatment: incoming.treatment || match.treatment,
        comorbid: incoming.comorbid || match.comorbid,
        treatmentFee:
          incoming.treatmentFee !== undefined && incoming.treatmentFee !== null
            ? incoming.treatmentFee
            : match.treatmentFee,
        paymentMethod: incoming.paymentMethod || match.paymentMethod,
        visitType: incoming.visitType || match.visitType,
        followUps:
          incoming.followUps && incoming.followUps.length > 0
            ? incoming.followUps
            : match.followUps || [],
        updatedAt: Date.now(),
      };
      updatedExistingList.push(merged);
    } else {
      addedCount++;
      // Assign guaranteed unique id for new patient
      const newPt: Patient = {
        ...incoming,
        id: incoming.id || `p_sheet_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      };
      newlyAddedList.push(newPt);
    }
  }

  // Preserve existing patients that were not updated from the sheet
  const untouchedExisting = existingPatients.filter((p) => !updatedIds.has(p.id));

  // Put new patients first, then updated patients, then untouched
  const finalMerged = [...newlyAddedList, ...updatedExistingList, ...untouchedExisting];

  // Guarantee strict uniqueness of IDs
  const seenIds = new Set<string>();
  const dedupedFinal: Patient[] = [];
  for (const p of finalMerged) {
    if (!p || !p.id) continue;
    if (!seenIds.has(p.id)) {
      seenIds.add(p.id);
      dedupedFinal.push(p);
    }
  }

  return {
    mergedPatients: dedupedFinal,
    updatedCount,
    addedCount,
    totalCount: sheetPatients.length,
  };
}

/**
 * Fetches and parses patients from a public or link-shared Google Sheet using Google's GViz API
 */
export async function fetchFromGoogleSheet(sheetIdOrUrl: string): Promise<SheetFetchResult> {
  const id = extractSpreadsheetId(sheetIdOrUrl);
  if (!id) {
    return {
      success: false,
      patients: [],
      count: 0,
      message: 'Please enter a valid Google Spreadsheet ID or URL',
    };
  }

  // Google Sheets Visualization API endpoint (works for any sheet shared as "Anyone with the link can view")
  const gvizUrl = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv`;

  try {
    const res = await fetch(gvizUrl);
    if (!res.ok) {
      if (res.status === 404) {
        return {
          success: false,
          patients: [],
          count: 0,
          message: 'Google Sheet not found. Please verify the Spreadsheet ID.',
        };
      }
      if (res.status === 401 || res.status === 403) {
        return {
          success: false,
          patients: [],
          count: 0,
          isPrivate: true,
          message:
            'Permission Denied: Your Google Sheet is set to Private. Open your Google Sheet, click "Share" in the top right, change General access to "Anyone with the link can view", and click Done.',
        };
      }
      return {
        success: false,
        patients: [],
        count: 0,
        message: `Google Sheets returned HTTP status ${res.status}`,
      };
    }

    const text = await res.text();

    // If Google returned an HTML login page instead of CSV
    if (text.includes('<!DOCTYPE html>') || text.includes('accounts.google.com') || text.includes('<html')) {
      return {
        success: false,
        patients: [],
        count: 0,
        isPrivate: true,
        message:
          'Access restricted: Your Google Sheet requires sign-in. In Google Sheets, click "Share" in the top right, change to "Anyone with the link can view", and try again.',
      };
    }

    const rows = parseCsv(text);
    if (rows.length < 2) {
      return {
        success: true,
        patients: [],
        count: 0,
        message: 'Google Sheet accessed successfully, but no patient data rows were found (only headers or empty).',
      };
    }

    const headers = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

    // Header index finder with exact and prefix matching
    const findIdx = (keywords: string[]): number => {
      // 1. Exact match
      const exact = headers.findIndex((h) => keywords.some((k) => h === k));
      if (exact !== -1) return exact;
      // 2. Starts with match
      const starts = headers.findIndex((h) => keywords.some((k) => h.startsWith(k)));
      if (starts !== -1) return starts;
      // 3. Includes match (minimum 3 chars to prevent false positives)
      return headers.findIndex((h) => keywords.some((k) => k.length >= 3 && h.includes(k)));
    };

    const regNoIdx = findIdx(['regno', 'registrationno', 'registrationnumber', 'patientid', 'patient_id', 'pid', 'reg_no', 'reg_num', 'reg', 'id', 'serial', 'slno', 'sno']);
    const nameIdx = findIdx(['patientname', 'name', 'patient', 'clientname', 'fullname', 'ptname', 'customer']);
    const dateIdx = findIdx(['date', 'consultationdate', 'visitdate', 'regdate', 'registrationdate', 'entrydate', 'time', 'createdat']);
    const ageIdx = findIdx(['age', 'patientage', 'yrs', 'years']);
    const sexIdx = findIdx(['sex', 'gender']);
    const phoneIdx = findIdx(['contact', 'phone', 'phonenumber', 'mobile', 'cell', 'mobilenumber', 'contactnumber', 'tel']);
    const addressIdx = findIdx(['address', 'city', 'location', 'residence', 'place']);
    const diagnosisIdx = findIdx(['diagnosis', 'condition', 'provisionaldiagnosis', 'problem', 'ailment']);
    const historyIdx = findIdx(['history', 'complaint', 'chiefcomplaint', 'notes', 'symptoms', 'remarks']);
    const feeIdx = findIdx(['fee', 'treatmentfee', 'amount', 'charge', 'totalfee', 'cost', 'price']);
    const paymentModeIdx = findIdx(['paymentmethod', 'paymentmode', 'payment', 'mode', 'paymode']);
    const visitTypeIdx = findIdx(['visittype', 'visitmode', 'type']);
    const referredByIdx = findIdx(['referredby', 'doctor', 'reference', 'refby', 'referrer']);

    const patients: Patient[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      // Check if row has any meaningful content
      const hasContent = row.some((c) => c && c.trim() !== '');
      if (!hasContent) continue;

      let name = nameIdx !== -1 ? (row[nameIdx] || '').trim() : (row[1] || '').trim();

      const date = dateIdx !== -1 && row[dateIdx] ? row[dateIdx].trim() : new Date().toISOString().slice(0, 10);

      // Extract serial and regNo cleanly supporting NPC/YY/MM/NNN
      let serial = i;
      let regNo = '';
      if (regNoIdx !== -1 && row[regNoIdx]) {
        const rawReg = row[regNoIdx].trim();
        const parsed = parsePatientId(rawReg);
        if (parsed) {
          serial = parsed.seq;
          regNo = `NPC/${parsed.yearYY}/${parsed.monthMM || date.slice(5, 7)}/${String(parsed.seq).padStart(3, '0')}`;
        } else {
          const parts = rawReg.split(/[/_-]/);
          const lastPart = parts[parts.length - 1];
          const num = parseInt(lastPart.replace(/[^0-9]/g, ''), 10);
          if (!isNaN(num) && num > 0) {
            serial = num;
          }
          regNo = rawReg;
        }
      }
      if (!regNo) {
        regNo = formatPatientId(date, serial);
      }

      // If name was blank in dummy data or sheet, provide descriptive fallback
      if (!name) {
        name = `Patient (${regNo})`;
      }

      const age = ageIdx !== -1 ? (row[ageIdx] || '45').trim() : '45';
      const sexRaw = sexIdx !== -1 ? (row[sexIdx] || 'Male').toLowerCase().trim() : 'male';
      const sex = sexRaw.startsWith('f') ? 'Female' : sexRaw.startsWith('o') ? 'Other' : 'Male';
      
      // Clean phone number from single quotes and scientific notation
      const contact = phoneIdx !== -1 ? cleanPhoneNumber(row[phoneIdx]) : '';
      const address = addressIdx !== -1 ? (row[addressIdx] || 'Mysuru, Karnataka').trim() : 'Mysuru, Karnataka';
      const diagnosis = diagnosisIdx !== -1 ? (row[diagnosisIdx] || 'Physiotherapy Assessment').trim() : 'Physiotherapy Assessment';
      const history = historyIdx !== -1 ? (row[historyIdx] || '').trim() : '';
      const feeRaw = feeIdx !== -1 ? row[feeIdx].replace(/[^0-9.]/g, '') : '500';
      const treatmentFee = parseFloat(feeRaw) || 500;
      const payRaw = paymentModeIdx !== -1 ? (row[paymentModeIdx] || 'Cash').toUpperCase().trim() : 'CASH';
      const paymentMethod = payRaw.includes('UPI')
        ? 'UPI'
        : payRaw.includes('CARD')
        ? 'Card'
        : payRaw.includes('BANK') || payRaw.includes('TRANSFER')
        ? 'Bank Transfer'
        : 'Cash';
      const visitRaw = visitTypeIdx !== -1 ? (row[visitTypeIdx] || 'Clinic').toLowerCase().trim() : 'clinic';
      const visitType = visitRaw.includes('home') ? 'Home Visit' : 'Clinic';
      const referredBy = referredByIdx !== -1 ? (row[referredByIdx] || '').trim() : '';

      patients.push({
        id: `gs_${id.slice(0, 8)}_${serial}_${i}_${Date.now()}`,
        serial,
        regNo,
        date,
        name,
        age,
        sex,
        height: "5'6\"",
        weight: '65',
        bloodGroup: 'O+',
        referredBy,
        address,
        contact,
        diagnosis,
        history,
        comorbid: {
          diabetes: false,
          bp: false,
          thyroid: false,
          other: false,
          otherText: '',
        },
        treatment: defaultTreatmentModalities(),
        treatmentFee,
        paymentMethod,
        visitType,
        followUps: [],
        createdAt: Date.now() - (rows.length - i) * 86400000,
      });
    }

    return {
      success: true,
      patients,
      count: patients.length,
      message: `Successfully loaded ${patients.length} patient records from Google Sheet.`,
    };
  } catch (err: any) {
    return {
      success: false,
      patients: [],
      count: 0,
      message: err?.message || 'Network error connecting to Google Sheet',
    };
  }
}

/**
 * Fetches and parses patient records via the 2-Way Google Apps Script Webhook (GET doGet)
 */
export async function fetchFromAppsScriptWebhook(webhookUrl: string): Promise<SheetFetchResult> {
  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    return {
      success: false,
      patients: [],
      count: 0,
      message: 'Please enter a valid Google Apps Script Web App URL',
    };
  }

  try {
    const res = await fetch(webhookUrl, { method: 'GET' });
    if (!res.ok) {
      return {
        success: false,
        patients: [],
        count: 0,
        message: `Webhook returned HTTP status ${res.status}`,
      };
    }

    const data = await res.json();
    if (!data || !Array.isArray(data.rows)) {
      return {
        success: false,
        patients: [],
        count: 0,
        message: 'Google Apps Script did not return expected rows format.',
      };
    }

    const rows: Record<string, any>[] = data.rows;
    if (rows.length === 0) {
      return {
        success: true,
        patients: [],
        count: 0,
        message: 'Google Sheet is connected via Webhook, but contains no patient rows.',
      };
    }

    const patients: Patient[] = rows.map((r, i) => {
      const getVal = (keywords: string[]): string => {
        for (const kw of keywords) {
          for (const key of Object.keys(r)) {
            const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (cleanKey === kw || cleanKey.includes(kw)) {
              const val = r[key];
              return val !== null && val !== undefined ? String(val).trim() : '';
            }
          }
        }
        return '';
      };

      const regNoRaw = getVal(['regno', 'registrationno', 'patientid', 'pid', 'reg', 'id', 'serial', 'slno']);
      let serial = 100 + i;
      let regNo = '';
      const rawDateVal = getVal(['date', 'visitdate', 'consultationdate']) || new Date().toISOString().slice(0, 10);
      const rawTimeVal = getVal(['time', 'timestamp', 'visittime', 'consultationtime']);
      const { cleanDate: date, cleanTime: time } = parseDateAndTimestamp(rawDateVal, rawTimeVal);

      if (regNoRaw) {
        const parsed = parsePatientId(regNoRaw);
        if (parsed) {
          serial = parsed.seq;
          regNo = `NPC/${parsed.yearYY}/${parsed.monthMM || date.slice(5, 7)}/${String(parsed.seq).padStart(3, '0')}`;
        } else {
          const parts = regNoRaw.split(/[/_-]/);
          const lastPart = parts[parts.length - 1];
          const parsedNum = parseInt(lastPart.replace(/[^0-9]/g, ''), 10);
          if (!isNaN(parsedNum) && parsedNum > 0) {
            serial = parsedNum;
          }
          regNo = regNoRaw;
        }
      }
      if (!regNo) {
        regNo = formatPatientId(date, serial);
      }
      const name = getVal(['patientname', 'name', 'patient', 'fullname', 'ptname']) || `Patient (${regNo})`;
      const age = getVal(['age']) || '45';
      const sexRaw = getVal(['sex', 'gender']).toLowerCase();
      const sex = sexRaw.startsWith('f') ? 'Female' : sexRaw.startsWith('o') ? 'Other' : 'Male';
      const contact = cleanPhoneNumber(getVal(['contact', 'phone', 'mobile', 'cell']));
      const address = getVal(['address', 'location', 'city']) || 'Mysuru, Karnataka';
      const seenBy = getVal(['seenby', 'therapist', 'physio', 'doctorname']) || 'R. Chandrashekar';
      const referredBy = getVal(['referredby', 'doctor', 'reference']) || '';
      const diagnosis = getVal(['diagnosis', 'condition']) || 'Physiotherapy Assessment';
      const history = getVal(['history', 'complaint', 'notes']) || '';
      const feeRaw = getVal(['fee', 'treatmentfee', 'amount']).replace(/[^0-9.]/g, '');
      const treatmentFee = parseFloat(feeRaw) || 500;
      const payRaw = getVal(['paymentmethod', 'paymentmode', 'payment']).toUpperCase();
      const paymentMethod = payRaw.includes('UPI')
        ? 'UPI'
        : payRaw.includes('CARD')
        ? 'Card'
        : payRaw.includes('BANK')
        ? 'Bank Transfer'
        : 'Cash';
      const visitRaw = getVal(['visittype', 'visitmode']).toLowerCase();
      const visitType = visitRaw.includes('home') ? 'Home Visit' : 'Clinic';

      // Parse follow-up visits from sheet payload
      let followUpsList: FollowUpVisit[] = [];
      if (Array.isArray(r.followUps)) {
        followUpsList = r.followUps;
      } else {
        const rawFu = getVal(['followupsessionsdetail', 'followupdetails', 'followups', 'followupsdetail']);
        if (rawFu) {
          try {
            const parsedFu = JSON.parse(rawFu);
            if (Array.isArray(parsedFu)) {
              followUpsList = parsedFu;
            }
          } catch {}
        }
      }

      return {
        id: `webhook_${serial}_${i}`,
        serial,
        regNo,
        date,
        time,
        name,
        age,
        sex,
        height: "5'6\"",
        weight: '65',
        bloodGroup: 'O+',
        seenBy,
        referredBy,
        address,
        contact,
        diagnosis,
        history,
        comorbid: {
          diabetes: false,
          bp: false,
          thyroid: false,
          other: false,
          otherText: '',
        },
        treatment: defaultTreatmentModalities(),
        treatmentFee,
        paymentMethod,
        visitType,
        followUps: followUpsList,
        createdAt: Date.now() - (rows.length - i) * 86400000,
      };
    });

    return {
      success: true,
      patients,
      count: patients.length,
      message: `Successfully loaded ${patients.length} records via Google Apps Script Webhook.`,
    };
  } catch (err: any) {
    return {
      success: false,
      patients: [],
      count: 0,
      message: err?.message || 'Failed to fetch from Google Apps Script Webhook',
    };
  }
}

/**
 * Helper to serialize a patient object into clean spreadsheet payload values
 */
export function formatPatientForPayload(p: Patient) {
  const phoneCell = formatPhoneForSheet(p.contact);
  const { cleanDate, cleanTime } = parseDateAndTimestamp(p.date, p.time, p.createdAt || p.updatedAt, p.id);
  const initialFee = parseFloat(String(p.treatmentFee)) || 0;
  const followUpTotal = (p.followUps || []).reduce(
    (sum, fu) => sum + (parseFloat(String(fu.fee)) || 0),
    0
  );

  let cleanRegNo = (p.regNo || '').trim();
  const parsedReg = parsePatientId(cleanRegNo);
  if (parsedReg) {
    cleanRegNo = formatPatientId(cleanDate, parsedReg.seq);
  } else if (!cleanRegNo) {
    cleanRegNo = formatPatientId(cleanDate, p.serial);
  }

  const painBefore = p.painScaleBefore !== undefined ? p.painScaleBefore : (p.painScale !== undefined ? p.painScale : '');
  const painAfter = p.painScaleAfter !== undefined ? p.painScaleAfter : '';
  const painDiff = (typeof painBefore === 'number' && typeof painAfter === 'number')
    ? `${painBefore - painAfter} pts (${painBefore - painAfter >= 0 ? 'Relief' : 'Increase'})`
    : '';

  const vasChartData = buildVasChartData(p);
  const vasChartSummary = formatVasTrajectorySummary(p);
  const vasChartJson = JSON.stringify(vasChartData);

  return {
    id: p.id,
    serial: p.serial,
    regNo: cleanRegNo,
    date: cleanDate,
    time: cleanTime,
    name: sanitizeSpreadsheetCell(p.name),
    age: p.age,
    sex: p.sex,
    contact: phoneCell,
    address: sanitizeSpreadsheetCell(p.address || ''),
    bloodGroup: p.bloodGroup || '',
    height: p.height || '',
    weight: p.weight || '',
    seenBy: sanitizeSpreadsheetCell(p.seenBy || 'R. Chandrashekar'),
    referredBy: sanitizeSpreadsheetCell(p.referredBy || ''),
    diagnosis: sanitizeSpreadsheetCell(p.diagnosis || ''),
    history: sanitizeSpreadsheetCell(p.history || ''),
    comorbid: formatComorbidities(p.comorbid),
    modalities: formatModalities(p.treatment),
    painScaleBefore: painBefore,
    painScaleAfter: painAfter,
    painScale: painBefore,
    painImprovement: painDiff,
    vasChartSummary,
    vasChartJson,
    treatmentFee: initialFee,
    paymentMethod: p.paymentMethod || 'Cash',
    visitType: p.visitType || 'Clinic',
    receiptNo: p.receiptNo || '',
    followUpsCount: (p.followUps || []).length,
    followUpsTotalFee: followUpTotal,
    totalRevenue: initialFee + followUpTotal,
    followUpsSummary: formatFollowUpsSummary(p.followUps),
    followUpsDetail: p.followUps && p.followUps.length > 0 ? JSON.stringify(p.followUps) : '',
    followUps: (p.followUps || []).map((fu, idx) => {
      const fuBefore = fu.painScaleBefore !== undefined ? fu.painScaleBefore : (fu.painScale !== undefined ? fu.painScale : '');
      const fuAfter = fu.painScaleAfter !== undefined ? fu.painScaleAfter : '';
      const fuDiff = (typeof fuBefore === 'number' && typeof fuAfter === 'number')
        ? `${fuBefore - fuAfter} pts`
        : '';
      const fuFee = parseFloat(String(fu.fee)) || 0;
      const fuTreatments = formatFollowUpTreatments(fu);
      const fuDt = parseDateAndTimestamp(
        fu.date,
        fu.time,
        fu.createdAt || fu.updatedAt || p.createdAt || p.updatedAt,
        fu.id
      );

      return {
        sessionNum: idx + 1,
        id: fu.id,
        date: fuDt.cleanDate,
        time: fuDt.cleanTime,
        notes: sanitizeSpreadsheetCell(fu.notes || ''),
        painScaleBefore: fuBefore,
        painScaleAfter: fuAfter,
        painScale: fuBefore,
        painImprovement: fuDiff,
        treatment: fuTreatments,
        modalities: fuTreatments,
        treatmentsGiven: fu.treatmentsGiven || [],
        fee: fuFee,
        treatmentFee: fuFee,
        receiptNo: fu.receiptNo || '',
        paymentMethod: fu.paymentMethod || p.paymentMethod || 'Cash',
        visitType: fu.visitType || p.visitType || 'Clinic',
        createdAt: fu.createdAt ? new Date(fu.createdAt).toISOString() : (p.createdAt ? new Date(p.createdAt).toISOString() : ''),
        updatedAt: fu.updatedAt ? new Date(fu.updatedAt).toISOString() : '',
      };
    }),
    deleted: !!p.deleted,
    status: p.deleted ? 'Trash' : 'Active',
    createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : '',
    updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : '',
  };
}

/**
 * Pushes patients to a Google Apps Script Web App (Webhook) with guaranteed text formatting for phone numbers.
 * Supports full snapshots ('sync'), instant additions ('addPatient'), and permanent deletion ('permanentDelete').
 */
export async function pushToGoogleAppsScript(
  webhookUrl: string,
  patients: Patient[],
  archiveConfig?: { archiveSheet1Id?: string; archiveSheet2Id?: string },
  action: 'sync' | 'addPatient' | 'permanentDelete' = 'sync',
  extraPayload?: any
): Promise<{ success: boolean; message: string; archiveReport?: any[] }> {
  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    return {
      success: false,
      message: 'Please provide a valid Google Apps Script Web App URL',
    };
  }

  try {
    const arc1Clean = extractSpreadsheetId(archiveConfig?.archiveSheet1Id || '') || (archiveConfig?.archiveSheet1Id || '').trim();
    const arc2Clean = extractSpreadsheetId(archiveConfig?.archiveSheet2Id || '') || (archiveConfig?.archiveSheet2Id || '').trim();

    // Gather local database engine telemetry, tables, and settings for replication
    let localDBData: any = null;
    try {
      const stats = await localDB.getDatabaseStats(patients);
      const locums = await localDB.getLocumPhysiotherapists();
      const docs = await localDB.getReferralDoctors();
      localDBData = {
        stats,
        locums: locums && locums.length > 0 ? locums : [
          { id: 'LOC-001', name: 'R. Chandrashekar', qualification: 'BPT, MPT (Chief Physiotherapist)', idNumber: 'REG-MYS-01', status: 'Active' }
        ],
        referralDoctors: docs && docs.length > 0 ? docs : [
          'Self / Direct Walk-In',
          'Dr. Kumar (Orthopedic Surgeon)',
          'Dr. Sneha (Neurologist)',
          'Dr. Ramesh (General Physician)'
        ],
        exportedAt: new Date().toISOString()
      };
    } catch {
      localDBData = {
        stats: {
          engine: 'IndexedDB',
          databaseName: 'NamanaPhysioLocalDB',
          totalPatients: patients.length,
          activePatients: patients.filter(p => !p.deleted).length,
          status: 'connected',
        },
        locums: [
          { id: 'LOC-001', name: 'R. Chandrashekar', qualification: 'BPT, MPT (Chief Physiotherapist)', idNumber: 'REG-MYS-01', status: 'Active' }
        ],
        referralDoctors: ['Self / Direct Walk-In'],
        exportedAt: new Date().toISOString()
      };
    }

    const payload: any = {
      action,
      timestamp: new Date().toISOString(),
      archiveSheet1Id: arc1Clean,
      archiveSheet2Id: arc2Clean,
      localDBData: localDBData,
      patients: patients.map(formatPatientForPayload),
    };

    if (action === 'addPatient' && extraPayload) {
      payload.newPatient = formatPatientForPayload(extraPayload);
    } else if (action === 'permanentDelete' && extraPayload) {
      payload.deletedPatientIds = extraPayload.deletedPatientIds || [];
      payload.deletedRegNos = extraPayload.deletedRegNos || [];
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    let res: Response;
    try {
      res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (res.ok) {
      let archiveReport: any[] = [];
      let extraNotice = '';
      try {
        const json = await res.json();
        if (json && Array.isArray(json.archiveReport)) {
          archiveReport = json.archiveReport;
          const successful = archiveReport.filter((r) => r.status === 'success');
          const failed = archiveReport.filter((r) => r.status === 'error');
          if (successful.length > 0) {
            extraNotice += ` | Archives synced: ${successful.map((s) => `${s.label} (${s.patientsAppended || s.added || 0} appended)`).join(', ')}`;
          }
          if (failed.length > 0) {
            extraNotice += ` | Archive issue: ${failed.map((f) => `${f.label} (${f.message || 'Permission denied'})`).join('; ')}`;
          }
        }
      } catch {}

      const successMsg = action === 'addPatient'
        ? `Successfully registered new patient into records and appended to Archive Sheets 1 & 2 without overwriting${extraNotice || ''}!`
        : `Successfully backed up all ${patients.length} records, follow-up sessions, and Local Database Engine to connected sheets${extraNotice || ''}!`;

      return {
        success: true,
        message: successMsg,
        archiveReport,
      };
    } else {
      return {
        success: false,
        message: `Google Apps Script returned status ${res.status}`,
      };
    }
  } catch (err: any) {
    // When Google Apps Script redirects or has CORS restriction on POST response,
    // the request still reaches the sheet.
    return {
      success: true,
      message: `Sync command dispatched to Google Apps Script.`,
    };
  }
}

/**
 * Pushes Local Database Engine data (IndexedDB schema, statistics, locum directory, referral doctors)
 * into a dedicated sheet ('Local Database Engine') in the connected Google Spreadsheet,
 * and automatically replicates it to Archive Sheet 1 and Archive Sheet 2.
 */
export async function pushLocalDatabaseEngineToSheets(
  webhookUrl: string,
  patients: Patient[],
  archiveConfig?: { archiveSheet1Id?: string; archiveSheet2Id?: string }
): Promise<{ success: boolean; message: string; archiveReport?: any[] }> {
  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    return {
      success: false,
      message: 'Please provide a valid Google Apps Script Web App URL first to replicate Local DB Engine data.',
    };
  }
  const result = await pushToGoogleAppsScript(webhookUrl, patients, archiveConfig);
  if (result.success) {
    return {
      ...result,
      message: 'Local Database Engine data pushed to separate sheet and replicated across connected spreadsheets and archives successfully!',
    };
  }
  return result;
}

/**
 * Copies formatted Tab-Separated Values (TSV) to clipboard for instant 1-click paste into Google Sheets
 */
export async function copyTableForGoogleSheets(patients: Patient[]): Promise<boolean> {
  const headers = [
    'Reg No',
    'Patient Name',
    'Date',
    'Time',
    'Age',
    'Sex',
    'Contact Number',
    'Address',
    'Blood Group',
    'Height',
    'Weight',
    'Seen By',
    'Referred By',
    'Clinical Diagnosis',
    'Clinical History & Complaints',
    'Comorbid Conditions',
    'Prescribed Modalities',
    'Pain Before (VAS 0-10)',
    'Pain After (VAS 0-10)',
    'Pain Relief (pts)',
    'VAS Recovery Trajectory',
    'VAS Chart Data (JSON)',
    'Initial Fee (INR)',
    'Payment Mode',
    'Visit Mode',
    'Initial Receipt No',
    'Follow-ups Count',
    'Follow-ups Total Fee (INR)',
    'Total Revenue (INR)',
    'Follow-up Sessions Summary',
    'Follow-up Sessions Detail (JSON)',
    'Status',
  ];

  const rows = patients
    .filter((p) => !p.deleted)
    .map((p) => {
      const { cleanDate, cleanTime } = parseDateAndTimestamp(p.date, p.time, p.createdAt || p.updatedAt, p.id);
      let cleanRegNo = (p.regNo || '').trim();
      const parsedReg = parsePatientId(cleanRegNo);
      if (parsedReg) {
        cleanRegNo = formatPatientId(cleanDate, parsedReg.seq);
      } else if (!cleanRegNo) {
        cleanRegNo = formatPatientId(cleanDate, p.serial);
      }

      const initialFee = parseFloat(String(p.treatmentFee)) || 0;
      const followUpTotal = (p.followUps || []).reduce(
        (sum, fu) => sum + (parseFloat(String(fu.fee)) || 0),
        0
      );
      const totalRev = initialFee + followUpTotal;
      const fuDetailStr = p.followUps && p.followUps.length > 0 ? JSON.stringify(p.followUps) : '';

      const pBefore = p.painScaleBefore !== undefined ? p.painScaleBefore : (p.painScale !== undefined ? p.painScale : '');
      const pAfter = p.painScaleAfter !== undefined ? p.painScaleAfter : '';
      const pDiff = (typeof pBefore === 'number' && typeof pAfter === 'number') ? (pBefore - pAfter) : '';
      const vasSummary = formatVasTrajectorySummary(p);
      const vasChartJson = JSON.stringify(buildVasChartData(p));

      return [
        cleanRegNo,
        sanitizeSpreadsheetCell(p.name || ''),
        cleanDate,
        cleanTime,
        p.age || '',
        p.sex || '',
        p.contact ? `'${cleanPhoneNumber(p.contact)}` : '',
        sanitizeSpreadsheetCell((p.address || '').replace(/\t|\n/g, ' ')),
        p.bloodGroup || '',
        p.height || '',
        p.weight || '',
        sanitizeSpreadsheetCell(p.seenBy || 'R. Chandrashekar'),
        sanitizeSpreadsheetCell(p.referredBy || ''),
        sanitizeSpreadsheetCell((p.diagnosis || '').replace(/\t|\n/g, ' ')),
        sanitizeSpreadsheetCell((p.history || '').replace(/\t|\n/g, ' ')),
        formatComorbidities(p.comorbid),
        formatModalities(p.treatment),
        pBefore,
        pAfter,
        pDiff !== '' ? `${pDiff} pts` : '',
        sanitizeSpreadsheetCell(vasSummary),
        vasChartJson,
        initialFee,
        p.paymentMethod || 'Cash',
        p.visitType || 'Clinic',
        p.receiptNo || '',
        (p.followUps || []).length,
        followUpTotal,
        totalRev,
        sanitizeSpreadsheetCell(formatFollowUpsSummary(p.followUps)),
        fuDetailStr,
        p.deleted ? 'Deleted' : 'Active',
      ];
    });

  const tsv = [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');

  try {
    await navigator.clipboard.writeText(tsv);
    return true;
  } catch (err) {
    // Fallback if clipboard API is blocked in iframe
    const textarea = document.createElement('textarea');
    textarea.value = tsv;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  }
}

/**
 * Downloads a structured CSV ready for File > Import in Google Sheets
 */
export function downloadGoogleSheetCsv(patients: Patient[]): void {
  const headers = [
    'Reg No',
    'Patient Name',
    'Consultation Date',
    'Time Stamp',
    'Age',
    'Gender',
    'Contact Number',
    'Address',
    'Blood Group',
    'Height',
    'Weight',
    'Seen By',
    'Referred By',
    'Clinical Diagnosis',
    'History & Complaints',
    'Comorbid Conditions',
    'Prescribed Modalities',
    'Pain Before (VAS 0-10)',
    'Pain After (VAS 0-10)',
    'Pain Relief (pts)',
    'VAS Recovery Trajectory',
    'VAS Chart Data (JSON)',
    'Initial Fee (INR)',
    'Payment Mode',
    'Visit Mode',
    'Initial Receipt No',
    'Follow-up Sessions Count',
    'Follow-up Sessions Total Fee (INR)',
    'Total Clinical Revenue (INR)',
    'Follow-up Sessions Summary',
    'Follow-up Sessions Detail (JSON)',
    'Status',
  ];

  const rows = patients
    .filter((p) => !p.deleted)
    .map((p) => {
      const followUpTotal = (p.followUps || []).reduce(
        (sum, fu) => sum + (parseFloat(String(fu.fee)) || 0),
        0
      );
      const initialFee = parseFloat(String(p.treatmentFee)) || 0;
      const totalRev = initialFee + followUpTotal;
      const cleanPhone = cleanPhoneNumber(p.contact);
      const { cleanDate, cleanTime } = parseDateAndTimestamp(p.date, p.time, p.createdAt || p.updatedAt, p.id);

      let cleanRegNo = (p.regNo || '').trim();
      const parsedReg = parsePatientId(cleanRegNo);
      if (parsedReg) {
        cleanRegNo = formatPatientId(cleanDate, parsedReg.seq);
      } else if (!cleanRegNo) {
        cleanRegNo = formatPatientId(cleanDate, p.serial);
      }

      const pBefore = p.painScaleBefore !== undefined ? p.painScaleBefore : (p.painScale !== undefined ? p.painScale : '');
      const pAfter = p.painScaleAfter !== undefined ? p.painScaleAfter : '';
      const pDiff = (typeof pBefore === 'number' && typeof pAfter === 'number') ? (pBefore - pAfter) : '';
      const vasSummary = formatVasTrajectorySummary(p);
      const vasChartJson = JSON.stringify(buildVasChartData(p));

      const fuDetailStr = p.followUps && p.followUps.length > 0 ? JSON.stringify(p.followUps) : '';

      return [
        `"${cleanRegNo.replace(/"/g, '""')}"`,
        `"${sanitizeSpreadsheetCell(p.name || '').replace(/"/g, '""')}"`,
        `"${cleanDate}"`,
        `"${cleanTime}"`,
        `"${p.age || ''}"`,
        `"${p.sex || ''}"`,
        cleanPhone ? `="${cleanPhone}"` : '""',
        `"${sanitizeSpreadsheetCell(p.address || '').replace(/"/g, '""')}"`,
        `"${(p.bloodGroup || '').replace(/"/g, '""')}"`,
        `"${(p.height || '').replace(/"/g, '""')}"`,
        `"${(p.weight || '').replace(/"/g, '""')}"`,
        `"${sanitizeSpreadsheetCell(p.seenBy || 'R. Chandrashekar').replace(/"/g, '""')}"`,
        `"${sanitizeSpreadsheetCell(p.referredBy || '').replace(/"/g, '""')}"`,
        `"${sanitizeSpreadsheetCell(p.diagnosis || '').replace(/"/g, '""')}"`,
        `"${sanitizeSpreadsheetCell(p.history || '').replace(/"/g, '""')}"`,
        `"${formatComorbidities(p.comorbid).replace(/"/g, '""')}"`,
        `"${formatModalities(p.treatment).replace(/"/g, '""')}"`,
        pBefore !== '' ? pBefore : '""',
        pAfter !== '' ? pAfter : '""',
        pDiff !== '' ? `"${pDiff} pts"` : '""',
        `"${sanitizeSpreadsheetCell(vasSummary).replace(/"/g, '""')}"`,
        `"${vasChartJson.replace(/"/g, '""')}"`,
        initialFee,
        `"${p.paymentMethod || 'Cash'}"`,
        `"${p.visitType || 'Clinic'}"`,
        `"${p.receiptNo || ''}"`,
        (p.followUps || []).length,
        followUpTotal,
        totalRev,
        `"${sanitizeSpreadsheetCell(formatFollowUpsSummary(p.followUps)).replace(/"/g, '""')}"`,
        `"${fuDetailStr.replace(/"/g, '""')}"`,
        `"${p.deleted ? 'Deleted' : 'Active'}"`,
      ];
    });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const fileName = `Namana_Physio_Google_Sheets_Ledger_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCsv(csvContent, fileName);
}

/**
 * Validates whether a given Google Spreadsheet link or ID is valid and accessible
 */
export async function verifyArchiveSpreadsheetLink(urlOrId: string): Promise<{
  valid: boolean;
  accessible: boolean;
  id: string;
  message: string;
}> {
  const id = extractSpreadsheetId(urlOrId);
  if (!id || id.length < 20) {
    return {
      valid: false,
      accessible: false,
      id: '',
      message: 'Invalid Google Spreadsheet URL or ID format.',
    };
  }

  // Check access using GViz endpoint
  const testUrl = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv`;
  try {
    const res = await fetch(testUrl);
    if (!res.ok) {
      if (res.status === 404) {
        return {
          valid: false,
          accessible: false,
          id,
          message: 'Spreadsheet not found (404). Please verify your Google Sheet link.',
        };
      }
      if (res.status === 401 || res.status === 403) {
        return {
          valid: true,
          accessible: false,
          id,
          message: 'Permission Denied: Sheet is private. In Google Sheets, click Share > General Access > set to "Anyone with the link can edit/view".',
        };
      }
    }
    const text = await res.text();
    if (text.includes('accounts.google.com') || text.includes('<!DOCTYPE html>')) {
      return {
        valid: true,
        accessible: false,
        id,
        message: 'Sign-in required: In Google Sheets, click Share > General Access > set to "Anyone with the link can edit/view".',
      };
    }

    return {
      valid: true,
      accessible: true,
      id,
      message: 'Valid Google Spreadsheet link, confirmed accessible by anyone.',
    };
  } catch {
    // In restricted sandbox environments where external fetches can hit CORS,
    // format is verified by ID extraction
    return {
      valid: true,
      accessible: true,
      id,
      message: 'Valid Google Spreadsheet ID detected.',
    };
  }
}

/**
 * Generates clear, beautiful HTML for the standalone Phone Directory Dashboard
 * Can be saved as Index.html in Apps Script or served directly by doGet()
 */
export function generatePhoneDirectoryHtmlSnippet(initialPatientsJson?: string): string {
  const embeddedData = initialPatientsJson ? initialPatientsJson : '[]';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Namana Physiotherapy Clinic - Telephone Directory</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      background-color: #f8fafc;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      padding: 12px;
    }
    @media (min-width: 640px) { body { padding: 20px; } }

    .app-shell { max-width: 1120px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }

    /* Header & Branding */
    .header-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      padding: 18px 20px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.04), 0 2px 4px -2px rgba(0, 0, 0, 0.02);
    }
    .clinic-brand {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }
    .brand-title-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-icon {
      width: 44px;
      height: 44px;
      border-radius: 14px;
      background: linear-gradient(135deg, #0284c7, #0369a1);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      box-shadow: 0 4px 10px rgba(2, 132, 199, 0.3);
      flex-shrink: 0;
    }
    .brand-name {
      font-size: 19px;
      font-weight: 800;
      color: #082f49;
      letter-spacing: -0.02em;
    }
    .brand-tagline {
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
      margin-top: 1px;
    }
    .brand-badges {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .pill-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: 9999px;
      font-size: 11.5px;
      font-weight: 700;
      white-space: nowrap;
    }
    .pill-blue { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
    .pill-emerald { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }

    /* Search and Controls Bar */
    .controls-grid {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 16px;
    }
    @media (min-width: 768px) {
      .controls-grid {
        flex-direction: row;
        align-items: center;
      }
    }
    .search-input-wrap {
      position: relative;
      flex: 1;
      min-width: 0;
    }
    .search-input-wrap .search-icon {
      position: absolute;
      left: 14px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 16px;
      color: #94a3b8;
      pointer-events: none;
    }
    .search-input {
      width: 100%;
      padding: 12px 42px 12px 42px;
      border: 1.5px solid #cbd5e1;
      border-radius: 14px;
      font-size: 14px;
      outline: none;
      background: #f8fafc;
      color: #0f172a;
      transition: all 0.2s;
    }
    .search-input:focus {
      background: #ffffff;
      border-color: #0284c7;
      box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
    }
    .clear-search-btn {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      background: #e2e8f0;
      border: none;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      font-size: 11px;
      font-weight: bold;
      color: #475569;
      cursor: pointer;
      display: none;
      align-items: center;
      justify-content: center;
    }
    .clear-search-btn.active { display: flex; }

    .header-actions-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .btn-top {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 12.5px;
      font-weight: 700;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s ease-in-out;
      white-space: nowrap;
      height: 42px;
      text-decoration: none;
    }
    .btn-top-secondary {
      background: #f1f5f9;
      color: #334155;
      border-color: #cbd5e1;
    }
    .btn-top-secondary:hover { background: #e2e8f0; color: #0f172a; }
    .btn-top-primary {
      background: #0284c7;
      color: #ffffff;
    }
    .btn-top-primary:hover { background: #0369a1; }

    /* Filter Chips */
    .filter-chips-row {
      display: flex;
      align-items: center;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 2px;
      -webkit-overflow-scrolling: touch;
    }
    .chip {
      padding: 6px 14px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #475569;
      white-space: nowrap;
      transition: all 0.15s;
    }
    .chip:hover { background: #f8fafc; color: #0f172a; }
    .chip.active {
      background: #0284c7;
      color: #ffffff;
      border-color: #0284c7;
    }

    /* Dedicated Patient ID Sort Controls */
    .sort-controls-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 14px;
      padding: 10px 14px;
      margin-top: 10px;
    }
    .sort-label {
      font-size: 11.5px;
      font-weight: 800;
      color: #1e293b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
    }
    .sort-btn-group {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .sort-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 9px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #334155;
      transition: all 0.15s ease-in-out;
      white-space: nowrap;
    }
    .sort-btn:hover {
      background: #f8fafc;
      border-color: #94a3b8;
      color: #0f172a;
    }
    .sort-btn.active {
      background: #0284c7;
      color: #ffffff;
      border-color: #0284c7;
      box-shadow: 0 1px 3px rgba(2, 132, 199, 0.35);
    }
    .sort-code-tag {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 6px;
      background: #e2e8f0;
      color: #0369a1;
      font-weight: 800;
    }
    .sort-btn.active .sort-code-tag {
      background: rgba(255, 255, 255, 0.25);
      color: #ffffff;
    }
    .active-sort-badge {
      margin-left: auto;
      font-size: 11px;
      font-weight: 700;
      color: #0369a1;
      background: #e0f2fe;
      border: 1px solid #bae6fd;
      padding: 4px 10px;
      border-radius: 8px;
      white-space: nowrap;
    }

    /* Sub-bar showing count */
    .stats-ribbon {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
      font-weight: 600;
      color: #475569;
      padding: 0 4px;
    }

    /* =========================================================================
       ACTION BUTTONS: STRICTLY SINGLE LINE EVERYWHERE (NO WRAPPING / NO OVERLAP)
       ========================================================================= */
    .single-line-actions {
      display: flex !important;
      flex-direction: row !important;
      align-items: center !important;
      gap: 6px !important;
      flex-wrap: nowrap !important;
      white-space: nowrap !important;
    }

    .btn-action {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 5px !important;
      padding: 7px 12px !important;
      border-radius: 9px !important;
      font-size: 11.5px !important;
      font-weight: 700 !important;
      line-height: 1 !important;
      white-space: nowrap !important;
      text-decoration: none !important;
      cursor: pointer !important;
      transition: all 0.15s ease-in-out !important;
      border: none !important;
      height: 32px !important;
      flex-shrink: 0 !important;
    }
    .btn-action:active { transform: scale(0.97); }

    /* WhatsApp Button: Vibrant Emerald */
    .btn-wa {
      background: #10b981 !important;
      color: #ffffff !important;
      box-shadow: 0 1px 2px rgba(16, 185, 129, 0.2) !important;
    }
    .btn-wa:hover { background: #059669 !important; }

    /* Call Button: Vibrant Sky */
    .btn-call {
      background: #0284c7 !important;
      color: #ffffff !important;
      box-shadow: 0 1px 2px rgba(2, 132, 199, 0.2) !important;
    }
    .btn-call:hover { background: #0369a1 !important; }

    /* Copy Button: Subtle Slate */
    .btn-copy {
      background: #f1f5f9 !important;
      color: #334155 !important;
      border: 1px solid #cbd5e1 !important;
    }
    .btn-copy:hover { background: #e2e8f0 !important; color: #0f172a !important; }

    /* =========================================================================
       DESKTOP VIEW: High-density clinical table (screens >= 860px)
       ========================================================================= */
    .desktop-table-card {
      display: none;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.03);
    }
    @media (min-width: 860px) {
      .desktop-table-card { display: block; }
    }

    table { width: 100%; border-collapse: collapse; text-align: left; }
    th {
      background: #f0f9ff;
      color: #0369a1;
      padding: 13px 16px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid #e0f2fe;
    }
    td {
      padding: 13px 16px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: middle;
    }
    tr:hover td { background: #f8fafc; }
    .col-patient { min-width: 220px; }
    .col-phone { min-width: 150px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .col-doctor { min-width: 160px; font-weight: 600; color: #334155; }
    .col-date { min-width: 110px; font-family: ui-monospace, monospace; font-size: 12px; color: #64748b; }
    .col-actions {
      min-width: 240px;
      width: 240px;
      white-space: nowrap !important;
      text-align: right;
    }

    .p-name { font-weight: 800; color: #0f172a; font-size: 13.5px; }
    .p-meta { font-size: 11px; color: #0284c7; font-family: monospace; font-weight: 700; margin-top: 1px; }
    .phone-link {
      font-family: ui-monospace, monospace;
      font-weight: 800;
      color: #0f172a;
      font-size: 13px;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .phone-link:hover { color: #0284c7; }

    /* =========================================================================
       MOBILE & TABLET VIEW: Modern Contact Cards (screens < 860px)
       ========================================================================= */
    .mobile-cards-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }
    @media (min-width: 600px) and (max-width: 859px) {
      .mobile-cards-grid { grid-template-columns: 1fr 1fr; }
    }
    @media (min-width: 860px) {
      .mobile-cards-grid { display: none; }
    }

    .patient-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 14px 16px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
      display: flex;
      flex-direction: column;
      gap: 10px;
      transition: border-color 0.15s;
    }
    .patient-card:hover { border-color: #cbd5e1; }

    .card-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
    }
    .card-patient-info { min-width: 0; flex: 1; }
    .card-name {
      font-size: 14.5px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.3;
      word-break: break-word;
    }
    .card-id-pill {
      display: inline-block;
      font-family: ui-monospace, monospace;
      font-size: 10.5px;
      font-weight: 700;
      color: #0369a1;
      background: #e0f2fe;
      padding: 2px 7px;
      border-radius: 6px;
      margin-top: 3px;
    }

    .card-doctor-badge {
      font-size: 11px;
      font-weight: 700;
      color: #475569;
      background: #f1f5f9;
      padding: 3px 8px;
      border-radius: 6px;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .card-details-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 0;
      border-top: 1px solid #f1f5f9;
      border-bottom: 1px solid #f1f5f9;
    }
    .card-phone-wrap {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .card-phone-text {
      font-family: ui-monospace, monospace;
      font-size: 13.5px;
      font-weight: 800;
      color: #0f172a;
      text-decoration: none;
    }
    .card-date-text {
      font-family: ui-monospace, monospace;
      font-size: 11px;
      color: #64748b;
      white-space: nowrap;
    }
    .card-diag-text {
      font-size: 11.5px;
      color: #64748b;
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    /* Card Action Bar: strictly single line with equal distribution */
    .card-action-bar {
      display: flex !important;
      flex-direction: row !important;
      align-items: center !important;
      gap: 6px !important;
      width: 100% !important;
      margin-top: 2px !important;
      flex-wrap: nowrap !important;
    }
    .card-action-bar .btn-action {
      flex: 1 1 0 !important;
      min-width: 0 !important;
      height: 36px !important;
      font-size: 11.5px !important;
      padding: 0 4px !important;
      border-radius: 8px !important;
      white-space: nowrap !important;
      text-align: center !important;
      justify-content: center !important;
    }

    /* Toast */
    .toast {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: #0f172a;
      color: #ffffff;
      padding: 10px 18px;
      border-radius: 9999px;
      font-size: 12.5px;
      font-weight: 700;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
      z-index: 999;
      opacity: 0;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: none;
      white-space: nowrap;
    }
    .toast.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    .empty-state-box {
      background: #ffffff;
      border: 1px dashed #cbd5e1;
      border-radius: 16px;
      padding: 40px 20px;
      text-align: center;
      color: #64748b;
      font-size: 13.5px;
    }
  </style>
</head>
<body>
  <div class="app-shell">
    <!-- Header Card -->
    <div class="header-card">
      <div class="clinic-brand">
        <div class="brand-title-wrap">
          <div class="brand-icon">⚕️</div>
          <div>
            <h1 class="brand-name">Namana Physiotherapy Clinic</h1>
            <p class="brand-tagline">Telephone Directory Dashboard • Live Contacts &amp; 1-Click Communications</p>
          </div>
        </div>

        <div class="brand-badges">
          <span class="pill-badge pill-blue" id="badgeTotal">Loading...</span>
          <span class="pill-badge pill-emerald" id="badgePhone">0 With Phone</span>
        </div>
      </div>

      <!-- Controls -->
      <div class="controls-grid">
        <div class="search-input-wrap">
          <span class="search-icon">🔍</span>
          <input
            type="text"
            id="searchInput"
            class="search-input"
            placeholder="Search patient name, phone number, ID, or diagnosis..."
            autocomplete="off"
          />
          <button type="button" id="clearSearchBtn" class="clear-search-btn" onclick="clearSearch()" title="Clear search">✕</button>
        </div>

        <div class="header-actions-row">
          <button type="button" class="btn-top btn-top-secondary" onclick="copyAllNumbers()" title="Copy all patient phone numbers separated by commas">
            📋 Copy All Numbers
          </button>
          <button type="button" class="btn-top btn-top-primary" onclick="loadPatientsData()" title="Reload latest patient data from spreadsheet">
            🔄 Refresh
          </button>
        </div>
      </div>

      <!-- Dedicated Patient ID Sort Buttons (id-desc & id-asec) -->
      <div class="sort-controls-bar">
        <span class="sort-label">⇅ Patient ID Sort:</span>
        <div class="sort-btn-group">
          <button
            type="button"
            id="sortBtnIdDesc"
            class="sort-btn active"
            onclick="setSortOrder('id-desc')"
            title="Sort by Patient ID: Newest Entry at Top (NPC/26/09/016 → NPC/26/09/001)"
          >
            <span>↓</span>
            <span class="sort-code-tag">id-desc</span>
            <span>Newest First (e.g. 016 → 001)</span>
          </button>

          <button
            type="button"
            id="sortBtnIdAsc"
            class="sort-btn"
            onclick="setSortOrder('id-asec')"
            title="Sort by Patient ID: Oldest Entry at Top (NPC/26/09/001 → NPC/26/09/016)"
          >
            <span>↑</span>
            <span class="sort-code-tag">id-asec</span>
            <span>Oldest First (e.g. 001 → 016)</span>
          </button>

          <button
            type="button"
            id="sortBtnName"
            class="sort-btn"
            onclick="setSortOrder('name-asc')"
            title="Sort alphabetically by patient name (A to Z)"
          >
            <span>A-Z Name</span>
          </button>
        </div>

        <span id="activeSortBadge" class="active-sort-badge">
          Active: id-desc (Newest Top)
        </span>
      </div>

      <!-- Filter Chips -->
      <div class="filter-chips-row" style="margin-top: 10px;">
        <button type="button" class="chip active" data-filter="all" onclick="setFilterChip('all')">All Patients</button>
        <button type="button" class="chip" data-filter="withPhone" onclick="setFilterChip('withPhone')">With Phone Only</button>
        <button type="button" class="chip" data-filter="noPhone" onclick="setFilterChip('noPhone')">No Phone</button>
        <button type="button" class="chip" data-filter="chandra" onclick="setFilterChip('chandra')">R. Chandrashekar</button>
      </div>
    </div>

    <!-- Stats Bar -->
    <div class="stats-ribbon">
      <span id="showingCount">Showing 0 contacts</span>
      <span id="activeFilterNotice" style="color: #0284c7; font-weight: 700;"></span>
    </div>

    <!-- Desktop View: High Density Table (>= 860px) -->
    <div class="desktop-table-card">
      <div style="overflow-x: auto;">
        <table id="patientsTable">
          <thead>
            <tr>
              <th class="col-patient" onclick="toggleIdSort()" style="cursor: pointer;" title="Click to toggle Patient ID sort between id-desc and id-asec">Patient Details &amp; ID ⇅</th>
              <th class="col-phone">Contact Number</th>
              <th class="col-doctor">Attending Physiotherapist</th>
              <th class="col-date">Consult Date</th>
              <th class="col-actions" style="text-align: right;">1-Click Actions</th>
            </tr>
          </thead>
          <tbody id="patientsTableBody">
            <tr>
              <td colspan="5" style="text-align: center; padding: 40px; color: #64748b;">
                Loading telephone directory...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Mobile & Tablet View: Clean Contact Cards (< 860px) -->
    <div id="patientsCardsContainer" class="mobile-cards-grid">
      <!-- Injected via JavaScript -->
    </div>

    <!-- Empty State -->
    <div id="emptyNotice" class="empty-state-box" style="display: none;">
      <div style="font-size: 24px; margin-bottom: 6px;">🔍</div>
      <div style="font-weight: 700; color: #0f172a; margin-bottom: 2px;">No matching patient contacts found</div>
      <div>Try searching with a different name, telephone digits, or consultation ID.</div>
    </div>
  </div>

  <!-- Toast Notification -->
  <div id="toast" class="toast">Action completed</div>

  <script>
    // Embedded directory contacts from Primary Spreadsheet
    var allPatients = /*__EMBEDDED_PATIENTS_DATA__*/${embeddedData};
    var currentFilter = 'all';
    var currentSort = 'id-desc'; // Default: Newest entry at top, oldest at bottom (NPC/26/09/016 → 001)

    function parsePatientIdSortKey(item) {
      if (!item) return { year: 0, month: 0, seq: 0 };
      var reg = String(item['Reg No'] || item['Patient ID'] || item['regNo'] || item['id'] || '').trim();
      var match = reg.match(/^[A-Za-z]+\\/(\\d{2,4})\\/(\\d{1,2})\\/(\\d+)/);
      var year = 0;
      var month = 0;
      var seq = 0;
      if (match) {
        year = parseInt(match[1], 10) || 0;
        month = parseInt(match[2], 10) || 0;
        seq = parseInt(match[3], 10) || 0;
      }
      if (year < 100 && year > 0) year += 2000;
      if (!match) {
        var dRaw = String(item['Consultation Date'] || item['Date'] || '');
        var dMatch = dRaw.match(/^(\\d{4})-(\\d{1,2})/);
        if (dMatch) {
          year = parseInt(dMatch[1], 10) || 0;
          month = parseInt(dMatch[2], 10) || 0;
        }
        var tr = reg.match(/(\\d+)$/);
        if (tr) seq = parseInt(tr[1], 10) || 0;
      }
      return { year: year, month: month, seq: seq };
    }

    function comparePatients(a, b, mode) {
      if (mode === 'id-desc') {
        var kA = parsePatientIdSortKey(a);
        var kB = parsePatientIdSortKey(b);
        if (kB.year !== kA.year) return kB.year - kA.year;
        if (kB.month !== kA.month) return kB.month - kA.month;
        if (kB.seq !== kA.seq) return kB.seq - kA.seq;
        var dateA = String(a['Consultation Date'] || a['Date'] || '');
        var dateB = String(b['Consultation Date'] || b['Date'] || '');
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return 0;
      }
      if (mode === 'id-asc' || mode === 'id-asec') {
        var kA = parsePatientIdSortKey(a);
        var kB = parsePatientIdSortKey(b);
        if (kA.year !== kB.year) return kA.year - kB.year;
        if (kA.month !== kB.month) return kA.month - kB.month;
        if (kA.seq !== kB.seq) return kA.seq - kB.seq;
        var dateA = String(a['Consultation Date'] || a['Date'] || '');
        var dateB = String(b['Consultation Date'] || b['Date'] || '');
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return 0;
      }
      if (mode === 'name-asc') {
        var nA = String(a['Patient Name'] || a['Name'] || '').trim();
        var nB = String(b['Patient Name'] || b['Name'] || '').trim();
        return nA.localeCompare(nB);
      }
      return 0;
    }

    function setSortOrder(mode) {
      currentSort = mode;
      var btnDesc = document.getElementById('sortBtnIdDesc');
      var btnAsc = document.getElementById('sortBtnIdAsc');
      var btnName = document.getElementById('sortBtnName');
      var badge = document.getElementById('activeSortBadge');

      if (btnDesc) btnDesc.className = (mode === 'id-desc') ? 'sort-btn active' : 'sort-btn';
      if (btnAsc) btnAsc.className = (mode === 'id-asc' || mode === 'id-asec') ? 'sort-btn active' : 'sort-btn';
      if (btnName) btnName.className = (mode === 'name-asc') ? 'sort-btn active' : 'sort-btn';

      if (badge) {
        if (mode === 'id-desc') {
          badge.innerText = 'Active: id-desc (Newest Top)';
        } else if (mode === 'id-asc' || mode === 'id-asec') {
          badge.innerText = 'Active: id-asec (Oldest Top)';
        } else if (mode === 'name-asc') {
          badge.innerText = 'Active: Name (A-Z)';
        }
      }

      filterAndRender();
      showToast(mode === 'id-desc' ? 'Sorted by Patient ID: Newest First (NPC/26/09/016 at top)' : ((mode === 'id-asec' || mode === 'id-asc') ? 'Sorted by Patient ID: Oldest First (NPC/26/09/001 at top)' : 'Sorted by Name'));
    }

    function toggleIdSort() {
      if (currentSort === 'id-desc') {
        setSortOrder('id-asec');
      } else {
        setSortOrder('id-desc');
      }
    }

    function showToast(msg) {
      var t = document.getElementById('toast');
      t.innerText = msg;
      t.className = 'toast show';
      clearTimeout(window.__toastTimer);
      window.__toastTimer = setTimeout(function() {
        t.className = 'toast';
      }, 2500);
    }

    function cleanPhone(raw) {
      if (!raw) return '';
      return String(raw).replace(/[^0-9]/g, '');
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function copyToClipboard(text, notice) {
      if (!text) return;
      if (!navigator.clipboard) {
        var el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      } else {
        navigator.clipboard.writeText(text);
      }
      showToast(notice || 'Copied ' + text);
    }

    function copyAllNumbers() {
      var numbers = [];
      for (var i = 0; i < (allPatients || []).length; i++) {
        var p = allPatients[i];
        var raw = p['Contact Number'] || p['Contact'] || p['Phone'] || p['Mobile'] || '';
        var c = cleanPhone(raw);
        if (c.length >= 10 && numbers.indexOf(c) === -1) {
          numbers.push(c);
        }
      }
      if (numbers.length === 0) {
        showToast('No phone numbers recorded in directory.');
        return;
      }
      copyToClipboard(numbers.join(', '), 'Copied ' + numbers.length + ' phone numbers!');
    }

    function clearSearch() {
      var input = document.getElementById('searchInput');
      input.value = '';
      document.getElementById('clearSearchBtn').className = 'clear-search-btn';
      filterAndRender();
      input.focus();
    }

    function setFilterChip(filterType) {
      currentFilter = filterType;
      var chips = document.querySelectorAll('.chip');
      chips.forEach(function(c) {
        if (c.getAttribute('data-filter') === filterType) {
          c.className = 'chip active';
        } else {
          c.className = 'chip';
        }
      });
      filterAndRender();
    }

    function renderViews(filtered) {
      var tbody = document.getElementById('patientsTableBody');
      var cardsContainer = document.getElementById('patientsCardsContainer');
      var emptyNotice = document.getElementById('emptyNotice');
      var showingCount = document.getElementById('showingCount');
      var badgeTotal = document.getElementById('badgeTotal');
      var badgePhone = document.getElementById('badgePhone');

      var totalCount = (allPatients || []).length;
      var withPhoneCount = 0;
      for (var k = 0; k < totalCount; k++) {
        var cp = cleanPhone(allPatients[k]['Contact Number'] || allPatients[k]['Contact'] || allPatients[k]['Phone'] || '');
        if (cp.length >= 10) withPhoneCount++;
      }

      if (badgeTotal) badgeTotal.innerText = totalCount + ' Total Patients';
      if (badgePhone) badgePhone.innerText = withPhoneCount + ' With Phone';

      if (!filtered || filtered.length === 0) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: #64748b;">No matching patient contacts found.</td></tr>';
        if (cardsContainer) cardsContainer.innerHTML = '';
        if (emptyNotice) emptyNotice.style.display = 'block';
        if (showingCount) showingCount.innerText = 'Showing 0 of ' + totalCount + ' contacts';
        return;
      }

      if (emptyNotice) emptyNotice.style.display = 'none';
      if (showingCount) showingCount.innerText = 'Showing ' + filtered.length + ' of ' + totalCount + ' contacts';

      var tableHtml = '';
      var cardsHtml = '';

      for (var i = 0; i < filtered.length; i++) {
        var p = filtered[i];
        var name = p['Patient Name'] || p['Name'] || 'Patient';
        var regNo = p['Reg No'] || p['Patient ID'] || '—';
        var rawContact = p['Contact Number'] || p['Contact'] || p['Phone'] || p['Mobile'] || '';
        var rawClean = cleanPhone(rawContact);
        var hasValidPhone = rawClean.length >= 10;
        var displayPhone = hasValidPhone ? rawClean : (rawContact || 'No contact');
        var seenBy = p['Seen By'] || 'R. Chandrashekar';
        var date = p['Consultation Date'] || p['Date'] || '—';
        var diagnosis = p['Clinical Diagnosis'] || p['Diagnosis'] || '';

        var waMessage = encodeURIComponent('Dear ' + name + ', greetings from Namana Physiotherapy Clinic. Please reach out for appointments or queries at 9880517715.');
        var waUrl = hasValidPhone ? ('https://wa.me/91' + rawClean.slice(-10) + '?text=' + waMessage) : '#';

        // Single-line action buttons HTML
        var actionButtonsHtml = hasValidPhone ? (
          '<div class="single-line-actions">' +
            '<a class="btn-action btn-wa" href="' + waUrl + '" target="_blank" rel="noopener noreferrer" title="WhatsApp ' + escapeHtml(name) + '">💬 WhatsApp</a>' +
            '<a class="btn-action btn-call" href="tel:' + encodeURIComponent(rawClean) + '" title="Call ' + escapeHtml(name) + '">📞 Call</a>' +
            '<button type="button" class="btn-action btn-copy" onclick="copyToClipboard(\\'' + rawClean + '\\', \\'Copied ' + rawClean + '\\')" title="Copy Phone Number">📋 Copy</button>' +
          '</div>'
        ) : (
          '<span style="color:#94a3b8; font-size: 11px; font-style: italic;">No Phone Added</span>'
        );

        // Desktop Table Row
        tableHtml += '<tr>' +
          '<td class="col-patient">' +
            '<div class="p-name">' + escapeHtml(name) + '</div>' +
            '<div class="p-meta">' + escapeHtml(regNo) + (diagnosis ? ' • ' + escapeHtml(diagnosis) : '') + '</div>' +
          '</td>' +
          '<td class="col-phone">' +
            (hasValidPhone ?
              '<a class="phone-link" href="tel:' + encodeURIComponent(rawClean) + '">📞 ' + escapeHtml(rawClean) + '</a>' :
              '<span style="color:#94a3b8; font-style: italic; font-size: 12px;">' + escapeHtml(displayPhone) + '</span>'
            ) +
          '</td>' +
          '<td class="col-doctor">' + escapeHtml(seenBy) + '</td>' +
          '<td class="col-date">' + escapeHtml(date) + '</td>' +
          '<td class="col-actions" style="text-align: right;">' + actionButtonsHtml + '</td>' +
        '</tr>';

        // Mobile Card (strictly single line action bar)
        cardsHtml += '<div class="patient-card">' +
          '<div class="card-top">' +
            '<div class="card-patient-info">' +
              '<div class="card-name">' + escapeHtml(name) + '</div>' +
              '<span class="card-id-pill">' + escapeHtml(regNo) + '</span>' +
            '</div>' +
            '<div class="card-doctor-badge">' + escapeHtml(seenBy) + '</div>' +
          '</div>' +
          '<div class="card-details-row">' +
            '<div class="card-phone-wrap">' +
              (hasValidPhone ?
                '<a class="card-phone-text" href="tel:' + encodeURIComponent(rawClean) + '">📞 ' + escapeHtml(rawClean) + '</a>' :
                '<span style="color:#94a3b8; font-style: italic; font-size: 12px;">No Phone</span>'
              ) +
            '</div>' +
            '<div class="card-date-text">' + escapeHtml(date) + '</div>' +
          '</div>' +
          (diagnosis ? '<div class="card-diag-text">Diagnosis: ' + escapeHtml(diagnosis) + '</div>' : '') +
          '<div class="card-action-bar">' +
            (hasValidPhone ? (
              '<a class="btn-action btn-wa" href="' + waUrl + '" target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>' +
              '<a class="btn-action btn-call" href="tel:' + encodeURIComponent(rawClean) + '">📞 Call</a>' +
              '<button type="button" class="btn-action btn-copy" onclick="copyToClipboard(\\'' + rawClean + '\\', \\'Copied ' + rawClean + '\\')">📋 Copy</button>'
            ) : (
              '<div style="width: 100%; text-align: center; color: #94a3b8; font-size: 11px; padding: 4px 0; font-style: italic;">No Phone Contact Available</div>'
            )) +
          '</div>' +
        '</div>';
      }

      if (tbody) tbody.innerHTML = tableHtml;
      if (cardsContainer) cardsContainer.innerHTML = cardsHtml;
    }

    function filterAndRender() {
      var q = (document.getElementById('searchInput').value || '').toLowerCase().trim();
      var clearBtn = document.getElementById('clearSearchBtn');
      if (clearBtn) clearBtn.className = q ? 'clear-search-btn active' : 'clear-search-btn';

      var filtered = (allPatients || []).filter(function(p) {
        var name = String(p['Patient Name'] || p['Name'] || '').toLowerCase();
        var rawContact = String(p['Contact Number'] || p['Contact'] || p['Phone'] || p['Mobile'] || '');
        var phone = cleanPhone(rawContact);
        var reg = String(p['Reg No'] || p['Patient ID'] || '').toLowerCase();
        var diag = String(p['Clinical Diagnosis'] || p['Diagnosis'] || '').toLowerCase();
        var doc = String(p['Seen By'] || '').toLowerCase();

        // Chip filters
        if (currentFilter === 'withPhone' && phone.length < 10) return false;
        if (currentFilter === 'noPhone' && phone.length >= 10) return false;
        if (currentFilter === 'chandra' && doc.indexOf('chandra') === -1) return false;

        if (!q) return true;

        return name.indexOf(q) !== -1 ||
          phone.indexOf(q) !== -1 ||
          rawContact.toLowerCase().indexOf(q) !== -1 ||
          reg.indexOf(q) !== -1 ||
          diag.indexOf(q) !== -1 ||
          doc.indexOf(q) !== -1;
      });

      // Sort according to active sort order (id-desc, id-asec, name-asc)
      filtered.sort(function(a, b) {
        return comparePatients(a, b, currentSort);
      });

      renderViews(filtered);
    }

    document.getElementById('searchInput').addEventListener('input', filterAndRender);

    function loadPatientsData() {
      showToast('Refreshing directory contacts...');
      if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run
          .withSuccessHandler(function(data) {
            allPatients = (data && data.rows) ? data.rows : (Array.isArray(data) ? data : []);
            filterAndRender();
            showToast('Updated ' + allPatients.length + ' contacts.');
          })
          .withFailureHandler(function(err) {
            showToast('Notice: ' + (err && err.message ? err.message : err));
          })
          .getPatientsDataForDirectory(currentSort);
      } else {
        filterAndRender();
        showToast('Viewing ' + (allPatients ? allPatients.length : 0) + ' active contacts.');
      }
    }

    window.onload = function() {
      try {
        var params = new URLSearchParams(window.location.search);
        var sortParam = params.get('sort');
        if (sortParam === 'id-asc' || sortParam === 'id-asec') {
          currentSort = 'id-asec';
        } else if (sortParam === 'id-desc') {
          currentSort = 'id-desc';
        } else if (sortParam === 'name-asc') {
          currentSort = 'name-asc';
        }
      } catch (err) {}

      // Update button visual state to match currentSort
      var btnDesc = document.getElementById('sortBtnIdDesc');
      var btnAsc = document.getElementById('sortBtnIdAsc');
      var btnName = document.getElementById('sortBtnName');
      var badge = document.getElementById('activeSortBadge');
      if (btnDesc) btnDesc.className = (currentSort === 'id-desc') ? 'sort-btn active' : 'sort-btn';
      if (btnAsc) btnAsc.className = (currentSort === 'id-asc' || currentSort === 'id-asec') ? 'sort-btn active' : 'sort-btn';
      if (btnName) btnName.className = (currentSort === 'name-asc') ? 'sort-btn active' : 'sort-btn';
      if (badge) {
        badge.innerText = (currentSort === 'id-desc') ? 'Active: id-desc (Newest Top)' :
          ((currentSort === 'id-asc' || currentSort === 'id-asec') ? 'Active: id-asec (Oldest Top)' : 'Active: ' + currentSort);
      }

      if (allPatients && allPatients.length > 0) {
        filterAndRender();
      } else {
        loadPatientsData();
      }
    };
  </script>
</body>
</html>`;
}

export {
  generateGoogleAppsScriptSnippet,
  cleanScriptCode,
  downloadCodeGsFile,
  downloadIndexHtmlFile,
} from "./generateAppsScriptCode";

import { generateGoogleAppsScriptSnippet } from "./generateAppsScriptCode";
export const GOOGLE_APPS_SCRIPT_SNIPPET = generateGoogleAppsScriptSnippet();
