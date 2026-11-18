# Chatbot Platform

Embeddable AI chatbot for small businesses.

## Structure

- `api/` - Node + TypeScript + Fastify backend (deploys to Railway)
- `dashboard/` - Next.js dashboard (deploys to Vercel) - not built yet
- `widget/` - embeddable chat widget - not built yet

## Run the API locally

```bash
cd api
cp .env.example .env      # then put your OpenAI key in .env
pnpm install
pnpm dev
```

Open http://localhost:3000 and chat with the sample plumbing business.

Never commit `.env`. On Railway, set `OPENAI_API_KEY` under Variables.
