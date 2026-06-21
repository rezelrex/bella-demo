# Bella Demo — REZLSG WhatsApp AI Agent

A live demo of a WhatsApp AI agent for aesthetic clinics. Built by REZLSG to showcase what we build for clients.

This is a **fictional clinic** ("Bella Aesthetic Clinic") used for sales demos. The same architecture deploys to real WhatsApp Business API for paying clients.

---

## What's in this folder

```
bella-demo/
├── api/
│   ├── chat.js          # Vercel serverless function (talks to Anthropic API)
│   └── prompt.js        # The system prompt (Bella's personality + business logic)
├── index.html           # The WhatsApp-styled chat widget (single file)
├── package.json
├── vercel.json
└── README.md
```

That's it. No database, no auth, no build step. ~600 lines total.

---

## Deploy in 10 minutes

### Step 1 — Get an Anthropic API key
1. Go to https://console.anthropic.com
2. Sign up, add S$5 credit (covers ~500 demo conversations)
3. **Settings → API Keys → Create Key** — copy it

### Step 2 — Deploy to Vercel
1. Push this folder to a new GitHub repo (e.g. `bella-demo`)
2. Go to https://vercel.com → **New Project** → Import the repo
3. **Environment Variables** section:
   - Name: `ANTHROPIC_API_KEY`
   - Value: paste your key from step 1
4. Click **Deploy**
5. Done. You'll get a URL like `bella-demo.vercel.app`

### Step 3 — Test it
Open the URL in your browser. Try:
- "what's the price of hydrafacial?"
- "i have acne, what do you recommend?"
- "can i book for saturday afternoon?"
- "are you a bot?"
- "i'm on accutane, is it safe?"  ← should escalate to human

### Step 4 — Use a custom subdomain (optional but nice)
In Vercel: **Settings → Domains** → add `demo.rezlsg.agency`. Update DNS at your domain registrar to point a CNAME there.

---

## Cost expectations

- **Vercel**: free tier covers everything for demo traffic (100k requests/month)
- **Anthropic API (Claude Sonnet 4.5)**: $3 per million input tokens, $15 per million output
- **Per conversation** (10 turns): ~$0.01 SGD
- **Per 500 demo conversations**: ~$5–7 SGD

For a paying client at S$2,800–4,500 setup + S$300–500/mo, hosting + API costs run **S$30–80/month** at typical small-business volumes (200–500 customer messages/day). 80%+ gross margin.

---

## Customizing for a real client

When you sell this to your first real client, here's what changes:

1. **`api/prompt.js`** — replace Bella's clinic info with the client's. New treatments, pricing, doctors, opening hours, escalation rules. This is 90% of the engagement value.

2. **`api/chat.js`** — swap the frontend's `fetch` for WhatsApp Business API webhooks. Add a Postgres/Supabase DB to persist conversations (since real customers come back over days/weeks, not in one tab session).

3. **Booking** — wire up Cal.com or Google Calendar API so bookings actually appear in their calendar. (For the demo, Bella just *says* she booked — no real calendar write.)

4. **Compliance** — add a one-time PDPA consent message at the start of conversations with new customers.

---

## Reliability features built in

This isn't a toy — these guardrails prevent the demo from crashing or running up bills:

- **Hard message limit per conversation** (30 turns) — prevents abuse loops
- **Hard char limit per message** (1000 chars) — prevents prompt-stuffing
- **Hard output token cap** (400 tokens) — keeps Bella concise + cost predictable
- **Graceful error fallbacks** — API down? User sees a polite "consultant will follow up" message, not a crash
- **API key only on server** — never exposed to browser
- **No PII logging** — we log error states, not user messages
- **Session-scoped state** — closes browser, chat resets (good for live demos)

---

## Troubleshooting

**"Sorry, I'm having a tiny technical issue..."** in every reply
- Most likely: API key not set in Vercel env vars. Re-check **Settings → Environment Variables → `ANTHROPIC_API_KEY`** and redeploy.

**Widget loads but nothing happens when you send**
- Open browser DevTools → Network tab → send a message → check the `/api/chat` request. If it 404s, your Vercel routing isn't matching. Confirm `api/chat.js` is in the `/api` folder.

**Conversation persists across visits when you don't want it to**
- Use the "Reset" button at the bottom. Or test in an Incognito/Private window.

---

## Built by

REZLSG (UEN 53508470J) · Singapore  
https://rezlsg.agency · rezlai.sg@gmail.com · WhatsApp +65 9786 9061
