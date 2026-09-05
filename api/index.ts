import { createApp } from '../src/server/app.js';

// Vercel and local development share the same Supabase-only server boundary.
export default createApp();
