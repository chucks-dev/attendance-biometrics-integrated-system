require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  clientUrl: required('CLIENT_URL', 'http://localhost:3000'),

  databaseUrl: required('DATABASE_URL'),

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  webauthn: {
    rpName: process.env.WEBAUTHN_RP_NAME || 'Federal Polytechnic Nekede',
    rpID: process.env.WEBAUTHN_RP_ID || 'localhost',
    origin: process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000',
  },

  seedAdmin: {
    email: process.env.SEED_ADMIN_EMAIL || 'admin@fpn.edu.ng',
    password: process.env.SEED_ADMIN_PASSWORD || 'Admin@123456',
  },
};

module.exports = env;
