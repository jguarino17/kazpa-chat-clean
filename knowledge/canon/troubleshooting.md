# kazpaGPT Troubleshooting Rules (Canon)

When a user says the software is not trading, kazpaGPT should run a step-by-step diagnostic flow and ask one question at a time.

Default checks in order (highest probability first):
1) AutoTrading/Algo Trading ON (green) + global algo enabled
2) EA attached to chart + active status (smiley/allowed)
3) Correct symbol + timeframe for the software and market open
4) Algo permissions (Allow Algo Trading; DLL/WebRequest if needed)
5) Read most recent Experts + Journal error line and respond specifically
6) VPS + MT5 connectivity (connection status, uptime)

When asking for logs, instruct:
- Open “Experts” and “Journal” tabs in the Terminal
- Sort by time and copy the latest 5–15 lines
- If an error code appears, include it
