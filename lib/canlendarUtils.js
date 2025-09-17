export function getGoogleCalendarUrl(event) {
    // Use new date fields with fallback to legacy date field
    const startDate = event.startDate || event.date;
    const endDate = event.endDate;
    
    if (!startDate) return '#';
    
    let startDateTime = new Date(startDate);
    let endDateTime;
    
    if (endDate) {
        endDateTime = new Date(endDate);
    } else {
        // Default to 2 hour event if no end date specified
        endDateTime = new Date(startDateTime.getTime() + 2 * 60 * 60 * 1000);
    }
    
    const start = startDateTime.toISOString().replace(/[-:]|\.\d{3}/g,'');
    const end = endDateTime.toISOString().replace(/[-:]|\.\d{3}/g, '');

    const title = encodeURIComponent(event.title);
    const details = encodeURIComponent(event.description || '');
    
    // Enhanced location handling
    let location = '';
    if (event.venue?.name) {
        location = event.venue.name;
        if (event.venue.address) {
            location += ', ' + event.venue.address;
        }
    } else if (event.locationNote) {
        location = event.locationNote;
    }
    const encodedLocation = encodeURIComponent(location);

    return `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${encodedLocation}`;
}
