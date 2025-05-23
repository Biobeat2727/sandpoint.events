// utils/formatDate.js
export function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    month: 'short',  // e.g., Jun
    day: 'numeric',  // 5
    year: 'numeric', // 2025
    hour: 'numeric',
    minute: '2-digit',
    hour12: true     // optional: AM/PM style
  });
}
