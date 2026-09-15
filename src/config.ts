interface AppConfig {
  port: number;
  databaseUrl: string;
  nodeEnv: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadConfig(): AppConfig {
  const portValue = required('APP_PORT');
  const port = Number(portValue);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`APP_PORT must be a positive integer, got: ${portValue}`);
  }

  return {
    port,
    databaseUrl: required('DATABASE_URL'),
    nodeEnv: process.env.NODE_ENV ?? 'development',
  };
}
