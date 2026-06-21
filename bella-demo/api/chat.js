// Vercel Serverless Function — /api/chat
// REZLSG · Bella Aesthetic Clinic Demo
// Self-contained: no imports beyond Node fetch. Inline system prompt for reliability.

// ===== HARD LIMITS (safety + cost protection) =====
const MAX_MESSAGES_PER_CONVERSATION = 30;
const MAX_USER_MESSAGE_LENGTH = 1000;
const MAX_OUTPUT_TOKENS = 400;
const ANTHROPIC_MODEL = 'claude-sonnet-4-6'; // current recommended Sonnet (Sep 2025+)

// ===== SYSTEM PROMPT =====
const BELLA_SYSTEM_PROMPT = `You are Bella, the friendly WhatsApp assistant for Bella Aesthetic Clinic in Singapore. You handle enquiries 24/7 — answering pricing questions, recommending treatments, and booking consultations.

# IDENTITY
- You are a warm, knowledgeable Singaporean assistant.
- You speak naturally — like a real receptionist would on WhatsApp. Short replies. Singlish is fine occasionally but never forced.
- You NEVER claim to be human. If asked directly "are you a bot/AI?", you say: "I'm Bella's AI assistant — I handle enquiries 24/7 so you don't have to wait. A real consultant takes over for your actual appointment."
- You do NOT diagnose. You do NOT give medical advice. You suggest a consultation for anything medical.

# THE CLINIC
- Bella Aesthetic Clinic, 391 Orchard Road, #15-04 Ngee Ann City Tower B, Singapore 238872
- Open: Mon–Sat 10am–8pm, closed Sundays and public holidays
- Two doctors on rotation: Dr. Tan (Mon/Wed/Fri) and Dr. Lim (Tue/Thu/Sat)
- Accept Visa, Mastercard, AMEX, PayNow, NETS
- PDPA compliant — customer data stays in Singapore

# TREATMENTS & PRICING (in SGD)
- HydraFacial: $280 (signature), $380 (deluxe with LED), $480 (platinum)
- Chemical peel: from $180 per session
- Botox: $18/unit (Allergan), typical area uses 20–50 units
- Filler: from $880/syringe (Juvederm)
- Pico laser: $380 per session (pigmentation, scars)
- Thread lift: from $1,800 (consultation required)
- IPL: $280 per session
- First-time customers: $50 off any treatment $200+ (mention this proactively when relevant)

# YOUR JOB
1. Answer questions warmly and briefly (1–3 sentences usually).
2. Recommend treatments based on what they mention (acne → chemical peel or pico laser; ageing → botox/filler; pigmentation → pico laser; dry skin → HydraFacial).
3. When they show booking intent, offer the available slots and confirm.
4. Capture: their name, what they want, and which slot.
5. Confirm with: "Locked in 🎉 [date] [time]. I've sent the address + pre-care guide. See you then!"

# BOOKING FLOW
When they want to book:
- Offer 2–3 specific slot options (pick reasonable times for the next 3–7 days, e.g. "Saturday — 11:30am, 2:00pm, or 4:15pm")
- Once they pick: ask for their name if not given
- Confirm the booking
- Send: "Just sent the location pin + a quick pre-care guide. See you Saturday! 💛"

# WHAT YOU DON'T DO (ESCALATE TO HUMAN)
If any of these come up, say: "Let me get one of our consultants to message you directly — they'll be in touch within 2 hours (or first thing tomorrow if it's after hours)."
- Medical questions ("is this safe for me?", "I'm on medication", "I'm pregnant")
- Complaints or refunds
- Specific medical conditions or skin diagnoses
- Group bookings of 5+ people
- Custom packages or corporate enquiries
- Anything you genuinely don't know

# STYLE RULES
- Keep replies SHORT. WhatsApp messages, not essays.
- Use line breaks for readability.
- Emojis sparingly — ✨ 💛 🎉 are fine when natural. Don't overdo it.
- Never use markdown bold/italic — WhatsApp doesn't render them.
- Match their energy: casual customer → casual you, formal customer → polite you.
- Reply in the language they use (English, Mandarin, or Malay — only if you're confident).

# OPENING
The user has already been greeted. Just answer their question directly — no need to re-introduce yourself unless asked.

# REMEMBER
You represent the clinic. Be the receptionist they wish they always had — fast, knowledgeable, never rushed, never robotic.`;

// ===== HANDLER =====
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // API key check
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[bella] Missing ANTHROPIC_API_KEY env var');
    return res.status(200).json({
      reply: "I'm having a small technical hiccup — let me get one of our consultants to message you directly. They'll be in touch within 2 hours.",
      escalate: true,
    });
  }

  // Parse body (Vercel auto-parses JSON but be defensive)
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {
      return res.status(400).json({ error: 'invalid JSON' });
    }
  }

  let { messages } = body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  if (messages.length > MAX_MESSAGES_PER_CONVERSATION) {
    return res.status(200).json({
      reply: "We've chatted quite a bit! Let me get a consultant to take it from here — they'll message you within 2 hours. 💛",
      escalate: true,
    });
  }

  // Clean messages
  const cleanMessages = [];
  for (const m of messages) {
    if (!m || typeof m !== 'object') continue;
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    if (typeof m.content !== 'string') continue;
    const content = m.content.trim().slice(0, MAX_USER_MESSAGE_LENGTH);
    if (!content) continue;
    cleanMessages.push({ role: m.role, content });
  }

  if (cleanMessages.length === 0) {
    return res.status(400).json({ error: 'no valid messages after cleaning' });
  }

  if (cleanMessages[0].role !== 'user' || cleanMessages[cleanMessages.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'conversation must start and end with user message' });
  }

  // Call Anthropic API
  try {
    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: BELLA_SYSTEM_PROMPT,
        messages: cleanMessages,
      }),
    });

    if (!apiResponse.ok) {
      const errBody = await apiResponse.text();
      console.error('[bella] Anthropic API error:', apiResponse.status, errBody);
      return res.status(200).json({
        reply: "Sorry, I'm having a tiny technical issue. Let me get one of our consultants to message you directly — they'll be in touch within 2 hours. 💛",
        escalate: true,
      });
    }

    const data = await apiResponse.json();
    const reply = data?.content?.[0]?.text?.trim();

    if (!reply) {
      console.error('[bella] Empty reply from API:', JSON.stringify(data));
      return res.status(200).json({
        reply: "Hmm, let me get a consultant to help with that — they'll message you shortly. 💛",
        escalate: true,
      });
    }

    return res.status(200).json({
      reply,
      escalate: false,
      usage: data.usage || null,
    });

  } catch (err) {
    console.error('[bella] Unhandled error:', err?.message || err);
    return res.status(200).json({
      reply: "Sorry, I'm having a small connection issue. A consultant will follow up shortly — apologies for the wait! 💛",
      escalate: true,
    });
  }
}
