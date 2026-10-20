// Enforces valid data types and formats
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_RE = /^\p{L}[\p{L}\s'.-]{1,79}$/u;
const ID_RE = /^\d{7,8}$/;

// Kenyan mobile: 07xx / 01xx / +2547xx / +2541xx -> +254XXXXXXXXX, or null.
function normalisePhone(input) {
  const digits = String(input || '').replace(/[\s\-()]/g, '');
  const m = digits.match(/^(?:\+254|254|0)([17]\d{8})$/);
  return m ? `+254${m[1]}` : null;
}

// Returns list of missing requirements for valid password strength
function passwordProblems(pw) {
  const problems = [];
  if (typeof pw !== 'string' || pw.length < 8) problems.push('at least 8 characters');
  if (typeof pw === 'string' && pw.length > 72) problems.push('no more than 72 characters');
  if (!/[a-z]/.test(pw || '')) problems.push('a lowercase letter');
  if (!/[A-Z]/.test(pw || '')) problems.push('an uppercase letter');
  if (!/\d/.test(pw || '')) problems.push('a number');
  return problems;
}

function validateRegistration(body = {}) {
  const errors = {};

  const name = String(body.name || '').trim().replace(/\s+/g, ' ');
  if (!NAME_RE.test(name)) errors.name = 'Enter your full name (letters only).';

  const email = String(body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';

  const phone = normalisePhone(body.phone);
  if (!phone) errors.phone = 'Enter a valid Kenyan number, e.g. 0712 345 678.';

  const idNumber = String(body.idNumber || '').trim();
  if (!ID_RE.test(idNumber)) errors.idNumber = 'ID number must be 7 or 8 digits.';

  const password = String(body.password || '');
  const problems = passwordProblems(password);
  if (problems.length) errors.password = `Password needs ${problems.join(', ')}.`;

  return { errors, values: { name, email, phone, idNumber, password } };
}

module.exports = { normalisePhone, validateRegistration, passwordProblems, EMAIL_RE };