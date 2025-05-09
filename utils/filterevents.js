// utils/filterevents.js

export const parseEventDate = (dateString) => {
    const months = [
      "January", "February", "March", "April", "May", "June", "July", "August", 
      "September", "October", "November", "December"
    ];
  
    const regex = /([A-Za-z]+) (\d{1,2})(st|nd|rd|th), (\d{4}) • (\d{1,2}):(\d{2}) (AM|PM)/;
    const match = dateString.match(regex);
  
    if (!match) return null;
  
    const [_, monthName, day, , year, hour, minute, period] = match;
    const month = months.indexOf(monthName);
    let hours = parseInt(hour);
    
    if (period === "PM" && hours < 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
  
    return new Date(year, month, day, hours, minute);
  };
  
  // Filter and sort events globally
  export const getUpcomingEvents = (events) => {
    const today = new Date();
  
    // Filter out past events
    const upcomingEvents = events.filter(event => parseEventDate(event.date) > today);
  
    // Sort events by date and time
    upcomingEvents.sort((a, b) => parseEventDate(a.date) - parseEventDate(b.date));
  
    return upcomingEvents;
  };
  