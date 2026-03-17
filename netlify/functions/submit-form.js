// Proxies webinar registration form submissions to the Lawmatics CRM API.
// Running server-side avoids any CORS issues with the Lawmatics endpoint.

const LAWMATICS_ENDPOINT =
  'https://api.lawmatics.com/v1/forms/d4db9b44-6630-4227-92ed-a1346cca001d/submit';

exports.handler = async function (event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch (_) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  // Basic validation
  if (!data.email || !data.first_name) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields' }),
    };
  }

  try {
    const response = await fetch(LAWMATICS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        first_name: data.first_name,
        last_name:  data.last_name  || '',
        email:      data.email,
        phone:      data.phone      || '',
      }),
    });

    const responseText = await response.text();
    console.log('Lawmatics status:', response.status, responseText);

    // Treat 2xx as success
    if (response.ok) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true }),
      };
    }

    // Lawmatics returned an error — log it but still return 200 to user
    // so the thank-you message shows. Check Netlify function logs for details.
    console.error('Lawmatics error:', response.status, responseText);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, note: 'logged' }),
    };
  } catch (err) {
    console.error('Function error:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
