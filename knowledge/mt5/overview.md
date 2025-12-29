# MetaTrader 5 (MT5) — Platform Overview & Requirements

This page explains what MetaTrader 5 (MT5) is, why kazpa requires it, and how kazpa software interacts with the platform.

Understanding MT5 is essential before installing or running any kazpa software.

---

## What MT5 Is

MetaTrader 5 (MT5) is a professional trading platform used to:
- Place and manage trades
- Run trading software
- View charts and execution
- Manage trading accounts

kazpa software runs **inside MT5**.
MT5 is the environment where all execution occurs.

---

## MT5 Requirement (Non-Negotiable)

kazpa operates on **MetaTrader 5 only**.

Important rules:
- MT4 is **not supported**
- Other platforms are **not supported**
- MT5 compatibility is required from the broker

If a broker does not support MT5, kazpa cannot run on that account.

---

## How kazpa Uses MT5

kazpa software:
- Is installed inside the MT5 platform
- Executes trades through MT5
- Follows MT5’s AutoTrading permissions
- Uses the broker connection provided by MT5

kazpa does not bypass MT5.
kazpa does not control MT5.
kazpa operates within MT5’s rules and permissions.

---

## AutoTrading (Critical Concept)

AutoTrading is a global MT5 setting that allows software to place trades.

Important points:
- AutoTrading must be **ON** (green) for kazpa software to execute trades
- Turning AutoTrading **OFF** immediately stops execution
- AutoTrading can be toggled at any time by the user

Turning AutoTrading OFF is a valid and responsible risk-control action.

---

## User Control Inside MT5

Within MT5, users control:
- When AutoTrading is enabled or disabled
- Which charts the software is attached to
- Account login credentials
- Chart timeframes
- Platform restarts and updates

kazpa software will not override user control.

---

## Demo vs Live Accounts in MT5

MT5 supports both:
- Demo accounts
- Live accounts

Users should:
- Install and test kazpa software on demo first
- Observe behavior during drawdown
- Practice monitoring and AutoTrading control
- Move to live only when comfortable

Demo performance does not guarantee live performance.

---

## Common MT5 Misconceptions

MT5 is often misunderstood as:
- “Just a charting tool”
- “Something kazpa controls”
- “Automatically safe if software is installed”

These assumptions are incorrect.

MT5 is a **tool**.
User responsibility remains.

---

## Platform Stability & Updates

Users should be aware:
- MT5 updates can restart the platform
- VPS or system restarts can disconnect MT5
- Software should be monitored after updates

AutoTrading status should always be verified after:
- MT5 restarts
- System updates
- VPS reconnects

---

## Troubleshooting Mindset

If kazpa software is not executing:
- Check AutoTrading status
- Confirm the correct account is logged in
- Verify the chart and timeframe
- Confirm the software is attached correctly

Most issues originate from MT5 settings, not the software itself.

---

## Final Perspective

MT5 is the execution layer for kazpa software.

Understanding MT5 is not optional.
It is part of responsible use.

kazpa provides structured automation.
MT5 provides the execution environment.
Users provide oversight and decisions.
