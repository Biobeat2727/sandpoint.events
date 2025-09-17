/**
 * Time Validation Utility for Sandpoint Events
 *
 * This module ensures consistent and accurate time handling across the entire
 * event processing pipeline to prevent the recurring midnight/12am issues.
 */

/**
 * Validates and normalizes event time data
 * @param {Object} event - Event object to validate
 * @returns {Object} - Validated event with corrected time fields
 */
function validateEventTimes(event) {
  const validated = { ...event };
  const issues = [];

  // Ensure we have basic date information
  if (!validated.date && !validated.startDate) {
    issues.push('Missing both date and startDate fields');
    return { event: validated, issues, hasErrors: true };
  }

  // Normalize date fields
  if (!validated.startDate && validated.date) {
    validated.startDate = validated.date;
  }
  if (!validated.date && validated.startDate) {
    validated.date = validated.startDate;
  }

  // Validate startTime format
  if (validated.startTime) {
    if (!isValidTimeFormat(validated.startTime)) {
      issues.push(`Invalid startTime format: ${validated.startTime} (expected HH:mm)`);
      validated.startTime = null;
    }
  }

  // Validate endTime format
  if (validated.endTime) {
    if (!isValidTimeFormat(validated.endTime)) {
      issues.push(`Invalid endTime format: ${validated.endTime} (expected HH:mm)`);
      validated.endTime = null;
    }
  }

  // Check for date/time consistency issues
  const dateTimeIssues = checkDateTimeConsistency(validated);
  issues.push(...dateTimeIssues);

  // Check for midnight timestamp with specific start time (common error)
  const midnightIssues = checkMidnightInconsistency(validated);
  issues.push(...midnightIssues);

  return {
    event: validated,
    issues,
    hasErrors: issues.length > 0,
    hasWarnings: issues.some(issue => issue.includes('Warning'))
  };
}

/**
 * Validates time format (HH:mm)
 * @param {string} time - Time string to validate
 * @returns {boolean} - True if valid format
 */
function isValidTimeFormat(time) {
  if (typeof time !== 'string') return false;
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
}

/**
 * Checks for date/time consistency issues
 * @param {Object} event - Event to check
 * @returns {Array} - Array of issue descriptions
 */
function checkDateTimeConsistency(event) {
  const issues = [];

  // Check if date and startDate are inconsistent
  if (event.date && event.startDate && event.date !== event.startDate) {
    // Allow some tolerance for different date formats
    const date1 = new Date(event.date);
    const date2 = new Date(event.startDate);

    if (Math.abs(date1.getTime() - date2.getTime()) > 24 * 60 * 60 * 1000) {
      issues.push(`Warning: date (${event.date}) and startDate (${event.startDate}) differ by more than 24 hours`);
    }
  }

  // Check if endDate is before startDate
  if (event.endDate && event.startDate) {
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);

    if (endDate < startDate) {
      issues.push(`Error: endDate (${event.endDate}) is before startDate (${event.startDate})`);
    }
  }

  // Check if endTime is before startTime (same day events)
  if (event.startTime && event.endTime && !event.endDate) {
    const [startHour, startMin] = event.startTime.split(':').map(Number);
    const [endHour, endMin] = event.endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (endMinutes <= startMinutes) {
      issues.push(`Warning: endTime (${event.endTime}) is before or equal to startTime (${event.startTime}) - this may be a multi-day event`);
    }
  }

  return issues;
}

/**
 * Checks for midnight timestamp with specific start time (common parsing error)
 * @param {Object} event - Event to check
 * @returns {Array} - Array of issue descriptions
 */
function checkMidnightInconsistency(event) {
  const issues = [];

  if (event.date && event.startTime) {
    const date = new Date(event.date);

    // Check if the date shows midnight (00:00) but we have a specific startTime
    if (date.getUTCHours() === 7 && date.getUTCMinutes() === 0) {
      // This is likely 2025-XX-XXTXX:00:00.000Z which shows as midnight in local time
      // but has a startTime indicating it's not actually a midnight event
      if (event.startTime !== '00:00' && event.startTime !== '07:00') {
        issues.push(`Warning: Date shows base time (${event.date}) but startTime is ${event.startTime} - check if dates need to be reconstructed`);
      }
    }
  }

  return issues;
}

/**
 * Validates a batch of events and provides summary report
 * @param {Array} events - Array of events to validate
 * @returns {Object} - Validation report
 */
function validateEventBatch(events) {
  const results = events.map(event => validateEventTimes(event));

  const summary = {
    totalEvents: events.length,
    eventsWithErrors: results.filter(r => r.hasErrors).length,
    eventsWithWarnings: results.filter(r => r.hasWarnings).length,
    cleanEvents: results.filter(r => !r.hasErrors && !r.hasWarnings).length,
    allIssues: results.flatMap(r => r.issues),
    validatedEvents: results.map(r => r.event)
  };

  return {
    summary,
    results,
    isValid: summary.eventsWithErrors === 0
  };
}

/**
 * Logs validation report in a readable format
 * @param {Object} report - Validation report from validateEventBatch
 */
function logValidationReport(report) {
  const { summary } = report;

  console.log('\n🕐 Time Validation Report');
  console.log('========================');
  console.log(`📊 Total events: ${summary.totalEvents}`);
  console.log(`✅ Clean events: ${summary.cleanEvents}`);
  console.log(`⚠️  Events with warnings: ${summary.eventsWithWarnings}`);
  console.log(`❌ Events with errors: ${summary.eventsWithErrors}`);

  if (summary.allIssues.length > 0) {
    console.log('\n📋 Issues Found:');
    summary.allIssues.forEach((issue, index) => {
      const prefix = issue.includes('Error:') ? '❌' : '⚠️ ';
      console.log(`   ${prefix} ${issue}`);
    });
  }

  if (summary.eventsWithErrors === 0) {
    console.log('\n🎉 All events passed time validation!');
  } else {
    console.log('\n🚨 Some events have time validation errors that need fixing');
  }
}

module.exports = {
  validateEventTimes,
  validateEventBatch,
  logValidationReport,
  isValidTimeFormat,
  checkDateTimeConsistency,
  checkMidnightInconsistency
};