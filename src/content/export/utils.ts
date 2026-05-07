/**
 * Export Utilities
 * Shared constants and helper functions for the export module.
 */

/** Markdown link to navigate back to the table of contents */
export const BACK_TO_TOP_LINK = '\n___\n###### [top](#table-of-contents)\n';

/** Truncate a string to the given length, appending "..." if needed */
export function truncate(str: string, len = 70): string {
  return str.length <= len ? str : str.slice(0, len).trim() + '...';
}

/** Escape Markdown special characters in text */
export function escapeMd(text: string): string {
  return text.replace(/[|\\`*_{}()#+\-!>[\]]/g, '\\$&');
}

/** Format a Date as a local ISO-like string with timezone offset */
export function formatLocalTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const tzOffsetMin = -d.getTimezoneOffset();
  const sign = tzOffsetMin >= 0 ? '+' : '-';
  const absOffset = Math.abs(tzOffsetMin);
  const offsetHours = pad(Math.floor(absOffset / 60));
  const offsetMinutes = pad(absOffset % 60);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}-${pad(d.getMinutes())}-${pad(d.getSeconds())}${sign}${offsetHours}${offsetMinutes}`;
}
