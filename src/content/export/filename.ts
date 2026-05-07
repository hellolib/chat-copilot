/**
 * Filename template engine
 */

import { formatLocalTime } from './utils';

/**
 * Slugify a string for safe use in filenames
 */
function slugify(str: string, keepCase = false, maxLength = 120): string {
  if (typeof str !== 'string') {
    return 'invalid-filename';
  }
  let result = keepCase ? str : str.toLocaleLowerCase();
  result = result
    .replace(/[^a-zA-Z0-9\-_.+]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/^$/, 'invalid-filename')
    .slice(0, maxLength);
  return result;
}

export function formatFileName(
  template: string,
  title: string,
  platform: string,
  tags: string[],
  ext: string,
): string {
  const now = new Date();
  const cleanedTitle = title.slice(0, 70).toLocaleLowerCase();

  const replacements: Record<string, string> = {
    '{platform}': platform,
    '{title}': cleanedTitle,
    '{timestamp}': now.toISOString(),
    '{timestampLocal}': formatLocalTime(now),
    '{tags}': tags.join('-').toLocaleLowerCase(),
    '{exporter}': 'chat-copilot',
  };

  // Add individual tags (tag1 to tag9)
  for (let i = 0; i < 9; i++) {
    replacements[`{tag${i + 1}}`] = tags[i] ? tags[i].toLocaleLowerCase() : '';
  }

  let formatted = template;
  for (const [placeholder, value] of Object.entries(replacements)) {
    formatted = formatted.split(placeholder).join(value);
  }

  // Remove trailing underscores or hyphens
  formatted = formatted.replace(/(_+|-+)$/, '');
  return slugify(`${formatted}.${ext}`, false);
}
