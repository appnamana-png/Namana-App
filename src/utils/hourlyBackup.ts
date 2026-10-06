import { Patient, ClinicSettings } from '../types';
import {
  parseDateAndTimestamp,
  getLocumPhysiotherapists,
  getCommonReferralDoctors,
  getFollowUpTreatmentsList,
} from './storage';
import { pushToGoogleAppsScript } from './googleSheetsSync';

export const HOURLY_BACKUP_LATEST_KEY = 'physio_hourly_backup_latest';
export const HOURLY_BACKUP_TIMESTAMP_KEY = 'physio_last_hourly_backup_timestamp';
export const HOURLY_BACKUP_HOUR_KEY = 'physio_last_hourly_backup_hour_key';
export const HOURLY_BACKUP_HISTORY_KEY = 'physio_hourly_backup_history';

export interface HourlyBackupRecord {
  id: string;
  timestamp: string; // ISO string
  hourKey: string; // e.g. "2026-09-11 10:00"
  displayTime: string; // e.g. "10:00 AM"
  patientCount: number;
  status: 'success' | 'warning' | 'error';
  pushedToSheets: boolean;
  message: string;
}

export interface HourlyBackupSnapshot {
  timestamp: string;
  backupType: 'Auto_Hourly_Backup' | 'Manual_Hourly_Snapshot';
  hourKey: string;
  patients: Patient[];
  settings: ClinicSettings;
  locums: any[];
  referrals: string[];
  customTreatments?: string[];
}

/**
 * Generates the local date and hour key, e.g. "2026-09-11 10:00".
 * Uses local time so that hourly triggers strictly align with the user's clock (10:00 AM).
 */
export function getCurrentHourKey(d = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:00`;
}

/**
 * Formats time for display in strict 24-hour format HH:MM:SS
 */
export function formatDisplayTime(d = new Date()): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/**
 * Checks whether an hourly backup is due.
 * A backup is due if:
 * 1. Current hour key has not yet been executed in localStorage.
 * 2. OR more than 60 minutes have elapsed since the last backup.
 * 3. OR no backup has ever been recorded.
 */
export function isHourlyBackupDue(now = new Date()): boolean {
  try {
    const currentKey = getCurrentHourKey(now);
    const lastRanKey = localStorage.getItem(HOURLY_BACKUP_HOUR_KEY);

    if (!lastRanKey) {
      return true;
    }

    if (lastRanKey !== currentKey) {
      return true;
    }

    const lastTimestamp = localStorage.getItem(HOURLY_BACKUP_TIMESTAMP_KEY);
    if (lastTimestamp) {
      const elapsedMs = now.getTime() - new Date(lastTimestamp).getTime();
      if (elapsedMs >= 60 * 60 * 1000) {
        return true;
      }
    }

    return false;
  } catch (err) {
    console.warn('Error evaluating isHourlyBackupDue', err);
    return false;
  }
}

/**
 * Calculates milliseconds remaining until the top of the next hour (:00:00.000).
 */
export function getMsUntilNextHour(now = new Date()): number {
  const nextHour = new Date(now);
  nextHour.setHours(now.getHours() + 1);
  nextHour.setMinutes(0);
  nextHour.setSeconds(0);
  nextHour.setMilliseconds(0);
  const diff = nextHour.getTime() - now.getTime();
  return Math.max(1000, diff);
}

/**
 * Calculates human-readable countdown info to the next scheduled hourly backup.
 */
export function getNextHourCountdown(now = new Date()): {
  minutes: number;
  seconds: number;
  nextHourStr: string;
  targetDate: Date;
} {
  const nextHour = new Date(now);
  nextHour.setHours(now.getHours() + 1);
  nextHour.setMinutes(0);
  nextHour.setSeconds(0);
  nextHour.setMilliseconds(0);

  const diffMs = Math.max(0, nextHour.getTime() - now.getTime());
  const totalSec = Math.floor(diffMs / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;

  const hours12 = nextHour.getHours() % 12 || 12;
  const ampm = nextHour.getHours() >= 12 ? 'PM' : 'AM';
  const nextHourStr = `${String(hours12).padStart(2, '0')}:00 ${ampm}`;

  return { minutes, seconds, nextHourStr, targetDate: nextHour };
}

/**
 * Retrieves the history of hourly backup executions from localStorage.
 */
export function getHourlyBackupHistory(): HourlyBackupRecord[] {
  try {
    const raw = localStorage.getItem(HOURLY_BACKUP_HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Failed to parse hourly backup history', e);
  }
  return [];
}

/**
 * Adds an execution record to the hourly backup history (max 24 records).
 */
function recordHourlyBackupHistory(record: HourlyBackupRecord): void {
  try {
    const history = getHourlyBackupHistory();
    // Keep most recent first, filter duplicates for the exact same hourKey if desired
    const updated = [record, ...history.filter((r) => r.id !== record.id)].slice(0, 24);
    localStorage.setItem(HOURLY_BACKUP_HISTORY_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to persist hourly backup history', e);
  }
}

/**
 * Executes a full hourly backup snapshot.
 * Stores local snapshot in localStorage, marks hour key & timestamp,
 * and if Google Apps Script Webhook is configured and auto-push is enabled, pushes to Google Sheets.
 */
export async function executeHourlyBackup(
  patients: Patient[],
  settings: ClinicSettings,
  options?: { isManual?: boolean }
): Promise<{
  success: boolean;
  message: string;
  snapshot: HourlyBackupSnapshot;
  settingsUpdate?: Partial<ClinicSettings>;
  record: HourlyBackupRecord;
}> {
  const now = new Date();
  const currentKey = getCurrentHourKey(now);
  const displayTime = formatDisplayTime(now);

  // Sanitize all patients and follow-up sessions
  const cleanPatients = patients.map((p) => {
    const { cleanDate, cleanTime } = parseDateAndTimestamp(p.date, p.time, p.updatedAt || p.createdAt);
    return {
      ...p,
      date: cleanDate,
      time: cleanTime,
      followUps: (p.followUps || []).map((fu, idx) => {
        const fuDt = parseDateAndTimestamp(fu.date, fu.time, fu.updatedAt || fu.createdAt || p.updatedAt || p.createdAt);
        return {
          ...fu,
          id: fu.id || `fu_${p.id}_${idx + 1}`,
          date: fuDt.cleanDate,
          time: fuDt.cleanTime,
        };
      }),
    };
  });

  const snapshot: HourlyBackupSnapshot = {
    timestamp: now.toISOString(),
    backupType: options?.isManual ? 'Manual_Hourly_Snapshot' : 'Auto_Hourly_Backup',
    hourKey: currentKey,
    patients: cleanPatients,
    settings,
    locums: getLocumPhysiotherapists(),
    referrals: getCommonReferralDoctors(),
    customTreatments: getFollowUpTreatmentsList(),
  };

  let finalStatus: 'success' | 'warning' | 'error' = 'success';

  // 1. Save snapshot to localStorage
  try {
    localStorage.setItem(HOURLY_BACKUP_LATEST_KEY, JSON.stringify(snapshot));
    localStorage.setItem(HOURLY_BACKUP_HOUR_KEY, currentKey);
    localStorage.setItem(HOURLY_BACKUP_TIMESTAMP_KEY, now.toISOString());
  } catch (storageErr) {
    finalStatus = 'error';
    console.error('LocalStorage write failed during hourly backup', storageErr);
  }

  // 2. Google Apps Script Webhook push
  const webhookUrl = settings.sheetsWebhookUrl || settings.googleAppsScriptWebhook;
  let pushedToSheets = false;
  let sheetPushMessage = '';

  if (webhookUrl && settings.autoHourlyPush !== false) {
    try {
      const res = await pushToGoogleAppsScript(webhookUrl, cleanPatients, {
        archiveSheet1Id: settings.archiveSheetId1,
        archiveSheet2Id: settings.archiveSheetId2,
      });
      if (res.success) {
        pushedToSheets = true;
        sheetPushMessage = ' & synchronized with Google Sheets';
      } else {
        finalStatus = 'warning';
        sheetPushMessage = ` (Google Sheets push issue: ${res.message})`;
      }
    } catch (err: any) {
      finalStatus = 'warning';
      sheetPushMessage = ` (Google Sheets push failed: ${err?.message || 'Network issue'})`;
      console.warn('Hourly backup push to Google Sheets failed:', err);
    }
  }

  const resultMessage = options?.isManual
    ? `Manual backup snapshot created for ${cleanPatients.length} patient records at ${displayTime}${sheetPushMessage}.`
    : `Hourly backup completed: ${cleanPatients.length} patient records safely archived at ${displayTime}${sheetPushMessage}.`;

  const record: HourlyBackupRecord = {
    id: `hb_${now.getTime()}`,
    timestamp: now.toISOString(),
    hourKey: currentKey,
    displayTime,
    patientCount: cleanPatients.length,
    status: finalStatus,
    pushedToSheets,
    message: resultMessage,
  };

  recordHourlyBackupHistory(record);

  // Prepare settings update to keep clinic state in sync
  const settingsUpdate: Partial<ClinicSettings> = {
    lastHourlyBackupAt: now.toISOString(),
    lastHourlyBackupStatus: finalStatus === 'error' ? 'error' : 'success',
    lastHourlyBackupMessage: resultMessage,
  };

  if (pushedToSheets) {
    settingsUpdate.lastSheetsSyncAt = now.toISOString();
    settingsUpdate.lastSheetsSyncStatus = 'success';
    settingsUpdate.lastSheetsSyncMessage = `Hourly auto-backup pushed ${cleanPatients.length} records`;
  }

  // Broadcast event so any open UI component updates immediately
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('physio-hourly-backup-complete', {
        detail: {
          record,
          snapshot,
          timestamp: now.toISOString(),
        },
      })
    );
  }

  return {
    success: true,
    message: resultMessage,
    snapshot,
    settingsUpdate,
    record,
  };
}
