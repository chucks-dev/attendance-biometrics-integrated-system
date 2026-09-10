const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

async function comparePassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}

// Enforced by Zod at the API boundary too — kept here for reuse
// (e.g. seed scripts) and defense in depth.
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

module.exports = { hashPassword, comparePassword, PASSWORD_REGEX };
