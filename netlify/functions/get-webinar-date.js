// Fetches the next webinar date from the Monteforte Law seminar schedule page
// and returns it as JSON so the landing page can update automatically.

const SCHEDULE_URL =
  'https://www.montefortelaw.com/ma-estate-planning-and-elder-law-resources/reports/estate-planning-seminar/';

const FALLBACK = {
  date: 'Tuesday, March 25, 2026',
  time: '6:00 PM ET',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

exports.handler = async function () {
  try {
    const response = await fetch(SCHEDULE_URL, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WebinarDateFetcher/1.0)',
      },
    });

    if (!response.ok) {
      return ok(FALLBACK);
    }

    const html = await response.text();

    // Match full weekday + date: "Tuesday, March 25, 2026"
    const dateMatch = html.match(
      /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})\b/i
    );

    // Match time: "6:00 PM ET", "12:00 PM ET", etc.
    const timeMatch = html.match(
      /\b(\d{1,2}:\d{2}\s*(?:AM|PM)\s*(?:ET|EST|EDT))\b/i
    );

    if (dateMatch && timeMatch) {
      return ok({
        date: dateMatch[0].trim(),
        time: timeMatch[1].trim(),
      });
    }

    return ok(FALLBACK);
  } catch (_err) {
    return ok(FALLBACK);
  }
};

function ok(body) {
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}
