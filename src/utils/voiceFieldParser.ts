import { COMMON_DIAGNOSES, MODALITIES_LIST, BLOOD_GROUPS } from '../constants';
import { Patient, PaymentMethod, VisitType } from '../types';

export interface FollowUpVoiceFields {
  action?: 'add' | 'update';
  sessionNumber?: number;
  date?: string;
  time?: string;
  notes?: string;
  painScaleBefore?: number;
  painScaleAfter?: number;
  treatmentsGiven?: string[];
  fee?: string | number;
  paymentMethod?: PaymentMethod;
  visitType?: VisitType;
  seenBy?: string;
  receiptNo?: string;
}

export interface RecognizedClinicalFields {
  name?: string;
  age?: string | number;
  sex?: 'Male' | 'Female' | 'Other';
  gender?: string;
  contact?: string;
  address?: string;
  height?: string;
  weight?: string;
  bloodGroup?: string;
  date?: string;
  time?: string;
  regNo?: string;
  receiptNo?: string;
  diagnosis?: string;
  history?: string;
  painScaleBefore?: number;
  painScaleAfter?: number;
  treatmentFee?: string | number;
  paymentMethod?: PaymentMethod;
  visitType?: VisitType;
  referredBy?: string;
  seenBy?: string;
  comorbid?: {
    diabetes?: boolean;
    bp?: boolean;
    thyroid?: boolean;
    other?: boolean;
    otherText?: string;
  };
  modalities?: string[];
  followUp?: FollowUpVoiceFields;
  followUps?: FollowUpVoiceFields[];
  [key: string]: any;
}

/**
 * Parses spoken natural language date and time expressions for MULTIPLE follow-up dates into an array of ISO dates.
 * Handles:
 * - "tomorrow, 25th September, and 28th September at 10 AM"
 * - "22nd, 24th, and 26th September at 4 PM"
 * - "Monday, Wednesday, and Friday at 11 AM"
 * - "tomorrow and day after tomorrow"
 * - "2026-09-22, 2026-09-24, 2026-09-26"
 * - Single dates as well (returns 1-element array)
 */
export function parseMultipleSpokenFollowUpDates(
  text: string,
  baseDate: Date = new Date()
): Array<{ date: string; time?: string }> {
  const lower = text.toLowerCase();
  const now = new Date(baseDate.getTime());
  const yNow = now.getFullYear();

  // Helper to extract time located near a specific word/index (e.g. "tomorrow at 10 AM and Friday at 4 PM")
  const extractTimeNearIndex = (rawText: string, index: number): string | undefined => {
    const start = Math.max(0, index - 10);
    const end = Math.min(rawText.length, index + 50);
    const snippet = rawText.slice(start, end);

    const time12Match = snippet.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
    if (time12Match) {
      let hours = parseInt(time12Match[1], 10);
      const minutes = time12Match[2] ? parseInt(time12Match[2], 10) : 0;
      const meridiem = time12Match[3].toLowerCase();
      if (meridiem === 'pm' && hours < 12) hours += 12;
      if (meridiem === 'am' && hours === 12) hours = 0;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
    }

    const time24Match = snippet.match(/\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\b/i);
    if (time24Match) {
      const hh = String(parseInt(time24Match[1], 10)).padStart(2, '0');
      const mm = String(parseInt(time24Match[2], 10)).padStart(2, '0');
      return `${hh}:${mm}:00`;
    }
    return undefined;
  };

  // 1. Find general default time if specified (e.g. "at 10 AM", "at 4:30 PM", "16:30")
  let defaultTime: string | undefined;
  const time12Match = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (time12Match) {
    let hours = parseInt(time12Match[1], 10);
    const minutes = time12Match[2] ? parseInt(time12Match[2], 10) : 0;
    const meridiem = time12Match[3].toLowerCase();
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    defaultTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
  } else {
    const time24Match = text.match(/\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\b/i);
    if (time24Match) {
      const hh = String(parseInt(time24Match[1], 10)).padStart(2, '0');
      const mm = String(parseInt(time24Match[2], 10)).padStart(2, '0');
      defaultTime = `${hh}:${mm}:00`;
    }
  }

  const monthsMap: Record<string, number> = {
    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8,
    sep: 9, sept: 9, september: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12,
  };
  const monthNamesRegex = Object.keys(monthsMap).join('|');

  const detectedDates: Array<{ date: string; time?: string; index: number }> = [];

  // 2. Grouped days before month: "22nd, 24th, and 26th September", "22, 24 and 26 September", "22nd and 24th September"
  const groupedDaysRegex = new RegExp(
    `((?:\\b\\d{1,2}(?:st|nd|rd|th)?\\s*(?:,|and|&)?\\s*)+)\\s*(?:of\\s+)?(${monthNamesRegex})(?:\\s*(\\d{4}))?\\b`,
    'gi'
  );
  let gMatch: RegExpExecArray | null;
  while ((gMatch = groupedDaysRegex.exec(lower)) !== null) {
    const numPart = gMatch[1];
    const mStr = gMatch[2].toLowerCase();
    const mNum = monthsMap[mStr];
    const yNum = gMatch[3] ? parseInt(gMatch[3], 10) : yNow;

    const dayMatches = numPart.match(/\b\d{1,2}\b/g);
    if (dayMatches && mNum) {
      dayMatches.forEach((dStr) => {
        const d = parseInt(dStr, 10);
        if (d >= 1 && d <= 31) {
          const iso = `${yNum}-${String(mNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          detectedDates.push({ date: iso, time: defaultTime, index: gMatch!.index });
        }
      });
    }
  }

  // 3. Month followed by grouped days: "September 22nd, 24th, and 26th" or "September 22, 24, 26"
  const monthGroupedDaysRegex = new RegExp(
    `\\b(${monthNamesRegex})\\s+((?:\\b\\d{1,2}(?:st|nd|rd|th)?\\s*(?:,|and|&)?\\s*)+)(?:\\s*(\\d{4}))?\\b`,
    'gi'
  );
  let mgMatch: RegExpExecArray | null;
  while ((mgMatch = monthGroupedDaysRegex.exec(lower)) !== null) {
    const mStr = mgMatch[1].toLowerCase();
    const numPart = mgMatch[2];
    const mNum = monthsMap[mStr];
    const yNum = mgMatch[3] ? parseInt(mgMatch[3], 10) : yNow;

    const dayMatches = numPart.match(/\b\d{1,2}\b/g);
    if (dayMatches && mNum) {
      dayMatches.forEach((dStr) => {
        const d = parseInt(dStr, 10);
        if (d >= 1 && d <= 31) {
          const iso = `${yNum}-${String(mNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          detectedDates.push({ date: iso, time: defaultTime, index: mgMatch!.index });
        }
      });
    }
  }

  // 4. Repeated individual month-day combos: "25th September ... 28th September"
  const singleDayMonthRegex = new RegExp(
    `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${monthNamesRegex})(?:\\s*(\\d{4}))?\\b`,
    'gi'
  );
  let sdmMatch: RegExpExecArray | null;
  while ((sdmMatch = singleDayMonthRegex.exec(lower)) !== null) {
    const d = parseInt(sdmMatch[1], 10);
    const mNum = monthsMap[sdmMatch[2].toLowerCase()];
    const yNum = sdmMatch[3] ? parseInt(sdmMatch[3], 10) : yNow;
    if (d >= 1 && d <= 31 && mNum) {
      const iso = `${yNum}-${String(mNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (!detectedDates.some((item) => item.date === iso)) {
        detectedDates.push({ date: iso, time: defaultTime, index: sdmMatch.index });
      }
    }
  }

  // 5. Relative dates: "tomorrow", "day after tomorrow", "today", "next week"
  if (/\bday\s+after\s+tomorrow\b/i.test(lower)) {
    const t = new Date(now);
    t.setDate(t.getDate() + 2);
    const iso = t.toISOString().split('T')[0];
    if (!detectedDates.some((item) => item.date === iso)) {
      detectedDates.push({ date: iso, time: defaultTime, index: lower.indexOf('day after tomorrow') });
    }
  }

  const tomorrowMatches = lower.matchAll(/(?<!day\s+after\s+)\btomorrow\b/gi);
  for (const tm of tomorrowMatches) {
    const t = new Date(now);
    t.setDate(t.getDate() + 1);
    const iso = t.toISOString().split('T')[0];
    if (!detectedDates.some((item) => item.date === iso)) {
      detectedDates.push({ date: iso, time: defaultTime, index: tm.index || 0 });
    }
  }

  if (/\btoday\b/i.test(lower)) {
    const iso = now.toISOString().split('T')[0];
    if (!detectedDates.some((item) => item.date === iso)) {
      detectedDates.push({ date: iso, time: defaultTime, index: lower.indexOf('today') });
    }
  }

  // 6. Days of the week: "Monday, Wednesday, and Friday" or "on Tuesday and Thursday"
  const daysMap: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  };
  const weekDayMatches = lower.matchAll(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi);
  const currentDayOfWeek = now.getDay();
  for (const wm of weekDayMatches) {
    const dayName = wm[1].toLowerCase();
    const targetDay = daysMap[dayName];
    if (targetDay !== undefined) {
      let diff = targetDay - currentDayOfWeek;
      if (diff <= 0) diff += 7; // next occurrence of this weekday
      const t = new Date(now);
      t.setDate(t.getDate() + diff);
      const iso = t.toISOString().split('T')[0];
      if (!detectedDates.some((item) => item.date === iso)) {
        detectedDates.push({ date: iso, time: defaultTime, index: wm.index || 0 });
      }
    }
  }

  // 7. Explicit ISO formats: "2026-09-22", "22/09/2026", "22-09-2026"
  const isoMatches = text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g);
  for (const m of isoMatches) {
    const iso = m[0];
    if (!detectedDates.some((item) => item.date === iso)) {
      detectedDates.push({ date: iso, time: defaultTime, index: m.index || 0 });
    }
  }
  const slashMatches = text.matchAll(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/g);
  for (const m of slashMatches) {
    const d = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    let yr = parseInt(m[3], 10);
    if (yr < 100) yr += 2000;
    const iso = `${yr}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (!detectedDates.some((item) => item.date === iso)) {
      detectedDates.push({ date: iso, time: defaultTime, index: m.index || 0 });
    }
  }

  // Deduplicate and sort chronologically by date, applying time near date if specified
  const uniqueDatesMap = new Map<string, { date: string; time?: string }>();
  detectedDates.forEach((d) => {
    if (!uniqueDatesMap.has(d.date)) {
      const specificTime = extractTimeNearIndex(text, d.index) || d.time || defaultTime || '10:00:00';
      uniqueDatesMap.set(d.date, { date: d.date, time: specificTime });
    }
  });

  const result = Array.from(uniqueDatesMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  return result;
}

/**
 * Parses spoken natural language date and time expressions into ISO format (YYYY-MM-DD and HH:MM:SS).
 * Handles: "today", "tomorrow", "day after tomorrow", "next Monday", "25th September", "2026-09-25",
 * "at 4:30 PM", "10:00 AM", "16:30", etc.
 */
export function parseSpokenDateAndTimeToISO(
  text: string,
  baseDate: Date = new Date()
): { date?: string; time?: string } {
  const lower = text.toLowerCase();
  let dateResult: string | undefined;
  let timeResult: string | undefined;

  // 1. Time parsing
  // Matches "4:30 pm", "10:30 am", "5 pm", "11 am", "16:30", "at 4 pm", "at 10:30"
  const time12Match = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (time12Match) {
    let hours = parseInt(time12Match[1], 10);
    const minutes = time12Match[2] ? parseInt(time12Match[2], 10) : 0;
    const meridiem = time12Match[3].toLowerCase();

    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;

    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    timeResult = `${hh}:${mm}:00`;
  } else {
    // 24-hour match e.g. "16:30" or "at 14:00"
    const time24Match = text.match(/\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\b/i);
    if (time24Match) {
      const hh = String(parseInt(time24Match[1], 10)).padStart(2, '0');
      const mm = String(parseInt(time24Match[2], 10)).padStart(2, '0');
      timeResult = `${hh}:${mm}:00`;
    }
  }

  // 2. Relative Dates
  const now = new Date(baseDate.getTime());
  if (/\b(?:today|this\s+day)\b/i.test(lower)) {
    dateResult = now.toISOString().split('T')[0];
  } else if (/\bday\s+after\s+tomorrow\b/i.test(lower)) {
    const target = new Date(now);
    target.setDate(target.getDate() + 2);
    dateResult = target.toISOString().split('T')[0];
  } else if (/\btomorrow\b/i.test(lower)) {
    const target = new Date(now);
    target.setDate(target.getDate() + 1);
    dateResult = target.toISOString().split('T')[0];
  } else if (/\b(?:next\s+week|after\s+(?:a|1)\s+week)\b/i.test(lower)) {
    const target = new Date(now);
    target.setDate(target.getDate() + 7);
    dateResult = target.toISOString().split('T')[0];
  } else {
    // "after X days"
    const afterDaysMatch = lower.match(/\bafter\s+(\d{1,2})\s+days?\b/);
    if (afterDaysMatch) {
      const days = parseInt(afterDaysMatch[1], 10);
      const target = new Date(now);
      target.setDate(target.getDate() + days);
      dateResult = target.toISOString().split('T')[0];
    }
  }

  // 3. Day of week: "next monday", "this friday", "on wednesday"
  if (!dateResult) {
    const daysMap: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };
    const dayMatch = lower.match(/\b(?:next|this|on)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
    if (dayMatch && dayMatch[1]) {
      const targetDay = daysMap[dayMatch[1].toLowerCase()];
      const currentDay = now.getDay();
      let diff = targetDay - currentDay;
      if (diff <= 0) diff += 7; // Target upcoming day
      const target = new Date(now);
      target.setDate(target.getDate() + diff);
      dateResult = target.toISOString().split('T')[0];
    }
  }

  // 4. Calendar Month Names: "25th September", "September 25", "25 Sept 2026", "25th of September"
  if (!dateResult) {
    const months: Record<string, number> = {
      jan: 1, january: 1,
      feb: 2, february: 2,
      mar: 3, march: 3,
      apr: 4, april: 4,
      may: 5,
      jun: 6, june: 6,
      jul: 7, july: 7,
      aug: 8, august: 8,
      sep: 9, sept: 9, september: 9,
      oct: 10, october: 10,
      nov: 11, november: 11,
      dec: 12, december: 12,
    };

    const monthNamesRegex = Object.keys(months).join('|');
    // "25th [of] September [2026]"
    const dayMonthMatch = lower.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${monthNamesRegex})\\s*(\\d{4})?\\b`, 'i'));
    // "September 25th [2026]"
    const monthDayMatch = lower.match(new RegExp(`\\b(${monthNamesRegex})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*(\\d{4})?\\b`, 'i'));

    if (dayMonthMatch) {
      const day = parseInt(dayMonthMatch[1], 10);
      const mNum = months[dayMonthMatch[2].toLowerCase()];
      const yNum = dayMonthMatch[3] ? parseInt(dayMonthMatch[3], 10) : now.getFullYear();
      if (day >= 1 && day <= 31 && mNum) {
        dateResult = `${yNum}-${String(mNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    } else if (monthDayMatch) {
      const mNum = months[monthDayMatch[1].toLowerCase()];
      const day = parseInt(monthDayMatch[2], 10);
      const yNum = monthDayMatch[3] ? parseInt(monthDayMatch[3], 10) : now.getFullYear();
      if (day >= 1 && day <= 31 && mNum) {
        dateResult = `${yNum}-${String(mNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
  }

  // 5. Explicit ISO or numeric format: "2026-09-25", "25/09/2026", "25-09-2026"
  if (!dateResult) {
    const isoMatch = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (isoMatch) {
      dateResult = isoMatch[0];
    } else {
      const slashMatch = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
      if (slashMatch) {
        const d = parseInt(slashMatch[1], 10);
        const m = parseInt(slashMatch[2], 10);
        let y = parseInt(slashMatch[3], 10);
        if (y < 100) y += 2000;
        dateResult = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
  }

  return { date: dateResult, time: timeResult };
}

/**
 * Handles the two-field Clinical Diagnosis & Assessment behavior:
 * 1. 2nd field copies what is chosen in the 1st field.
 * 2. Once the user enters '+', choosing in the 1st field again adds/appends to the 2nd field.
 */
export function applyDiagnosisSelection(currentDiagnosis: string, selectedChoice: string): string {
  if (!selectedChoice || selectedChoice === '__custom__') return currentDiagnosis || '';

  const trimmed = (currentDiagnosis || '').trim();

  // If 2nd field ends with '+' (e.g. "Cervical Spondylosis +" or "Cervical Spondylosis + ")
  if (trimmed.endsWith('+')) {
    // Avoid duplicate if already ends with this diagnosis
    if (trimmed.includes(selectedChoice)) {
      return trimmed;
    }
    return `${trimmed} ${selectedChoice}`.replace(/\s+/g, ' ').trim();
  }

  // If 2nd field is empty, copy what is chosen in 1st field
  if (!trimmed) {
    return selectedChoice;
  }

  // If 2nd field already has text without '+', selecting a new one replaces it,
  // unless user enters '+' (they can also click the [+] combiner button)
  return selectedChoice;
}

/**
 * Fast, robust client-side clinical NLP regex parser for spoken transcripts.
 * Works 100% offline, on mobile APK, and without any API key requirements.
 */
export function parseVoiceClinicalTranscript(
  transcript: string,
  existingData?: Partial<Patient>
): RecognizedClinicalFields {
  const text = transcript.trim();
  const lower = text.toLowerCase();
  const result: RecognizedClinicalFields = {};

  // 1. Patient Name & Natural Clinical Phrasing
  // Handles:
  // - "Sukanya She Is Suffering From Cervical Spondylosis"
  // - "Sukanya is suffering from back pain"
  // - "Patient Sukanya she is having frozen shoulder"
  // - "Patient name is John Doe age 45"
  let extractedName: string | null = null;

  // Pattern A: Leading name followed by natural language transition ("Name she/he is suffering from...", "Name suffering from...", "Name who is...")
  const leadingNameMatch = text.match(
    /^(?:(?:register\s+(?:new\s+)?patient|add\s+(?:new\s+)?patient|new\s+patient|patient)\s+(?:is\s+)?)?([A-Za-z.'’]+(?:\s+[A-Za-z.'’]+){0,2})\s+(?:she\s+is\s+suffering\s+from|he\s+is\s+suffering\s+from|is\s+suffering\s+from|suffering\s+from|she\s+has|he\s+has|has|is\s+having|having|complaining\s+of|complains\s+of|diagnosed\s+with|presents\s+with|she\s+is|he\s+is|who\s+is|aged|years)\b/i
  );
  if (leadingNameMatch && leadingNameMatch[1]) {
    extractedName = leadingNameMatch[1].trim();
    // Infer gender from pronoun right after name
    if (/\b(?:she\s+is|she\s+has|she)\b/i.test(leadingNameMatch[0])) {
      result.sex = 'Female';
    } else if (/\b(?:he\s+is|he\s+has|he)\b/i.test(leadingNameMatch[0])) {
      result.sex = 'Male';
    }
  }

  // Pattern B: Standard name phrases ("patient name is X", "name is X", "patient X")
  if (!extractedName) {
    const nameMatch = text.match(
      /(?:patient\s+name\s+is|patient\s+name|name\s+is|patient\s+is|name)\s*[:=]?\s*([A-Za-z\s.'’]+?)(?=\s*(?:,|\.|\b(?:she\s+is|he\s+is|she|he|who\s+is|suffering\s+from|is\s+suffering|suffering|diagnosed|complaint|complaints|complaining|having|presents\s+with|age|years|gender|sex|phone|contact|mobile|diagnosis|chief|history|pain|fee|charge|visit|referred|seen|blood|height|weight|follow\s*up)\b|$))/i
    );
    if (nameMatch && nameMatch[1]) {
      extractedName = nameMatch[1].trim();
    }
  }

  // Pattern C: Explicit registration phrasing ("register new patient Ramesh", "register patient Ramesh", "add patient Ramesh", "new patient Ramesh")
  if (!extractedName) {
    const regMatch = text.match(
      /(?:(?:register|add|create|new)\s+(?:new\s+)?patient|register\s+patient|new\s+patient)\s*[:=]?\s*([A-Za-z\s.'’]+?)(?=\s*(?:,|\.|\b(?:she\s+is|he\s+is|she|he|who\s+is|suffering\s+from|is\s+suffering|suffering|diagnosed|complaint|complaints|complaining|having|presents\s+with|age|years|gender|sex|phone|contact|mobile|diagnosis|chief|history|pain|fee|charge|visit|referred|seen|blood|height|weight|follow\s*up)\b|$))/i
    );
    if (regMatch && regMatch[1]) {
      extractedName = regMatch[1].trim();
    }
  }

  // Pattern D: Direct leading name followed by age, phone, gender, or clinical keywords
  // e.g. "Ramesh age 45 phone 9880517715" or "Suresh 45 years male"
  if (!extractedName) {
    const directLeadMatch = text.match(
      /^(?:patient\s+)?([A-Za-z.'’]+(?:\s+[A-Za-z.'’]+){0,2})\s+(?:\b(?:age\s+(?:is\s+)?\d+|\d+\s*years?\s*old|\d+\s*years?|\d+\s*yrs?|phone|mobile|contact|male|female)\b)/i
    );
    if (directLeadMatch && directLeadMatch[1]) {
      extractedName = directLeadMatch[1].trim();
    }
  }

  if (extractedName) {
    const cleanName = extractedName
      .replace(
        /\b(register\s+(?:new\s+)?patient|add\s+(?:new\s+)?patient|new\s+patient|she\s+is\s+suffering\s+from|he\s+is\s+suffering\s+from|is\s+suffering\s+from|suffering\s+from|she\s+is|he\s+is|she\s+has|he\s+has|is\s+having|having|suffering|is|called|who\s+is|patient)\b/gi,
        ' '
      )
      .replace(/\s+/g, ' ')
      .trim();

    const isNumberWordName = /^(?:zero|one|won|two|to|too|three|tree|four|for|five|six|seven|eight|ate|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|\d+|\s+)+$/i.test(cleanName);
    if (
      cleanName.length >= 2 &&
      !/^(male|female|other|years|age|pain|none|na|patient)$/i.test(cleanName) &&
      !isNumberWordName
    ) {
      result.name = cleanName
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    }
  }

  // 2. Age
  // Matches "age 45", "45 years old", "45 years", "age is 32", "45 male", "he is 45", "45y", "45 yo", "forty five"
  let parsedAgeVal: number | null = null;
  // A. Spaced digits: "4 5" or "4 - 5" -> 45
  const spacedAge = text.match(/\b([1-9])\s*[- ]\s*([0-9])\b/);
  if (spacedAge) {
    const combined = parseInt(spacedAge[1] + spacedAge[2], 10);
    if (combined >= 1 && combined <= 120) parsedAgeVal = combined;
  }
  // B. Direct digits with or without suffixes/prefixes
  if (!parsedAgeVal) {
    const directAgeMatch = text.match(/(?:age\s*(?:is)?\s*|aged\s+|he\s*is\s*|she\s*is\s*|patient\s*is\s*|around\s*|about\s*)?(\d{1,3})(?:\s*(?:years?|yrs?|yo|y)\b|\s*y\b|\b|$)/i);
    if (directAgeMatch && directAgeMatch[1]) {
      const num = parseInt(directAgeMatch[1], 10);
      if (num >= 1 && num <= 120) {
        parsedAgeVal = num;
      }
    }
  }
  // C. Word numbers like "forty five", "thirty two", "twenty"
  if (!parsedAgeVal) {
    const wordAgeMap: Record<string, number> = {
      zero: 0, one: 1, won: 1, two: 2, to: 2, too: 2, three: 3, tree: 3, four: 4, for: 4, five: 5,
      six: 6, seven: 7, eight: 8, ate: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
      thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
      twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
    };
    const tokens = lower.replace(/[^a-z0-9\s-]/g, ' ').split(/[\s-]+/);
    let wordSum = 0;
    let matchedAnyWord = false;
    for (const t of tokens) {
      if (wordAgeMap[t] !== undefined) {
        wordSum += wordAgeMap[t];
        matchedAnyWord = true;
      }
    }
    if (matchedAnyWord && wordSum >= 1 && wordSum <= 120) {
      parsedAgeVal = wordSum;
    }
  }
  if (parsedAgeVal) {
    result.age = parsedAgeVal;
  }

  // 3. Gender / Sex (if not already inferred from pronoun above)
  if (!result.sex) {
    if (/\b(?:female|woman|lady|girl|she|her)\b/i.test(text)) {
      result.sex = 'Female';
    } else if (/\b(?:male|man|gentleman|boy|he|his)\b/i.test(text)) {
      result.sex = 'Male';
    } else if (/\b(?:transgender|other\s+gender|non\s*binary)\b/i.test(text)) {
      result.sex = 'Other';
    }
  }

  // 4. Contact / Phone
  // Enhanced to capture 10 digits whether formatted as continuous (9880517715), grouped (98805 17715, 988 051 7715),
  // space-separated per digit (9 8 8 0 5 1 7 7 1 5), or prefixed with +91/phone/mobile
  const phoneSection = text.match(/(?:phone|mobile|contact|cell|call)?\s*(?:number\s*(?:is)?)?\s*[:=]?\s*(\+?91[\s-]?)?((?:[6-9][\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d|\b\d{10}\b))/i);
  if (phoneSection) {
    const rawDigits = phoneSection[2].replace(/\D/g, '');
    if (rawDigits.length === 10) {
      result.contact = rawDigits;
    }
  }
  if (!result.contact) {
    // Fallback: search for any sequence of 10 digits across the text with spaces/dashes
    const any10 = text.match(/\b([6-9]\d{9})\b/) || text.match(/\b([6-9]\d{4}[\s-]?\d{5})\b/);
    if (any10) {
      result.contact = (any10[1] || any10[0]).replace(/\D/g, '');
    }
  }

  // 5. Blood Group
  const bgMatch = text.match(/\b(a|b|ab|o)\s*(positive|\+|negative|-)\b/i) || text.match(/\b(a\+|a-|b\+|b-|ab\+|ab-|o\+|o-)\b/i);
  if (bgMatch) {
    let grp = bgMatch[0].toUpperCase().replace(/\s+/g, '');
    if (grp.includes('POSITIVE')) grp = grp.replace('POSITIVE', '+');
    if (grp.includes('NEGATIVE')) grp = grp.replace('NEGATIVE', '-');
    if (BLOOD_GROUPS.includes(grp)) {
      result.bloodGroup = grp;
    }
  }

  // 6. Height
  const heightMatch =
    text.match(/(?:height\s*(?:is)?\s*)?(\d)\s*(?:foot|feet|ft|'|\s)\s*(\d{1,2})?\s*(?:inches|inch|in|")?/i) ||
    text.match(/(?:height\s*(?:is)?\s*)?(\d{2,3})\s*(?:cms?|centimeters?)/i);
  if (heightMatch) {
    if (heightMatch[2] !== undefined) {
      const feet = heightMatch[1];
      const inches = heightMatch[2] || '0';
      result.height = `${feet}'${inches}"`;
    } else if (heightMatch[1] && parseInt(heightMatch[1], 10) >= 90) {
      result.height = `${heightMatch[1]} cm`;
    }
  }

  // 7. Weight
  const weightMatch = text.match(/(?:weight\s*(?:is)?\s*)?(\d{2,3}(?:\.\d)?)\s*(?:kg|kgs|kilos|kilograms)\b/i) ||
    text.match(/weight\s*(?:is)?\s*(\d{2,3})\b/i);
  if (weightMatch && weightMatch[1]) {
    result.weight = `${weightMatch[1]} kg`;
  }

  // 8. Diagnosis
  // Check if user says "add diagnosis X" or "plus diagnosis X"
  const isAddDiagnosis = /\b(?:add\s+diagnosis|plus\s+diagnosis|add\s+condition|also\s+has)\b/i.test(text);
  
  // Natural language condition match: "suffering from X", "diagnosed with X", "complaining of X"
  let detectedDiag: string | null = null;
  const sufferingMatch = text.match(
    /(?:suffering\s+from|is\s+suffering\s+from|diagnosed\s+with|complaining\s+of|complains\s+of|has\s+been\s+diagnosed\s+with|condition\s+is|diagnosis\s+is|diagnosis)\s*[:=]?\s*([^,.;\n]+?)(?=\s*(?:,|\.|\b(?:chief|history|complaint|complaints|pain|fee|charge|visit|modalities|treatment|referred|seen|follow|date|time|on|at|she|he|and\s+has)\b|$))/i
  );
  if (sufferingMatch && sufferingMatch[1]) {
    const raw = sufferingMatch[1].trim();
    if (raw.length > 2 && !/^(is|none|na|unknown)$/i.test(raw)) {
      detectedDiag = raw
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    }
  }

  // Match common preset diagnoses if not caught by direct sufferingMatch
  if (!detectedDiag) {
    for (const diag of COMMON_DIAGNOSES) {
      const diagKeywords = diag
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3 && !['bilateral', 'grade', 'post', 'disc', 'pain'].includes(w));
      
      const matchesCount = diagKeywords.filter((k) => lower.includes(k)).length;
      if (matchesCount >= Math.min(2, diagKeywords.length)) {
        detectedDiag = diag;
        break;
      }
    }
  }

  if (detectedDiag) {
    if (isAddDiagnosis && existingData?.diagnosis) {
      result.diagnosis = `${existingData.diagnosis} + ${detectedDiag}`.trim();
    } else {
      result.diagnosis = detectedDiag;
    }
  }

  // 9. Chief Complaints & Clinical History
  const historyMatch = text.match(/(?:chief\s+complaints?|complaints?|clinical\s+history|history|examination|symptoms?)\s*[:=]?\s*([^;]+?)(?=\s*(?:,|\.|\b(?:diagnosis|pain|fee|charge|modalities|treatment|visit|referred|seen)\b|$))/i);
  if (historyMatch && historyMatch[1]) {
    const h = historyMatch[1].trim();
    if (h.length > 4) {
      result.history = h.charAt(0).toUpperCase() + h.slice(1);
    }
  }

  // 10. Pain Scale (VAS 0 to 10)
  // Before treatment
  const painBeforeMatch = text.match(/(?:pain\s*(?:scale|score|level)?\s*(?:before\s*(?:treatment)?)?)\s*[:=]?\s*(\d{1,2})\s*(?:\/\s*10)?/i);
  if (painBeforeMatch && painBeforeMatch[1]) {
    const score = parseInt(painBeforeMatch[1], 10);
    if (score >= 0 && score <= 10) {
      result.painScaleBefore = score;
    }
  }
  // After treatment
  const painAfterMatch = text.match(/(?:pain\s*(?:scale|score|level)?\s*after\s*(?:treatment)?)\s*[:=]?\s*(\d{1,2})\s*(?:\/\s*10)?/i);
  if (painAfterMatch && painAfterMatch[1]) {
    const score = parseInt(painAfterMatch[1], 10);
    if (score >= 0 && score <= 10) {
      result.painScaleAfter = score;
    }
  }

  // 11. Treatment Fee / Consultation Fee
  const isZeroSpoken =
    /\b(?:zero|nil|nill|free|no\s*fee|none|null|nothing|zeero|cero|hero|no\s*charge|zero\s*charge|rupees?\s*zero|zero\s*rupees?|0\s*rupees?|rupees?\s*0|rs\.?\s*0|0\s*rs\.?|₹\s*0)\b/i.test(text) ||
    /\b(?:fee|charge|cost|amount|consultation|treatment)?\s*[:=]?\s*(?:is\s*)?(?:rs\.?|inr|₹)?\s*0\b/i.test(text) ||
    /^\s*0\s*$/.test(text);

  if (isZeroSpoken) {
    result.treatmentFee = 0;
  } else {
    const feeMatch = text.match(/(?:fee|charge|amount|cost|consultation\s+fee|treatment\s+fee)\s*[:=]?\s*(?:rs\.?|inr|₹)?\s*(\d{1,6})\b/i) ||
      text.match(/(?:rs\.?|inr|₹)\s*(\d{1,6})\b/i);
    if (feeMatch && feeMatch[1]) {
      result.treatmentFee = parseInt(feeMatch[1], 10);
    }
  }

  // 12. Payment Mode
  if (/\b(?:upi|gpay|google\s*pay|phonepe|paytm|online|qr)\b/i.test(text)) {
    result.paymentMethod = 'UPI';
  } else if (/\b(?:cash|hard\s+cash)\b/i.test(text)) {
    result.paymentMethod = 'Cash';
  } else if (/\b(?:card|credit\s+card|debit\s+card|pos)\b/i.test(text)) {
    result.paymentMethod = 'Card';
  } else if (/\b(?:bank\s+transfer|neft|rtgs|imps|cheque)\b/i.test(text)) {
    result.paymentMethod = 'Bank Transfer';
  }

  // 13. Visit Type
  if (/\b(?:home\s+visit|house\s+visit|domiciliary)\b/i.test(text)) {
    result.visitType = 'Home Visit';
  } else if (/\b(?:clinic|in\s*clinic|outpatient|opd)\b/i.test(text)) {
    result.visitType = 'Clinic';
  }

  // 14. Referred By & Seen By
  const refMatch = text.match(/(?:referred\s+by|ref\s+by)\s*[:=]?\s*([A-Za-z\s.'’]+?)(?=\s*(?:,|\.|\b(?:seen|doctor|diagnosis|fee|pain|visit|time|date)\b|$))/i);
  if (refMatch && refMatch[1]) {
    const ref = refMatch[1].trim();
    if (ref.length > 2 && !/^(none|self|doctor)$/i.test(ref)) {
      result.referredBy = ref;
    }
  }

  const seenMatch = text.match(/(?:seen\s+by|attending\s+doctor|consultant|doctor)\s*[:=]?\s*([A-Za-z\s.'’]+?)(?=\s*(?:,|\.|\b(?:referred|diagnosis|fee|pain|visit|time|date)\b|$))/i);
  if (seenMatch && seenMatch[1]) {
    const seen = seenMatch[1].trim();
    if (seen.length > 2 && !/^(none|self|doctor)$/i.test(seen)) {
      result.seenBy = seen;
    }
  }

  // 15. Address / Location
  const addressMatch = text.match(/(?:address\s*(?:is)?|residence\s*(?:is)?|location\s*(?:is)?)\s*[:=]?\s*([^,.;\n]+?)(?=\s*(?:,|\.|\b(?:phone|contact|age|diagnosis|fee|pain|visit|referred|seen|time|date)\b|$))/i);
  if (addressMatch && addressMatch[1]) {
    const addr = addressMatch[1].trim();
    if (addr.length > 2 && !/^(is|none|unknown)$/i.test(addr)) {
      result.address = addr;
    }
  }

  // 16. Date & Time
  const dateMatch = text.match(/(?:date\s*(?:is)?)\s*[:=]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|today)/i);
  if (dateMatch) {
    if (dateMatch[1].toLowerCase() === 'today') {
      result.date = new Date().toISOString().split('T')[0];
    } else {
      result.date = dateMatch[1];
    }
  }

  const timeMatch = text.match(/(?:time\s*(?:is)?)\s*[:=]?\s*(\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?)/i);
  if (timeMatch) {
    result.time = timeMatch[1];
  }

  // 17. Comorbidities
  const comorbid: any = {};
  if (/\b(?:diabetes|diabetic|sugar)\b/i.test(text)) comorbid.diabetes = true;
  if (/\b(?:bp|blood\s+pressure|hypertension|hypertensive)\b/i.test(text)) comorbid.bp = true;
  if (/\b(?:thyroid|hypothyroid|hyperthyroid)\b/i.test(text)) comorbid.thyroid = true;
  if (Object.keys(comorbid).length > 0) {
    result.comorbid = comorbid;
  }

  // 18. Treatment Modalities
  const detectedModalities: string[] = [];
  if (/\b(?:ift|interferential)\b/i.test(text)) detectedModalities.push('Interferential Therapy (IFT)');
  if (/\b(?:ust|ultrasound)\b/i.test(text)) detectedModalities.push('Ultrasound Therapy (UST)');
  if (/\b(?:moist|hydrocollator|hot\s+pack|steam)\b/i.test(text)) detectedModalities.push('Moist Therapy');
  if (/\b(?:exercise|exercises|strengthening)\b/i.test(text)) detectedModalities.push('Therapeutic Exercise');
  if (/\b(?:cervical\s+traction|neck\s+traction)\b/i.test(text)) detectedModalities.push('Intermittent Cervical Traction');
  if (/\b(?:pelvic\s+traction|lumbar\s+traction)\b/i.test(text)) detectedModalities.push('Intermittent Pelvic Traction');
  if (/\b(?:cold\s+pack|ice\s+pack|cryo)\b/i.test(text)) detectedModalities.push('Cold Pack');
  if (/\b(?:tens)\b/i.test(text)) detectedModalities.push('TENS');
  if (/\b(?:wax|paraffin)\b/i.test(text)) detectedModalities.push('Paraffin Wax Bath');
  if (/\b(?:manual|mobilization|manipulation)\b/i.test(text)) detectedModalities.push('Manual Therapy');
  if (/\b(?:gait|walking\s+training)\b/i.test(text)) detectedModalities.push('Gait Training');
  if (/\b(?:postural|posture|ergonomic)\b/i.test(text)) detectedModalities.push('Postural Re-education');
  if (detectedModalities.length > 0) {
    result.modalities = detectedModalities;
  }

  // 19. Follow-Up Session & Scheduling Details (Single or Multiple Dates)
  const isFollowUpCommand = /(?:follow\s*up|next\s+visit|schedule\s+follow|session|subsequent\s+visit)\b/i.test(text);
  const multiDates = parseMultipleSpokenFollowUpDates(text);

  if (multiDates.length > 0 || isFollowUpCommand) {
    const sessionMatch = text.match(/(?:session|visit)\s*(?:number|#)?\s*(\d+)/i);
    const sessionNum = sessionMatch ? parseInt(sessionMatch[1], 10) : undefined;

    let notes = '';
    const notesMatch = text.match(/(?:notes?|remarks?|progress|findings?|patient\s+reported?)\s*[:=]?\s*([^;]+?)(?=\s*(?:,|\.|\b(?:pain|fee|charge|modalities|treatment|seen|payment|visit|follow\s*up)\b|$))/i);
    if (notesMatch && notesMatch[1]) {
      notes = notesMatch[1].trim();
    }

    const defaultTime = multiDates[0]?.time || parseSpokenDateAndTimeToISO(text).time || result.time || '10:00:00';
    const isUpdate = /(?:update|edit|change)\s+follow\s*up/i.test(text);

    if (multiDates.length > 1) {
      result.followUps = multiDates.map((d, i) => ({
        action: isUpdate ? 'update' : 'add',
        sessionNumber: (existingData?.followUps?.length || 0) + (i + 1),
        date: d.date,
        time: d.time || defaultTime,
        notes: notes || 'Scheduled follow-up session',
        painScaleBefore: result.painScaleBefore,
        painScaleAfter: result.painScaleAfter,
        treatmentsGiven: detectedModalities.length > 0 ? detectedModalities : undefined,
        fee: result.treatmentFee,
        paymentMethod: result.paymentMethod,
        visitType: result.visitType,
        seenBy: result.seenBy,
      }));
      result.followUp = result.followUps[0];
    } else {
      const singleDate = multiDates[0]?.date || parseSpokenDateAndTimeToISO(text).date || result.date || new Date().toISOString().split('T')[0];
      result.followUp = {
        action: isUpdate ? 'update' : 'add',
        sessionNumber: sessionNum,
        date: singleDate,
        time: defaultTime,
        notes: notes || 'Scheduled follow-up session',
        painScaleBefore: result.painScaleBefore,
        painScaleAfter: result.painScaleAfter,
        treatmentsGiven: detectedModalities.length > 0 ? detectedModalities : undefined,
        fee: result.treatmentFee,
        paymentMethod: result.paymentMethod,
        visitType: result.visitType,
        seenBy: result.seenBy,
      };
      result.followUps = [result.followUp];
    }
  }

  return result;
}

export type VoiceActionType =
  | 'create_patient'
  | 'update_patient'
  | 'add_followup'
  | 'update_followup'
  | 'find_patient'
  | 'navigate'
  | 'search'
  | 'download_pdf'
  | 'create_receipt';

export interface UnifiedVoiceCommandResult {
  action: VoiceActionType;
  targetPatientName?: string | null;
  targetView?: 'patients' | 'monthly' | 'fees' | 'itreturn' | 'backup' | 'locum' | null;
  searchQuery?: string | null;
  actionSummary: string;
  fields: RecognizedClinicalFields;
  source: 'gemini' | 'client-nlp';
}

/**
 * Client-side intent parser when offline or backend Gemini is unavailable.
 */
export function detectVoiceIntent(
  transcript: string,
  existingData?: Partial<Patient>
): {
  action: VoiceActionType;
  targetPatientName?: string | null;
  targetView?: 'patients' | 'monthly' | 'fees' | 'itreturn' | 'backup' | 'locum' | null;
  searchQuery?: string | null;
  actionSummary: string;
} {
  const text = transcript.trim();
  const lower = text.toLowerCase();

  // 1. Follow-up Sessions & Scheduling (PRIORITY over general patient creation)
  if (
    /(?:follow\s*up|schedule\s+follow|add\s+follow\s*up|new\s+follow\s*up|follow\s*up\s+session|add\s+session|follow\s*up\s+visit|record\s+follow\s*up|next\s+visit)\b/i.test(
      text
    )
  ) {
    const multiDates = parseMultipleSpokenFollowUpDates(text);
    if (multiDates.length > 1) {
      const datesText = multiDates.map((d) => d.date).join(', ');
      return {
        action: 'add_followup',
        targetPatientName: existingData?.name || null,
        actionSummary: existingData?.name
          ? `Schedule ${multiDates.length} Follow-ups for ${existingData.name} on ${datesText}`
          : `Schedule ${multiDates.length} Follow-up Sessions on ${datesText}`,
      };
    }

    const parsedSchedule = parseSpokenDateAndTimeToISO(text);
    const dateText = parsedSchedule.date ? ` for ${parsedSchedule.date}` : '';
    const timeText = parsedSchedule.time ? ` at ${parsedSchedule.time.slice(0, 5)}` : '';

    return {
      action: 'add_followup',
      targetPatientName: existingData?.name || null,
      actionSummary: existingData?.name
        ? `Schedule Follow-up for ${existingData.name}${dateText}${timeText}`
        : `Schedule New Follow-up${dateText}${timeText}`,
    };
  }

  if (/(?:update\s+follow\s*up|edit\s+follow\s*up|change\s+follow\s*up|in\s+session\s+\d+|session\s+\d+\s+pain)\b/i.test(text)) {
    return {
      action: 'update_followup',
      targetPatientName: existingData?.name || null,
      actionSummary: existingData?.name
        ? `Update Follow-up Session for ${existingData.name}`
        : 'Update Follow-up Session',
    };
  }

  // 2. Navigation
  if (/(?:go\s+to\s+monthly|show\s+monthly|monthly\s+report|monthly\s+data|monthly\s+analytics)\b/i.test(text)) {
    return {
      action: 'navigate',
      targetView: 'monthly',
      actionSummary: 'Switch to Monthly Data & Analytics',
    };
  }
  if (/(?:go\s+to\s+fees?|show\s+fees?|fee\s+collected|fee\s+report|fees\s+overview)\b/i.test(text)) {
    return {
      action: 'navigate',
      targetView: 'fees',
      actionSummary: 'Switch to Fee Collected Overview',
    };
  }
  if (/(?:go\s+to\s+it\s*return|show\s+it\s*return|44ada|annual\s+statement|tax\s+return)\b/i.test(text)) {
    return {
      action: 'navigate',
      targetView: 'itreturn',
      actionSummary: 'Switch to Income Tax / Section 44ADA Return',
    };
  }
  if (/(?:go\s+to\s+backup|show\s+backup|google\s+sheets|cloud\s+sync|backup\s+data)\b/i.test(text)) {
    return {
      action: 'navigate',
      targetView: 'backup',
      actionSummary: 'Switch to Cloud Sync & Google Sheets Backup',
    };
  }
  if (/(?:go\s+to\s+locum|show\s+locum|locum\s+tenens|locum\s+doctors|locum\s+physio)\b/i.test(text)) {
    return {
      action: 'navigate',
      targetView: 'locum',
      actionSummary: 'Switch to Locum Tenens Manager',
    };
  }
  if (/(?:show\s+all\s+patients|all\s+patients|patient\s+directory|go\s+to\s+patients)\b/i.test(text)) {
    return {
      action: 'navigate',
      targetView: 'patients',
      actionSummary: 'Open Patient Directory',
    };
  }

  // 3. Download PDF or Create Receipt
  if (/(?:download\s+(?:case\s*sheet|pdf)|export\s+pdf|save\s+(?:case\s*sheet|pdf))\b/i.test(text)) {
    return {
      action: 'download_pdf',
      actionSummary: 'Download Case Sheet PDF',
    };
  }
  if (/(?:create\s+receipt|generate\s+(?:receipt|bill)|open\s+receipt|billing)\b/i.test(text)) {
    return {
      action: 'create_receipt',
      actionSummary: 'Open Official Clinical Receipt Modal',
    };
  }

  // 4. Check for Open / Find patient
  const openMatch = text.match(/(?:open\s+patient|find\s+patient|view\s+patient|go\s+to\s+patient)\s+([A-Za-z\s.'’]+)/i);
  if (openMatch && openMatch[1]) {
    const pName = openMatch[1].trim();
    return {
      action: 'find_patient',
      targetPatientName: pName,
      actionSummary: `Open Patient Chart: ${pName}`,
    };
  }

  // 5. Check for Search
  const searchMatch = text.match(/(?:search\s+for|search\s+patient|search)\s+([A-Za-z0-9\s]+)/i);
  if (searchMatch && searchMatch[1] && !/(?:patient|new|fee|diagnosis|pain|follow)/i.test(searchMatch[1].trim())) {
    const q = searchMatch[1].trim();
    return {
      action: 'search',
      searchQuery: q,
      actionSummary: `Search Directory for "${q}"`,
    };
  }

  // 6. Check for Create New Patient (only when explicitly requested to add a new patient)
  const isExplicitCreate =
    /(?:add\s+new\s+patient|register\s+new\s+patient|register\s+patient|create\s+new\s+patient|create\s+patient)\b/i.test(text) ||
    (!existingData?.name && /^add\s+patient\b/i.test(text));
  if (isExplicitCreate) {
    return {
      action: 'create_patient',
      actionSummary: 'Register New Patient Record',
    };
  }

  // 7. Check for Edit named patient (e.g., "for patient Ramesh update diagnosis..." or "edit patient Suresh")
  const editMatch = text.match(/(?:edit\s+patient|update\s+patient|for\s+patient|in\s+patient)\s+([A-Za-z\s.'’]+?)(?=\s*(?:,|\.|\b(?:diagnosis|fee|age|pain|history|contact|phone|address)\b|$))/i);
  if (editMatch && editMatch[1]) {
    const target = editMatch[1].trim();
    return {
      action: 'update_patient',
      targetPatientName: target,
      actionSummary: `Update Patient Chart: ${target}`,
    };
  }

  // 8. Default: Update Active Patient
  return {
    action: 'update_patient',
    targetPatientName: existingData?.name || null,
    actionSummary: existingData?.name
      ? `Update Active Patient: ${existingData.name}`
      : 'Update Clinical Case Sheet Fields',
  };
}

let clientGeminiQuotaPausedUntil = 0;

/**
 * Executes Unified Voice AI extraction:
 * 1. Calls backend `/api/voice-fill` which uses Gemini 3.8 Flash to return structured intent + fields.
 * 2. Falls back to local fast regex NLP if backend is offline or quota limit reached.
 */
export async function executeUnifiedVoiceCommandWithAI(
  transcript: string,
  existingData?: Partial<Patient>
): Promise<UnifiedVoiceCommandResult> {
  const text = transcript.trim();

  // If quota was exceeded recently, do not make network calls that fail; directly use fast local NLP
  if (Date.now() < clientGeminiQuotaPausedUntil) {
    const clientIntent = detectVoiceIntent(text, existingData);
    const clientFields = parseVoiceClinicalTranscript(text, existingData);
    return {
      ...clientIntent,
      fields: clientFields,
      source: 'client-nlp',
    };
  }

  try {
    const res = await fetch('/api/voice-fill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: text, currentData: existingData }),
    });

    if (res.status === 429 || res.status === 503) {
      clientGeminiQuotaPausedUntil = Date.now() + 120000;
    }

    if (res.ok) {
      const data = await res.json();
      if (data.quotaExceeded) {
        clientGeminiQuotaPausedUntil = Date.now() + 120000;
      }
      if (data.success && data.fields) {
        // Multi-date verification: Ensure if multiple dates were spoken, fields.followUps is populated
        const multiDates = parseMultipleSpokenFollowUpDates(text);
        if (multiDates.length > 1 && (!data.fields.followUps || data.fields.followUps.length <= 1)) {
          data.fields.followUps = multiDates.map((d, i) => ({
            action: 'add',
            sessionNumber: (existingData?.followUps?.length || 0) + (i + 1),
            date: d.date,
            time: d.time || data.fields.followUp?.time || '10:00:00',
            notes: data.fields.followUp?.notes || 'Scheduled follow-up session',
            fee: data.fields.followUp?.fee ?? data.fields.treatmentFee ?? existingData?.treatmentFee ?? '500',
            paymentMethod: data.fields.followUp?.paymentMethod || data.fields.paymentMethod || 'UPI',
            visitType: data.fields.followUp?.visitType || data.fields.visitType || 'Clinic',
            seenBy: data.fields.followUp?.seenBy || data.fields.seenBy || 'Dr. Vinay',
          }));
          if (!data.fields.followUp) {
            data.fields.followUp = data.fields.followUps[0];
          }
          data.action = 'add_followup';
          data.actionSummary = existingData?.name
            ? `Schedule ${multiDates.length} Follow-ups for ${existingData.name} on ${multiDates.map((d) => d.date).join(', ')}`
            : `Schedule ${multiDates.length} Follow-up Sessions on ${multiDates.map((d) => d.date).join(', ')}`;
        }

        return {
          action: data.action || (detectVoiceIntent(text, existingData).action),
          targetPatientName: data.targetPatientName || null,
          targetView: data.targetView || null,
          searchQuery: data.searchQuery || null,
          actionSummary: data.actionSummary || detectVoiceIntent(text, existingData).actionSummary,
          fields: data.fields,
          source: 'gemini',
        };
      }
    }
  } catch (err) {
    // Fallback to client parser
  }

  const clientIntent = detectVoiceIntent(text, existingData);
  const clientFields = parseVoiceClinicalTranscript(text, existingData);
  return {
    ...clientIntent,
    fields: clientFields,
    source: 'client-nlp',
  };
}

/**
 * Executes Voice AI extraction:
 * 1. Tries the backend `/api/voice-fill` route with Gemini 3.8 Flash.
 * 2. If backend is offline or no GEMINI_API_KEY is configured, falls back to the client-side NLP parser.
 */
export async function extractClinicalFieldsWithAI(
  transcript: string,
  existingData?: Partial<Patient>
): Promise<{ fields: RecognizedClinicalFields; source: 'gemini' | 'client-nlp' }> {
  const unified = await executeUnifiedVoiceCommandWithAI(transcript, existingData);
  return { fields: unified.fields, source: unified.source };
}

export interface FieldVoiceParseResult {
  intent?:
    | 'next'
    | 'prev'
    | 'skip'
    | 'clear'
    | 'submit'
    | 'next_menu'
    | 'prev_menu'
    | 'goto_menu'
    | 'pause'
    | 'pacing_manual'
    | 'pacing_relaxed'
    | 'pacing_fast'
    | 'switch_mode_existing'
    | 'switch_mode_new';
  menuId?: 'demographics' | 'diagnosis' | 'modalities' | 'billing' | 'followup';
  value?: any;
  confidence?: 'high' | 'medium' | 'low';
  isValid?: boolean;
  error?: string;
  extraFields?: Partial<RecognizedClinicalFields>;
}

/**
 * Parses spoken voice input for a specific individual field.
 * Handles spoken navigation keywords ("next", "previous", "skip", "clear", "submit"),
 * menu switching ("next menu", "go to diagnosis", "modalities menu"),
 * spoken digits, natural prefixes, and clinic-specific formats.
 */
export function parseSingleFieldSpokenValue(
  fieldKey: string,
  spokenText: string
): FieldVoiceParseResult {
  const text = spokenText.trim();
  const lower = text.toLowerCase();

  // 1. Spoken Menu Switching Commands
  if (/\b(?:next\s+menu|go\s+to\s+next\s+menu|next\s+section|forward\s+menu)\b/i.test(lower)) {
    return { intent: 'next_menu' };
  }
  if (/\b(?:prev(?:ious)?\s+menu|back\s+menu|last\s+menu|prior\s+menu)\b/i.test(lower)) {
    return { intent: 'prev_menu' };
  }
  if (/\b(?:menu\s*1|go\s+to\s+(?:demographics|patient\s+info)\s*(?:menu|screen|tab)?|open\s+demographics\s*menu)\b/i.test(lower)) {
    return { intent: 'goto_menu', menuId: 'demographics' };
  }
  if (/\b(?:menu\s*2|go\s+to\s+(?:diagnosis|assessment)\s*(?:menu|screen|tab)?|open\s+diagnosis\s*menu)\b/i.test(lower)) {
    return { intent: 'goto_menu', menuId: 'diagnosis' };
  }
  if (/\b(?:menu\s*3|go\s+to\s+(?:modalities|treatments?)\s*(?:menu|screen|tab)?|open\s+modalities\s*menu)\b/i.test(lower)) {
    return { intent: 'goto_menu', menuId: 'modalities' };
  }
  if (/\b(?:menu\s*4|go\s+to\s+(?:billing|fees?|payment)\s*(?:menu|screen|tab)?|open\s+(?:billing|fee)\s*menu)\b/i.test(lower)) {
    return { intent: 'goto_menu', menuId: 'billing' };
  }
  if (/\b(?:menu\s*5|go\s+to\s+follow\s*ups?\s*(?:menu|screen|tab)?|open\s+follow\s*up\s*menu)\b/i.test(lower)) {
    return { intent: 'goto_menu', menuId: 'followup' };
  }

  // 2. Pause / Wait Commands (Give user control to slow down or pause)
  if (/\b(?:wait|hold\s+on|pause|give\s+me\s+a\s+(?:moment|second|sec)|stop\s+(?:moving|advancing)|don'?t\s+move|dont\s+move|stay\s+here|stay|slow\s+down)\b/i.test(lower)) {
    return { intent: 'pause' };
  }

  // 2b. Spoken Pacing Mode Controls
  if (/\b(?:manual\s+mode|switch\s+to\s+manual|manual\s+pacing|don'?t\s+auto\s+advance|stop\s+auto\s+advance|no\s+auto\s+advance|wait\s+for\s+me)\b/i.test(lower)) {
    return { intent: 'pacing_manual' };
  }
  if (/\b(?:relaxed\s+mode|slow\s+mode|relaxed\s+pace|slow\s+pace)\b/i.test(lower)) {
    return { intent: 'pacing_relaxed' };
  }
  if (/\b(?:fast\s+mode|quick\s+mode|fast\s+pace|speed\s+up)\b/i.test(lower)) {
    return { intent: 'pacing_fast' };
  }

  // 2c. Spoken Mode Switching (New Patient vs Existing Patient Follow-up)
  if (/\b(?:switch\s+to\s+existing(?:\s+patients?)?|existing\s+patients?(?:\s+mode)?|follow\s*up\s+mode|follow\s*up\s+mechanism|go\s+to\s+existing(?:\s+patient)?|existing\s+patient\s+follow\s*up)\b/i.test(lower)) {
    return { intent: 'switch_mode_existing' };
  }
  if (/\b(?:switch\s+to\s+new(?:\s+patient)?|new\s+patient(?:\s+mode)?|register\s+new(?:\s+patient)?|add\s+new\s+patient)\b/i.test(lower)) {
    return { intent: 'switch_mode_new' };
  }

  // 3. Spoken Registration / Submit Commands (Immediate registration or follow-up schedule from ANY field or menu)
  if (
    /\b(?:register\s+(?:the\s+)?patient(?:\s+now)?|register\s+now|save\s+(?:the\s+)?patient|submit(?:\s+the\s+patient|\s+record|\s+patient)?|finish\s+registration|complete\s+registration|confirm\s+registration|schedule\s+(?:the\s+)?follow\s*ups?|schedule\s+now|confirm\s+follow\s*up|book\s+follow\s*up)\b/i.test(lower) ||
    /^(?:submit|save|save\s+patient|register|register\s+patient|schedule|schedule\s+followup|schedule\s+follow-up|finish|done|complete|confirm)$/i.test(lower)
  ) {
    return { intent: 'submit' };
  }

  // 4. Spoken Field Navigation & Control Commands
  if (/^(?:next|next\s+field|go\s+next|continue|forward)$/i.test(lower)) {
    return { intent: 'next' };
  }
  if (/^(?:previous|prev|back|go\s+back)$/i.test(lower)) {
    return { intent: 'prev' };
  }
  if (/^(?:skip|skip\s+field|leave|ignore|pass)$/i.test(lower)) {
    return { intent: 'skip' };
  }
  if (/^(?:clear|clear\s+field|reset|erase|remove)$/i.test(lower)) {
    return { intent: 'clear', value: '' };
  }

  // 3. Field-specific parsing
  switch (fieldKey) {
    case 'name': {
      let cleaned = text
        .replace(/^(?:(?:register|add|create|new)\s+(?:new\s+)?patient\s*(?:is)?|register\s+patient|new\s+patient|patient\s+(?:full\s+)?(?:name\s+)?(?:is\s+)?|my\s+name\s+is\s+|name\s+is\s+|it\s+is\s+|patient\s+)/i, '')
        .replace(/[.,;:]+$/, '')
        .trim();

      // If user spoke multi-field into name (e.g. "Ramesh age 45 phone 9880517715"), isolate the name before subsequent fields
      const multiFieldBreak = cleaned.match(/^([A-Za-z.'’]+(?:\s+[A-Za-z.'’]+){0,2})\s+(?:\b(?:age\s+(?:is\s+)?\d+|\d+\s*years?\s*old|\d+\s*years?|\d+\s*yrs?|phone|mobile|contact|male|female|diagnosis|suffering)\b)/i);
      if (multiFieldBreak && multiFieldBreak[1]) {
        cleaned = multiFieldBreak[1].trim();
      }

      if (cleaned) {
        cleaned = cleaned
          .split(/\s+/)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
        return { value: cleaned, isValid: cleaned.length >= 2 };
      }
      return { value: text, isValid: text.length >= 2 };
    }

    case 'age': {
      // Check for accompanying gender (e.g. "45 male", "he is 45", "45 female", "she is 45")
      let accompanyingSex: 'Male' | 'Female' | 'Other' | undefined = undefined;
      if (/\b(?:female|woman|lady|girl|she|her)\b/i.test(lower)) {
        accompanyingSex = 'Female';
      } else if (/\b(?:male|man|gentleman|boy|he|his)\b/i.test(lower)) {
        accompanyingSex = 'Male';
      } else if (/\b(?:other|transgender|non-binary|non\s*binary)\b/i.test(lower)) {
        accompanyingSex = 'Other';
      }

      // 1. Spaced single digits like "4 5" or "4 - 5" -> 45
      const spacedDigits = lower.match(/\b([1-9])\s*[- ]\s*([0-9])\b/);
      if (spacedDigits) {
        const combined = parseInt(spacedDigits[1] + spacedDigits[2], 10);
        if (combined >= 1 && combined <= 120) {
          return {
            value: combined,
            isValid: true,
            extraFields: accompanyingSex ? { sex: accompanyingSex } : undefined,
          };
        }
      }

      // 2. Direct number with or without suffixes/prefixes: "45", "45y", "45yo", "45yr", "45yrs", "45 years", "45 male", "he is 45", "age is 45"
      const numMatch = lower.match(/(?:age\s*(?:is)?\s*|he\s*is\s*|she\s*is\s*|patient\s*is\s*|around\s*|about\s*)?(\d{1,3})(?:\s*(?:years?|yrs?|yo|y)\b|\s*y\b|\b|$)/i);
      if (numMatch && numMatch[1]) {
        const n = parseInt(numMatch[1], 10);
        if (n >= 1 && n <= 120) {
          return {
            value: n,
            isValid: true,
            extraFields: accompanyingSex ? { sex: accompanyingSex } : undefined,
          };
        }
      }

      // 3. Spoken digit pairs like "six zero", "four five", "two five"
      const singleDigits: Record<string, string> = {
        zero: '0', one: '1', won: '1', two: '2', to: '2', too: '2',
        three: '3', tree: '3', four: '4', for: '4', five: '5',
        six: '6', seven: '7', eight: '8', ate: '8', nine: '9',
      };
      const words = lower.replace(/[^a-z0-9\s-]/g, ' ').split(/[\s-]+/);
      for (let i = 0; i < words.length - 1; i++) {
        if (singleDigits[words[i]] !== undefined && singleDigits[words[i + 1]] !== undefined) {
          const combined = parseInt(singleDigits[words[i]] + singleDigits[words[i + 1]], 10);
          if (combined >= 1 && combined <= 120) {
            return {
              value: combined,
              isValid: true,
              extraFields: accompanyingSex ? { sex: accompanyingSex } : undefined,
            };
          }
        }
      }

      // 4. Standard spoken English numbers (e.g. "forty five", "thirty two", "twenty", "sixty")
      const wordNumMap: Record<string, number> = {
        zero: 0, one: 1, won: 1, two: 2, to: 2, too: 2, three: 3, tree: 3, four: 4, for: 4, five: 5,
        six: 6, seven: 7, eight: 8, ate: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
        thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
        twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
      };
      let sum = 0;
      let matchedAny = false;
      for (const w of words) {
        if (wordNumMap[w] !== undefined) {
          sum += wordNumMap[w];
          matchedAny = true;
        }
      }
      if (matchedAny && sum >= 1 && sum <= 120) {
        return {
          value: sum,
          isValid: true,
          extraFields: accompanyingSex ? { sex: accompanyingSex } : undefined,
        };
      }
      return { value: text, isValid: false, error: 'Please say a valid age between 1 and 120' };
    }

    case 'sex': {
      if (/\b(?:female|woman|lady|girl|she|her)\b/i.test(lower)) {
        return { value: 'Female', isValid: true };
      }
      if (/\b(?:male|man|gentleman|boy|he|his)\b/i.test(lower)) {
        return { value: 'Male', isValid: true };
      }
      if (/\b(?:other|transgender|non-binary)\b/i.test(lower)) {
        return { value: 'Other', isValid: true };
      }
      return { value: 'Male', isValid: true };
    }

    case 'contact': {
      // First check if already contains direct 10-digit number (possibly with spaces/dashes)
      const directDigits = text.replace(/\D/g, '');
      if (directDigits.length === 10) {
        return { value: directDigits, isValid: true };
      }
      if (directDigits.length > 10 && directDigits.startsWith('91')) {
        return { value: directDigits.slice(-10), isValid: true };
      }

      const digitWordMap: Record<string, string> = {
        zero: '0', oh: '0', o: '0', one: '1', two: '2', three: '3', four: '4', five: '5',
        six: '6', seven: '7', eight: '8', nine: '9',
      };
      let digitStr = '';
      const tokens = lower.split(/[\s-]+/);
      for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i];
        if (tok === 'double' && i + 1 < tokens.length) {
          const next = tokens[i + 1];
          const d = /^\d$/.test(next) ? next : digitWordMap[next];
          if (d) {
            digitStr += d + d;
            i++;
            continue;
          }
        }
        if (tok === 'triple' && i + 1 < tokens.length) {
          const next = tokens[i + 1];
          const d = /^\d$/.test(next) ? next : digitWordMap[next];
          if (d) {
            digitStr += d + d + d;
            i++;
            continue;
          }
        }
        if (/^\d+$/.test(tok)) {
          digitStr += tok;
        } else if (digitWordMap[tok] !== undefined) {
          digitStr += digitWordMap[tok];
        }
      }
      if (digitStr.length >= 7) {
        const phone = digitStr.length > 10 ? digitStr.slice(-10) : digitStr;
        return { value: phone, isValid: phone.length >= 7 };
      }
      return { value: text, isValid: false, error: 'Please say a 10-digit mobile number' };
    }

    case 'address': {
      let addr = text
        .replace(/^(?:residential\s+address\s+(?:is\s+)?|address\s+(?:is\s+)?|living\s+(?:in|at)\s+|residing\s+(?:in|at)\s+|area\s+(?:is\s+)?)/i, '')
        .trim();
      if (addr) {
        addr = addr
          .split(/\s+/)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
        return { value: addr, isValid: addr.length >= 2 };
      }
      return { value: text, isValid: text.length >= 2 };
    }

    case 'date': {
      if (/\b(?:today|now)\b/i.test(lower)) {
        return { value: new Date().toISOString().slice(0, 10), isValid: true };
      }
      if (/\b(?:yesterday)\b/i.test(lower)) {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return { value: d.toISOString().slice(0, 10), isValid: true };
      }
      const match = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
      if (match) return { value: match[1], isValid: true };
      return { value: new Date().toISOString().slice(0, 10), isValid: true };
    }

    case 'height': {
      // E.g. "5 foot 6", "5'6", "5 feet 8 inches", "168 cm", "five six"
      const ftInMatch = lower.match(/(\d)\s*(?:foot|feet|ft|'|\s)\s*(\d{1,2})?\s*(?:inches|inch|in|")?/);
      if (ftInMatch) {
        const feet = ftInMatch[1];
        const inches = ftInMatch[2] || '0';
        return { value: `${feet}'${inches}"`, isValid: true };
      }
      const cmMatch = lower.match(/(\d{2,3})\s*(?:cm|centimeters?)/);
      if (cmMatch) {
        const cm = parseInt(cmMatch[1], 10);
        const totalInches = Math.round(cm / 2.54);
        const feet = Math.floor(totalInches / 12);
        const inches = totalInches % 12;
        return { value: `${feet}'${inches}"`, isValid: true };
      }
      return { value: text, isValid: text.trim().length > 0 };
    }

    case 'weight': {
      // E.g. "65 kg", "70", "seventy two kilograms"
      const digitMatch = text.match(/\b(\d{2,3})\b/);
      if (digitMatch) {
        const w = parseInt(digitMatch[1], 10);
        if (w >= 10 && w <= 250) {
          return { value: String(w), isValid: true };
        }
      }
      return { value: text.replace(/\D/g, '') || '65', isValid: true };
    }

    case 'bloodGroup': {
      const bgMatch = lower.match(/\b(a|b|ab|o)\s*(positive|\+|negative|-)\b/i);
      if (bgMatch) {
        const type = bgMatch[1].toUpperCase();
        const sign = /positive|\+/i.test(bgMatch[2]) ? '+' : '-';
        return { value: `${type}${sign}`, isValid: true };
      }
      for (const bg of BLOOD_GROUPS) {
        if (lower.includes(bg.toLowerCase())) return { value: bg, isValid: true };
      }
      return { value: 'O+', isValid: true };
    }

    case 'referredBy': {
      if (/\b(?:self|direct|none|nil|walk\s*in)\b/i.test(lower)) {
        return { value: 'Self', isValid: true };
      }
      let cleaned = text.replace(/^(?:referred\s+by\s+|ref\s+by\s+|doctor\s+)/i, 'Dr. ').trim();
      return { value: cleaned, isValid: cleaned.length >= 2 };
    }

    case 'seenBy': {
      let cleaned = text.replace(/^(?:seen\s+by\s+|physio\s+(?:is\s+)?|doctor\s+)/i, '').trim();
      return { value: cleaned || 'R. Chandrashekar', isValid: true };
    }

    case 'diagnosis': {
      let diag = text
        .replace(/^(?:clinical\s+diagnosis\s+(?:is\s+)?|diagnosis\s+(?:is\s+)?|suffering\s+from\s+|having\s+|complaining\s+of\s+|problem\s+is\s+)/i, '')
        .trim();
      for (const cd of COMMON_DIAGNOSES) {
        if (cd.toLowerCase() === diag.toLowerCase() || diag.toLowerCase().includes(cd.toLowerCase())) {
          return { value: cd, isValid: true };
        }
      }
      if (diag.length >= 2) {
        diag = diag.charAt(0).toUpperCase() + diag.slice(1);
        return { value: diag, isValid: true };
      }
      return { value: text, isValid: text.length >= 2 };
    }

    case 'history':
    case 'notes': {
      let cleaned = text.trim();
      if (cleaned) {
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        return { value: cleaned, isValid: true };
      }
      return { value: text, isValid: false };
    }

    case 'painScaleBefore':
    case 'painScaleAfter': {
      const match = text.match(/\b(\d{1,2})\b/);
      if (match) {
        const val = parseInt(match[1], 10);
        if (val >= 0 && val <= 10) {
          return { value: val, isValid: true };
        }
      }
      if (/\b(?:zero|no\s+pain|nil|none)\b/i.test(lower)) return { value: 0, isValid: true };
      if (/\b(?:mild)\b/i.test(lower)) return { value: 3, isValid: true };
      if (/\b(?:moderate)\b/i.test(lower)) return { value: 5, isValid: true };
      if (/\b(?:severe|high)\b/i.test(lower)) return { value: 8, isValid: true };
      return { value: text, isValid: false, error: 'Please say a pain scale from 0 to 10' };
    }

    case 'comorbid': {
      const hasDiabetes = /\b(?:diabetes|diabetic|sugar)\b/i.test(lower);
      const hasBP = /\b(?:bp|hypertension|blood\s+pressure|high\s+bp)\b/i.test(lower);
      const hasThyroid = /\b(?:thyroid|hypo|hyper)\b/i.test(lower);
      const isNil = /\b(?:none|nil|no|nothing|normal|healthy|clear)\b/i.test(lower);
      return {
        value: {
          diabetes: hasDiabetes,
          bp: hasBP,
          thyroid: hasThyroid,
          other: !isNil && !hasDiabetes && !hasBP && !hasThyroid,
          otherText: !isNil && !hasDiabetes && !hasBP && !hasThyroid ? text : '',
        },
        isValid: true,
      };
    }

    case 'modalities': {
      // Check which clinical modalities are mentioned
      const matchedKeys: string[] = [];
      for (const item of MODALITIES_LIST) {
        const key = item.key;
        const lbl = item.label.toLowerCase();
        if (
          lower.includes(key.toLowerCase()) ||
          lower.includes(lbl) ||
          (key === 'ift' && /\bift\b/i.test(lower)) ||
          (key === 'ust' && /\b(?:ust|ultrasound)\b/i.test(lower)) ||
          (key === 'tens' && /\btens\b/i.test(lower)) ||
          (key === 'moist' && /\b(?:moist|heat|hydrocollator)\b/i.test(lower)) ||
          (key === 'coldPack' && /\b(?:cold|ice|cryo)\b/i.test(lower)) ||
          (key === 'exercise' && /\b(?:exercise|strengthening|rom)\b/i.test(lower)) ||
          (key === 'manual' && /\b(?:manual|mobilization|mfr)\b/i.test(lower)) ||
          (key === 'cervicalTraction' && /\b(?:cervical|neck\s+traction)\b/i.test(lower)) ||
          (key === 'pelvicTraction' && /\b(?:pelvic|lumbar\s+traction|back\s+traction)\b/i.test(lower)) ||
          (key === 'paraffin' && /\b(?:paraffin|wax)\b/i.test(lower)) ||
          (key === 'nmes' && /\bnmes\b/i.test(lower)) ||
          (key === 'postural' && /\b(?:postur|ergonomic)\b/i.test(lower)) ||
          (key === 'gait' && /\bgait\b/i.test(lower))
        ) {
          matchedKeys.push(item.label);
        }
      }
      return {
        value: matchedKeys.length > 0 ? matchedKeys : [text],
        isValid: text.trim().length > 0,
      };
    }

    case 'treatmentNotes': {
      return { value: text.trim(), isValid: text.trim().length > 0 };
    }

    case 'visitType': {
      if (/\b(?:home|home\s+visit|house|domiciliary)\b/i.test(lower)) {
        return { value: 'Home Visit', isValid: true };
      }
      return { value: 'Clinic', isValid: true };
    }

    case 'fee':
    case 'treatmentFee': {
      // 1. Spoken zero / free / nil / no fee (including speech-to-text accent variants)
      if (
        /\b(?:zero|nil|nill|free|no\s*fee|none|null|nothing|zeero|cero|hero|no\s*charge|zero\s*charge|rupees?\s*zero|zero\s*rupees?|0\s*rupees?|rupees?\s*0|rs\.?\s*0|0\s*rs\.?|₹\s*0)\b/i.test(lower) ||
        lower.trim() === '0' ||
        lower.trim() === 'o' ||
        lower.trim() === '00' ||
        /\b(?:fee|charge|cost|amount)?\s*(?:is\s*)?(?:0|zero|nil|free|none)\b/i.test(lower) ||
        /^[:=]?\s*(?:rs\.?|inr|₹)?\s*0\b/i.test(lower.trim())
      ) {
        return { value: '0', isValid: true };
      }
      if (/\bdefault\b/i.test(lower)) {
        return { value: '500', isValid: true };
      }
      // 2. English number words
      if (/\b(?:five\s*hundred)\b/i.test(lower)) return { value: '500', isValid: true };
      if (/\b(?:three\s*hundred)\b/i.test(lower)) return { value: '300', isValid: true };
      if (/\b(?:four\s*hundred)\b/i.test(lower)) return { value: '400', isValid: true };
      if (/\b(?:six\s*hundred)\b/i.test(lower)) return { value: '600', isValid: true };
      if (/\b(?:seven\s*hundred)\b/i.test(lower)) return { value: '700', isValid: true };
      if (/\b(?:eight\s*hundred)\b/i.test(lower)) return { value: '800', isValid: true };
      if (/\b(?:thousand|one\s*thousand)\b/i.test(lower)) return { value: '1000', isValid: true };

      // 3. Numbers from digits
      const match = text.match(/\b(\d{1,6})\b/);
      if (match) {
        return { value: match[1], isValid: true };
      }
      return { value: '0', isValid: true };
    }

    case 'paymentMethod': {
      if (/\b(?:cash)\b/i.test(lower)) return { value: 'Cash', isValid: true };
      if (/\b(?:upi|gpay|google\s+pay|phonepe|phone\s+pe|paytm|online|qr)\b/i.test(lower)) return { value: 'UPI', isValid: true };
      if (/\b(?:card|debit|credit|swipe)\b/i.test(lower)) return { value: 'Card', isValid: true };
      if (/\b(?:due|pending|later)\b/i.test(lower)) return { value: 'Due', isValid: true };
      if (/\b(?:bank|transfer|neft|rtgs|net\s+banking)\b/i.test(lower)) return { value: 'Bank Transfer', isValid: true };
      return { value: 'UPI', isValid: true };
    }

    case 'followUps':
    case 'followUp': {
      const multi = parseMultipleSpokenFollowUpDates(text);
      if (multi.length > 0) {
        return { value: multi, isValid: true };
      }
      const single = parseSpokenDateAndTimeToISO(text);
      if (single.date) {
        return {
          value: [{ action: 'add', date: single.date, time: single.time || '10:00:00', notes: 'Scheduled follow-up session' }],
          isValid: true,
        };
      }
      return {
        value: [
          {
            action: 'add',
            date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
            time: '10:00:00',
            notes: text || 'Scheduled follow-up session',
          },
        ],
        isValid: text.trim().length > 0,
      };
    }

    default:
      return { value: text, isValid: text.trim().length > 0 };
  }
}
