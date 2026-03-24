# VPS Canon — Terminology, Access & Setup Rules

## Official VPS Terminology

When referring to VPS access software, kazpaGPT must always use:
- **Microsoft Remote Desktop** — the correct, official name
- Never say "Microsoft Remote Desktop" alone without the "Microsoft" prefix
- Never say "RDP" as a standalone term to users (it is a protocol, not a product name)
- Never say "remote desktop application" — always "Microsoft Remote Desktop"

The Microsoft Microsoft Remote Desktop is available on:
- Windows (built-in as "Remote Desktop Connection" or downloadable from the Microsoft Store)
- macOS (available on the Mac App Store — search "Microsoft Remote Desktop")
- iOS/iPhone (available on the App Store)
- Android (available on the Google Play Store)

---

## Why a VPS Is Used

A VPS (Virtual Private Server) keeps MetaTrader 5 running 24/7 without needing a personal computer on.

Key benefits:
- MT5 stays open continuously
- Software runs uninterrupted
- Accessible from any device via Microsoft Remote Desktop
- Not affected by local computer shutdowns, sleep mode, or internet drops

A VPS is strongly recommended for all kazpa users, especially those running VistaONE continuously.

---

## VPS Requirements

For kazpa software to run properly, the VPS must have:
- Windows Server OS (Windows-based VPS only)
- At least 2 CPU cores
- At least 3 GB RAM
- Stable internet connection
- MetaTrader 5 installed (not MT5)

---

## How to Access Your VPS — Correct Steps

### Step 1 — Get Your VPS Credentials
After signing up with a VPS provider, you will receive an email containing:
- IP address (or hostname)
- Username
- Password

Keep these secure. Do not share them.

### Step 2 — Download Microsoft Remote Desktop
- **Windows**: Search "Remote Desktop Connection" in the Start menu, or download "Microsoft Remote Desktop" from the Microsoft Store
- **Mac**: Download "Microsoft Remote Desktop" from the Mac App Store
- **iPhone/iPad**: Download "Microsoft Remote Desktop" from the App Store
- **Android**: Download "Microsoft Remote Desktop" from the Google Play Store

### Step 3 — Connect to Your VPS
1. Open Microsoft Remote Desktop
2. Click the "+" or "Add PC" button
3. Enter the IP address from your VPS provider email
4. Add your username and password
5. Click Connect
6. If prompted about a certificate, click Continue to proceed

### Step 4 — You Are Now Inside Your VPS
Once connected, you are operating inside the remote Windows environment.
From here you can install MT5, set up kazpa software, and manage everything remotely.

---

## Critical VPS Mistakes to Avoid

- **Do NOT close the VPS window by clicking X** — this disconnects you but keeps the VPS running correctly
- **Do NOT log out of Windows on the VPS** — logging out shuts down active sessions and stops MT5
- **Do NOT restart the VPS during live trading** — always pause AutoTrading first
- Always disconnect (not log out) when finished

The correct way to leave a VPS session:
- Simply close the Microsoft Remote Desktop window
- The VPS continues running in the background

---

## VPS Providers (Community Examples — Not Recommendations)

kazpa does not endorse or recommend specific VPS providers. The following have been mentioned by community members for their own research:
- ForexVPS (forexvps.net)
- CNS (cnsvps.com)
- Contabo
- Vultr
- DigitalOcean

Always verify pricing, uptime guarantees, Windows support, and your region before purchasing.
kazpa has no affiliations with VPS providers.

---

## After Reconnecting to Your VPS

After any reconnect, restart, or VPS maintenance:
1. Open MT5
2. Confirm the correct account is logged in
3. Verify AutoTrading is ON (green)
4. Confirm charts and software are still attached correctly
5. Check Experts and Journal tabs for any errors

AutoTrading does NOT automatically re-enable after a restart.
This must be manually verified every time.
