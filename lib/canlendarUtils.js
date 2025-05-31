export function getGoogleCalendarUrl(event) {
    const start = new Date(event.date).toISOString().replace(/[-:]|\.\d{3}/g,'');
    const end = new Date(new Date(event.date).getTime() + 2 * 60 * 60 * 1000)
    .toISOString()
    .replace(/[-:]|\.\d{3}/g, '');

    const title = encodeURIComponent(event.title);
    const details = encodeURIComponent(event.description || '');
    const location = encodeURIComponent(event.venue?.name || '');

    return `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`;
}
