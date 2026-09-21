export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  OPENAI_API_KEY?: string;
  APP_PASSWORD?: string;
  SESSION_SECRET?: string;
}

export function isConfigured(env: Env) {
  return {
    database: !!env.DB,
    openai: !!env.OPENAI_API_KEY,
    password: !!env.APP_PASSWORD,
    sessionSecret: !!env.SESSION_SECRET
  };
}
