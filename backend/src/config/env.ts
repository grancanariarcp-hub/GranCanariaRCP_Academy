import 'dotenv/config';

/**
 * Centralised, validated access to environment variables.
 * We fail fast at boot if something critical is missing, so we never
 * discover a misconfiguration halfway through handling a request.
 */

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

const isProduction = process.env.NODE_ENV === 'production';

// Build a DATABASE_URL from discrete vars if a full URL was not provided.
function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const host = optional('PGHOST', 'localhost');
  const port = optional('PGPORT', '5432');
  const user = optional('PGUSER', 'rcp_admin');
  const password = optional('PGPASSWORD', 'rcp_password');
  const database = optional('PGDATABASE', 'grancanaria_rcp');
  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

export const env = {
  isProduction,
  nodeEnv: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '5000'), 10),
  corsOrigin: optional('CORS_ORIGIN', 'http://localhost:3000'),

  databaseUrl: resolveDatabaseUrl(),

  jwtSecret: optional('JWT_SECRET', 'dev-insecure-secret-change-me'),
  jwtExpiresIn: optional('JWT_EXPIRES_IN', '8h'),

  // 32-byte key for AES-256. In dev we allow a derived fallback so the app boots.
  encryptionKey: optional(
    'ENCRYPTION_KEY',
    '0'.repeat(64),
  ),

  superAdmin: {
    email: optional('SUPERADMIN_EMAIL', 'grancanariarcp@gmail.com'),
    password: optional('SUPERADMIN_PASSWORD', 'Admin123!RCP'),
    name: optional('SUPERADMIN_NAME', 'Federico Lubbe'),
  },
};

// In production we refuse to run with insecure defaults.
if (isProduction) {
  if (env.jwtSecret === 'dev-insecure-secret-change-me') {
    throw new Error('JWT_SECRET must be set in production');
  }
  if (env.encryptionKey === '0'.repeat(64)) {
    throw new Error('ENCRYPTION_KEY must be set in production');
  }
}
