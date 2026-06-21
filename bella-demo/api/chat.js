// Vercel Serverless Function — /api/chat
// Handles incoming chat messages, talks to Anthropic API, returns Bella's reply
// Designed for reliability: hard limits, graceful errors, no crashes on bad input

import { BELLA_SYSTEM_PROMPT } from './prompt.js';

// Hard safety limits to prevent runaway costs / abuse on a demo
const MAX_MESSAGES_PER_CONVERSATION = 30;   // ~30 turns then we close it
const MAX_USER_MESSAGE_LENGTH = 1000;       // single message char limit
const MAX_OUTPUT_TOKENS = 400;              // Bella replies are short by design
const ANTHROPIC_MODEL = 'claude-sonnet-4-5'; // current recommended Sonnet

export default async function handler(req, res) {
  // --- CORS for local testing & embed flexibility ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // --- Method guard ---
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // --- API key check (fail loud in logs, not to user) ---
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[bella] Missing ANTHROPIC_API_KEY env var');
    return res.status(500).json({
      reply: "I'm having a small technical hiccup — let me get one of our consultants to message you directly. They'll be in touch within 2 hours.",
      escalate: true,
    });
  }

  // --- Validate input ---
  let { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  // Cap conversation length (prevents abuse + runaway cost)
  if (messages.length > MAX_MESSAGES_PER_CONVERSATION) {
    return res.status(200).json({
      reply: "We've chatted quite a bit! Let me get a consultant to take it from here — they'll message you within 2 hours. 💛",
      escalate: true,
    });
  }

  // Sanitize each message: only role + content (string), enforce length
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

  // First and last message must be from user (Anthropic API requirement)
  if (cleanMessages[0].role !== 'user' || cleanMessages[cleanMessages.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'conversation must start and end with user message' });
  }

  // --- Call Anthropic API ---
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
        reply: "Hmm, let me get a consultant to help with that one — they'll message you shortly. 💛",
        escalate: true,
      });
    }

    return res.status(200).json({
      reply,
      escalate: false,
      // Useful for the website to show usage cost in the demo dashboard later
      usage: data.usage || null,
    });

  } catch (err) {
    // Network / timeout / unknown failure — never crash, always reply something graceful
    console.error('[bella] Unhandled error:', err);
    return res.status(200).json({
      reply: "Sorry, I'm having a small connection issue. A consultant will follow up with you shortly — apologies for the wait! 💛",
      escalate: true,
    });
  }
}
