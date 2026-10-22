// Centralized server environment configuration.
// Validation runs on first access (not at module load) so `next build` can
// collect page data without the URL present. At runtime the first API request
// will throw immediately with a clear message if the variable is missing.
export const env = {
  get API_BASE_URL(): string {
    const val = process.env.API_BASE_URL;
    if (!val) {
      throw new Error('[env] Missing required environment variable: API_BASE_URL');
    }
    try {
      new URL(val);
    } catch {
      throw new Error(`[env] Invalid environment configuration: API_BASE_URL must be a valid URL (got "${val}")`);
    }
    return val.replace(/\/+$/, '');
  },
};
