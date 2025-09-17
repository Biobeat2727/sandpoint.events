// utils/formatDate.js

// Original format function for backward compatibility
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

// Format date range (e.g., "August 10–12" or "August 10")
export function formatDateRange(startDate, endDate = null) {
  if (!startDate) return '';
  
  const start = new Date(startDate);
  
  if (!endDate) {
    return start.toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }
  
  const end = new Date(endDate);
  
  // Same month and year - show "August 10–12"
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    const monthYear = start.toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric'
    });
    return `${monthYear.replace(`, ${start.getFullYear()}`, '')} ${start.getDate()}–${end.getDate()}`;
  }
  
  // Different months - show "August 10 – September 12"
  const startFormatted = start.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric'
  });
  const endFormatted = end.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
  
  return `${startFormatted} – ${endFormatted}`;
}

// Format time from 24-hour to 12-hour format
export function formatTime(timeString) {
  if (!timeString) return '';
  
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours);
  const minute = parseInt(minutes);
  
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  
  if (minute === 0) {
    return `${displayHour}:00 ${ampm}`;
  }
  
  return `${displayHour}:${minute.toString().padStart(2, '0')} ${ampm}`;
}

// Format time range (e.g., "2:00 PM – 4:00 PM")
export function formatTimeRange(startTime, endTime = null) {
  if (!startTime) return '';
  
  const formattedStart = formatTime(startTime);
  
  if (!endTime) {
    return formattedStart;
  }
  
  const formattedEnd = formatTime(endTime);
  return `${formattedStart} – ${formattedEnd}`;
}
