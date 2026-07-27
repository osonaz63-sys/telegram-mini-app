# TextIQ — Twin Display Mini App

Sellable Telegram Mini App: **Display Port A (input)** feeds **Display Port B (scored output)** through a probability engine.

## Twin Display Port

```
PORT A (input)  ──IQ──  PORT B (output)
 message/sender          probability ring
 region/filters          OTP digits + breakdown
```

## Features

- Twin-pane “display port” UI (stacks on mobile, side-by-side on wide)
- Probability score 0–99% with animated ring
- 6-digit OTP extraction + copy / send-to-bot
- Text message **name filtering** (local allowlist)
- Region tags: `+1` `+44` `+91` `+57`
- Local history (device only)
- Sell Kit tab with pricing tiers + pitch
- Telegram WebApp theme + MainButton + haptics

## Hard limits (by design)

This is a **paste / analyze** product. It does **not**:

- Read SIM / SMS inbox / device packets
- Place phone calls or hit carrier APIs
- Bypass Telegram or OS permissions

That’s what keeps it shippable and sellable.

## Files

| File | Role |
|------|------|
| `index.html` | Twin Display shell |
| `styles.css` | Product UI |
| `app.js` | Scoring engine + filters + history |
| `bot.example.py` | Bot host for Mini App + `sendData` |

## Deploy

1. Host folder on **HTTPS** (Cloudflare Pages / Netlify / Vercel)
2. BotFather → `/newapp` → set URL
3. Optional bot:

```bash
pip install python-telegram-bot==21.6
export BOT_TOKEN="…"
export MINI_APP_URL="https://your-domain.com/index.html"
python bot.example.py
```

## Scoring (transparent)

| Signal | Points |
|--------|--------|
| OTP pattern | up to +42 |
| Name filter match | +22 |
| Auth keywords | +18 |
| Expiry language | +10 |
| Region tag | up to +8 |
| Length sanity | +5 / -4 |

Capped at 99. Breakdown is shown live on Port B.

## Pitch

> TextIQ turns messy messages into ranked, sellable intelligence — twin-port clarity with a probability score you can trust.
