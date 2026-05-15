# Nexus Status Grid

A production-grade, real-time vendor uptime monitoring dashboard and AI assistant.

## Features
- **Real-Time Data**: Automatically aggregated status data from 12+ cloud vendors.
- **AI Chatbot**: Intelligent agent powered by Gemini 2.5 Pro that can answer questions, analyze dependencies, and set up alerts.
- **Robust Infrastructure**: Vercel Postgres data layer with cron-based ingestion.
- **Reliable**: Built with React Error Boundaries, Zod validation, and Upstash Redis rate limiting.
- **Tested**: Comprehensive test suite with Vitest.

## Prerequisites
- Node.js 20+
- A Vercel Postgres database (or any PostgreSQL instance)
- Upstash Redis database
- Google Gemini API key

## Setup

1. **Clone the repository**
2. **Install dependencies**: `npm install`
3. **Environment Variables**: Copy `.env.example` to `.env.local` and fill in the values:
   - `POSTGRES_URL`
   - `GOOGLE_GENERATIVE_AI_API_KEY`
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `CRON_SECRET`
4. **Database Setup**: Execute the SQL commands in `lib/db/schema.sql` on your PostgreSQL database. Run the seed script to populate vendors: `npx tsx lib/db/seed.ts`
5. **Run Locally**: `npm run dev`

## Local Testing
- **Unit Tests**: Run `npm test` or `npm run test:ci` for coverage.
- **Cron Job**: Trigger the cron job locally by sending a GET request to `/api/cron` with the `Authorization: Bearer <CRON_SECRET>` header.

## Deployment
Deploy easily to Vercel. Ensure all environment variables from `.env.example` are set in your Vercel project settings. The `vercel.json` file automatically configures the cron job to run every minute.
