const { google } = require('googleapis');
const path = require('path');
const CREDENTIALS_PATH = path.join(__dirname, 'credentials/google-service-account.json');

async function test() {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  });

  const calendar = google.calendar({ version: 'v3', auth });

  try {
    const res = await calendar.events.list({
      calendarId: '71c7c7ad0f4e76ce997310398bdb6c820090c9945a6ea3991635eebcf4fe7230@group.calendar.google.com',
      timeMin: new Date().toISOString(),
      maxResults: 1,
    });
    console.log('SUCCESS:', res.data.items ? res.data.items.length : 0, 'items');
  } catch (err) {
    console.error('ERROR:', err.message);
  }
}
test();
