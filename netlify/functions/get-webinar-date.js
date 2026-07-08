// Fetches the next upcoming webinar date from the Monteforte Law seminar
// schedule page and returns it as JSON so the landing page can update
// automatically once one webinar is over and the next is scheduled.
//
// Runs on Netlify's servers (open internet), so it can reach montefortelaw.com
// at request time. Visit the endpoint directly with ?debug=1 to see every date
// candidate it parsed and which one it chose.

const SCHEDULE_URL =
  'https://www.montefortelaw.com/ma-estate-planning-and-elder-law-resources/reports/estate-planning-and-elder-law-seminars-ma/';

// Last-resort values if the page can't be fetched or parsed. Keep this updated
// to the real next webinar so the page never shows a past date if scraping breaks.
const FALLBACK = {
  date: 'Tuesday, March 25, 2026',
  time: '6:00 PM ET',
};

// Default time to use when a date is found but no time is near it on the page.
const DEFAULT_TIME = '6:00 PM ET';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=1800', // cache 30 min at the edge
};

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

// "Tuesday, March 25, 2026" — weekday optional, so "March 25, 2026" also matches.
const DATE_RE =
  /(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+)?(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/gi;

// "6:00 PM ET", "12:00 pm EST", "6 PM ET"
const TIME_RE = /(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*(?:E[SD]?T)?/gi;

const WEEKDAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday',
];

exports.handler = async function (event) {
  const debug = event && event.queryStringParameters && event.queryStringParameters.debug;

  try {
    const response = await fetch(SCHEDULE_URL, {
      redirect: 'follow',
      headers: {
        // Mimic a real browser so WordPress/bot-protection doesn't 403 us.
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      return ok(FALLBACK, debug, { error: `fetch status ${response.status}` });
    }

    const html = stripTags(await response.text());
    const result = pickNextWebinar(html);

    if (result.chosen) {
      return ok(
        { date: result.chosen.date, time: result.chosen.time },
        debug,
        { candidates: result.candidates, chosen: result.chosen }
      );
    }

    return ok(FALLBACK, debug, {
      error: 'no upcoming date found',
      candidates: result.candidates,
    });
  } catch (err) {
    return ok(FALLBACK, debug, { error: String((err && err.message) || err) });
  }
};

// Remove HTML tags and collapse whitespace so dates and their times end up
// close together in the text stream, making time-pairing reliable.
function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

// Parse every date on the page, keep only today-or-future ones, and choose the
// earliest. Pairs each date with the nearest time that follows it in the text.
function pickNextWebinar(text) {
  const now = new Date();
  // Start of "today" in ET-ish terms; comparing by day avoids timezone edge cases.
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  const candidates = [];
  let m;
  DATE_RE.lastIndex = 0;
  while ((m = DATE_RE.exec(text)) !== null) {
    const monthIdx = MONTHS.indexOf(m[1].toLowerCase());
    const day = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    if (monthIdx < 0 || day < 1 || day > 31) continue;

    const dayUTC = Date.UTC(year, monthIdx, day);
    const time = findNearbyTime(text, m.index + m[0].length);
    const label = formatLabel(year, monthIdx, day);

    candidates.push({
      date: label,
      time: time || DEFAULT_TIME,
      timeFound: Boolean(time),
      isFuture: dayUTC >= todayUTC,
      sortKey: dayUTC,
      raw: m[0],
    });
  }

  const future = candidates
    .filter((c) => c.isFuture)
    .sort((a, b) => a.sortKey - b.sortKey);

  return {
    candidates,
    chosen: future.length ? { date: future[0].date, time: future[0].time } : null,
  };
}

// Look for a time within a window of text right after a date. Webinar listings
// put the time immediately after the date ("...March 25, 2026 at 6:00 PM ET").
function findNearbyTime(text, fromIndex) {
  const window = text.slice(fromIndex, fromIndex + 60);
  TIME_RE.lastIndex = 0;
  const t = TIME_RE.exec(window);
  if (!t) return null;
  const hour = t[1];
  const min = t[2] || '00';
  const ampm = t[3].toUpperCase();
  return `${hour}:${min} ${ampm} ET`;
}

// Rebuild a clean, consistent label with the correct weekday for the date.
function formatLabel(year, monthIdx, day) {
  const d = new Date(Date.UTC(year, monthIdx, day, 12, 0, 0));
  const weekday = WEEKDAYS[d.getUTCDay()];
  const monthName = MONTHS[monthIdx].charAt(0).toUpperCase() + MONTHS[monthIdx].slice(1);
  return `${weekday}, ${monthName} ${day}, ${year}`;
}

function ok(body, debug, extra) {
  const payload = debug ? Object.assign({}, body, extra) : body;
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(payload),
  };
}
