const KEY_SKIP = 'didifkup_offramp_skip';
const KEY_LAST_SHOWN = 'didifkup_offramp_last_shown';

/** Returns today's date as "YYYY-MM-DD" in local time. */
export function getTodayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getSkipOffRamp(): boolean {
  try {
    const v = localStorage.getItem(KEY_SKIP);
    return v === 'true';
  } catch {
    return false;
  }
}

export function setSkipOffRamp(v: boolean): void {
  try {
    localStorage.setItem(KEY_SKIP, String(v));
  } catch {
    /* localStorage unavailable */
  }
}

export function getLastShownDate(): string | null {
  try {
    return localStorage.getItem(KEY_LAST_SHOWN);
  } catch {
    return null;
  }
}

export function setLastShownDate(dateStr: string): void {
  try {
    localStorage.setItem(KEY_LAST_SHOWN, dateStr);
  } catch {
    /* localStorage unavailable */
  }
}

export function shouldShowOffRampToday(): boolean {
  try {
    if (getSkipOffRamp()) return false;
    const last = getLastShownDate();
    const today = getTodayKey();
    if (last === today) return false;
    return true;
  } catch {
    return true;
  }
}
