// utils/filterevents.js

export const getUpcomingEvents = (events) => {
  const now = new Date();

  return events
    .filter((event) => {
      if (!event.date) return false;
      const parsedDate = new Date(event.date);
      return !isNaN(parsedDate) && parsedDate > now;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));
};
