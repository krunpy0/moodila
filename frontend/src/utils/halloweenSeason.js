/**
 * Utility to determine whether the Halloween theme feature is in season.
 * The Halloween selector is active throughout October and early November,
 * and disappears starting on November 5th (00:00:00).
 */

export function isHalloweenSeasonAvailable(dateInput) {
  let date;
  if (dateInput !== undefined && dateInput !== null) {
    date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  } else {
    // Check for optional test/mock override in browser environment
    if (typeof window !== 'undefined') {
      try {
        const mock =
          window.__MOODILA_MOCK_DATE__ ||
          (typeof localStorage !== 'undefined' && localStorage.getItem('moodshare_mock_date'));
        if (mock) {
          date = new Date(mock);
        }
      } catch {
        // Fallback to current date
      }
    }
    if (!date) {
      date = new Date();
    }
  }

  // Month is 0-indexed: 9 = October, 10 = November
  const month = date.getMonth();
  const day = date.getDate();

  // Active during all of October (month 9)
  if (month === 9) {
    return true;
  }

  // Active in November before November 5th (month 10, days 1 through 4)
  if (month === 10 && day < 5) {
    return true;
  }

  // Starting on November 5th (month 10, day >= 5) or any other month, feature is unavailable
  return false;
}
