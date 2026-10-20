// Generates tracking code for tracking service requests
const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateTrackingCode(db, date = new Date()) {
  for (let attempt = 0; attempt < 10; attempt++) {
    let suffix = '';
    for (const byte of crypto.randomBytes(6)) suffix += ALPHABET[byte % ALPHABET.length];

    const code = `MCG-${date.getFullYear()}-${suffix}`;
    if (!db.prepare('SELECT 1 FROM requests WHERE tracking_code = ?').get(code)) return code;
  }
  throw new Error('Could not generate a unique tracking code.');
}

module.exports = { generateTrackingCode };