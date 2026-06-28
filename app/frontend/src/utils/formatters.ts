/**
 * GreenGuard — Utility: Formatters
 */

/**
 * Formats a number with comma separators.
 * e.g. 1250 → "1,250"
 */
export const formatNumber = (value: number = 0): string => {
  return (value || 0).toLocaleString('en-US');
};

/**
 * Formats points display.
 * e.g. 1250 → "1,250 pts"
 */
export const formatPoints = (points: number): string => {
  return `${formatNumber(points)} pts`;
};

/**
 * Formats an ISO date string to a readable format.
 * e.g. "2025-08-17T21:30:00Z" → "17 Aug 2025, 9:30 pm"
 */
export const formatDate = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }) + ', ' + date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).toLowerCase();
};

/**
 * Formats a time-ago string.
 * e.g. "1 Days" | "1 Weeks"
 */
export const formatTimeAgo = (isoString: string): string => {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1 Day';
  if (diffDays < 7) return `${diffDays} Days`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks === 1) return '1 Week';
  return `${diffWeeks} Weeks`;
};

/**
 * Calculates progress percentage (0-100).
 */
export const calcProgress = (current: number, target: number): number => {
  if (target === 0) return 0;
  return Math.min(Math.round((current / target) * 100), 100);
};

/**
 * Formats expiry label.
 * e.g. "Ends on 30 Jun 2026"
 */
export const formatExpiry = (expiresAt: string): string => {
  if (expiresAt === 'Ongoing') return 'Ongoing';
  return `Ends on ${expiresAt}`;
};
