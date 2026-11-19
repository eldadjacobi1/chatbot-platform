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
npm install
npm run dev
```

Open http://localhost:3000 (redirects to /demo, a fake customer site with the chat widget).

Never commit `.env`. On Railway, set `OPENAI_API_KEY` under Variables.
