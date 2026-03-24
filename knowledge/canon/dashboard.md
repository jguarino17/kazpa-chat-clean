# kazpa Member Dashboard — Canon

## Overview

The kazpa member dashboard is located at **kazpa.io/dashboard**.

It is the central hub for all member activity, accessible after logging in via Memberstack.

---

## Dashboard Sections (In Order)

### 1. Hero & Welcome
- Displays the member's first name pulled from their Memberstack profile
- Shows a dynamic subtitle based on account status:
  - "You have X active account(s). Everything is live." (if accounts are active)
  - "Your activation form has been received." (if form submitted, pending)
  - "Follow the steps below to activate your account." (if no account yet)

### 2. Stat Strip
Shows four key stats pulled from the member's Memberstack profile:
- **Plan** — their current kazpa plan (e.g., VistaSUITE)
- **Active Accounts** — number of active trading accounts
- **Inactive** — number of inactive/expired accounts
- **Member Since** — the month and year they joined

### 3. Quick Actions Grid
Eight shortcut cards linking to key dashboard pages:
- Setup Wizard — full setup guide
- Documentation — all setup docs
- Downloads — MT5 files and set files
- kazpaGPT — the AI assistant (chat.kazpa.io)
- Risk Tool — lot size calculator (/vistax-risk-tool)
- VistaX Forecast — weekly outlook (/vistax-forecast)
- Telegram — private member channel
- Support — help and contact (/support)

### 4. Account Activation Tracker (shown when no accounts yet)
A step-by-step progress tracker showing the member's onboarding progress:
- Step 1: Payment Confirmed ✓
- Step 2: Member Account Created ✓
- Step 3: Set Up VPS + Broker + MT5 (action required)
- Step 4: Submit License Activation Form (action required — links to JotForm)
- Step 5: kazpa Generates License Key (pending)
- Step 6: Account Active — You're Live (pending)

### 5. Waiting State (shown after form submitted, before license issued)
Shown when the activation form has been submitted but the license key hasn't been generated yet.
- Confirms form was received
- States typical processing time is under 24 hours
- Directs members to Telegram for updates

### 6. Trading Accounts (shown when accounts are active)
Displays member's active and inactive trading accounts pulled from Memberstack custom fields.
- Shows account number, software name, license key, and renewal date
- Active accounts glow green, inactive accounts glow red
- Inactive accounts show a "Renew License" button

### 7. Account Snapshot (myfxbook integration)
Live trading performance pulled from the member's myfxbook account.
- Members connect their myfxbook credentials once — saved locally for auto-login
- Shows: Balance, Total Gain %, Monthly Return, Max Drawdown, Win Rate
- Refresh button and "Full Stats →" link to /live-account
- If not connected: shows a nudge to connect via /live-account

### 8. XAUUSD Gold Widget
Live gold price intelligence card powered by the Twelve Data API.
- Live spot price with 24h change and Bullish/Bearish/Neutral sentiment
- OHLC data (Open, High, Low, Spread)
- Day range bar showing where price sits between today's low and high
- Animated sparkline chart with 1D / 1W / 1M toggle
- Key support and resistance levels (R2, R1, current, S1, S2)
- Latest gold news headlines
- Auto-refreshes every 5 minutes

### 9. Forex Session Map
Live forex market session tracker showing which sessions are currently open.
- Four city cards: Sydney, Tokyo, London, New York
- Each shows: open/closed status, countdown ("closes in 2h 34m" or "opens in 5h 12m"), local time
- 24-hour timeline bar with colored bars for each session
- White needle moves in real time showing current UTC position
- Overlap indicator: shows "🔥 London + New York overlap — high liquidity" during overlaps
- Updates every second using UTC math — no external API needed

---

## Navigation Drawer (Hamburger Menu)

Available on all dashboard pages. Links include:
- Dashboard (Home)
- Setup Wizard
- Documentation
- Downloads (MT5 files)
- kazpaGPT
- Calendar (trade log)
- Live Account (myfxbook stats)
- The VistaSUITE (info)
- VistaONE Guide
- VistaX Guide
- VistaX Forecast
- VistaX Risk Tool
- Compound Growth
- Software Changelog
- Support
- Profile
- Sign Out

---

## Member Dashboard URL Structure

| Page | URL |
|------|-----|
| Dashboard | /dashboard |
| Setup Wizard | /setup-wizard |
| Documentation | /documentation |
| Downloads | /downloads |
| kazpaGPT | https://chat.kazpa.io |
| Calendar | /calendar |
| Live Account | /live-account |
| The VistaSUITE | /the-vistasuite |
| VistaONE Guide | /vistaone-rulebook |
| VistaX Guide | /vistax-guide |
| VistaX Forecast | /vistax-forecast |
| Risk Tool | /vistax-risk-tool |
| Compound Growth | /compound-growth |
| Changelog | /changelog |
| Support | /support |
| Profile | /profile |

---

## Common Dashboard Questions kazpaGPT Should Answer

**"Where do I find my license key?"**
On the dashboard at /dashboard under "Trading Accounts" — the license key is shown for each account.

**"Why does my dashboard show the activation tracker?"**
This means no active accounts have been added yet. The member needs to complete setup (VPS + broker + MT5) and submit the license activation form.

**"Why does the account snapshot say 'Connect myfxbook'?"**
The myfxbook integration hasn't been set up yet. Direct them to /live-account to connect their myfxbook credentials.

**"What is the gold widget?"**
A live XAUUSD price card on the dashboard showing spot price, chart, key levels, and news. Powered by the Twelve Data API.

**"What is the forex session map?"**
A live widget showing which forex trading sessions (Sydney, Tokyo, London, New York) are currently open, with a 24-hour timeline and countdown timers.

**"My dashboard shows the wrong name / is loading slowly"**
The dashboard pulls data from Memberstack. Occasionally it takes a few seconds to load member data. A page refresh usually resolves this.
