# VPS Overview — What It Is, Why It's Used, and How to Access It

This page explains what a VPS is, why it is used with kazpa software, and how to connect to it correctly.

A VPS is strongly recommended for most kazpa users.

---

## What a VPS Is

A VPS (Virtual Private Server) is a remote Windows computer that:
- Runs continuously, 24 hours a day, 7 days a week
- Stays online regardless of what your personal device does
- Can be accessed from anywhere using Microsoft App
- Is independent of your personal computer, phone, or internet connection

Think of a VPS as a dedicated Windows machine that lives online and never shuts off.

---

## Why a VPS Is Recommended for kazpa

kazpa software runs inside MetaTrader 5 (MT5).

Using a VPS ensures:
- MT5 stays open continuously without interruption
- Software executes without being affected by your local computer shutting down, sleeping, or losing internet
- You can monitor and manage everything remotely from any device

A VPS improves reliability and consistency. It does not improve strategy performance or remove trading risk.

---

## How to Access Your VPS — Microsoft App

To connect to your VPS, you use Microsoft App.

This is the official application used to access Windows-based VPS servers remotely.

Download Microsoft App:
- Windows: Search "Remote Desktop Connection" in the Start menu, or download "Microsoft App" from the Microsoft Store
- Mac: Download "Microsoft App" from the Mac App Store
- iPhone / iPad: Download "Microsoft App" from the App Store
- Android: Download "Microsoft App" from the Google Play Store

Connect to your VPS:
1. Open Microsoft App
2. Click the "+" or "Add PC" button
3. Enter the IP address from your VPS provider email
4. Enter your VPS username and password
5. Click Connect
6. If prompted about a certificate, click Continue

You are now inside your VPS. Install MT5 here and set up kazpa software from this environment.

---

## Critical: How to Leave a VPS Session Correctly

Do NOT log out of Windows on the VPS — this shuts down your active session and stops MT5.
Do NOT click "Sign Out" inside the VPS Windows environment.

Correct way to disconnect:
- Simply close the Microsoft App window
- The VPS continues running in the background with MT5 active

Logging out vs disconnecting is the most common VPS mistake new users make.

---

## VPS Requirements

For kazpa software to run correctly, the VPS must have:
- Windows Server operating system
- At least 2 CPU cores
- At least 3 GB RAM
- MetaTrader 5 installed (MT5 only — MT5 is not supported)
- Stable internet connection

---

## After Any VPS Restart or Reconnect

After connecting to your VPS following any restart or maintenance:
1. Open MetaTrader 5
2. Confirm the correct trading account is logged in
3. Verify AutoTrading is ON (green button)
4. Confirm charts are open and software is still attached
5. Check the Experts and Journal tabs for any error messages

AutoTrading does not automatically re-enable after a restart. This must be manually checked every time.

---

## What a VPS Does NOT Do

A VPS does not:
- Remove trading risk
- Improve strategy performance
- Guarantee better results
- Eliminate drawdown
- Replace the need to monitor execution

A VPS is an infrastructure tool, not a trading advantage.

---

## VPS Providers (Community Examples — Not Recommendations)

kazpa does not endorse specific VPS providers. The following have been mentioned by community members as examples for their own research:
- ForexVPS (forexvps.net)
- CNS (cnsvps.com)
- Contabo
- Vultr

Always verify Windows support, uptime guarantees, pricing, and your region before purchasing.
kazpa has no affiliations with any VPS provider.

---

## Common VPS Mistakes

- Logging out instead of disconnecting (stops MT5)
- Forgetting to verify AutoTrading after reconnecting
- Restarting the VPS during live trading without pausing AutoTrading first
- Assuming the VPS monitors trading automatically
- Not keeping VPS credentials secure

---

## Final Perspective

A VPS is a reliability tool. It keeps MT5 running consistently but does not replace discipline, monitoring, or risk management.

For most kazpa users running VistaONE continuously, a VPS is essential.
For VistaX users running short sessions, a VPS is still strongly recommended for consistency.
