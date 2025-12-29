# Troubleshooting — Common Issues & Diagnostic Flow

This page covers the most common issues users encounter when running kazpa software and how to diagnose them logically.

Most problems are caused by skipped steps, incorrect setup, or misunderstood platform behavior — not software failure.

Do not rush troubleshooting. Follow the diagnostic order.

---

## First Rule of Troubleshooting

Before assuming something is broken:
- Pause execution
- Review the setup order
- Confirm recent changes
- Avoid reinstalling repeatedly

Repeated changes without diagnosis create new problems.

---

## Issue: “The Software Is Not Trading”

This is the most common concern.

### Step 1 — Check AutoTrading
- Confirm AutoTrading is ON (green)
- AutoTrading OFF = no execution
- Toggle OFF and ON once to confirm

AutoTrading is the #1 cause of “not trading.”

---

### Step 2 — Confirm Correct Chart & Timeframe

Each software has strict requirements:

- VistaONE:
  - EURUSD
  - M15

- VistaX:
  - XAUUSD (Gold)
  - M5

Incorrect chart or timeframe prevents execution.

---

### Step 3 — Confirm Software Is Loaded Correctly
- Software appears in the Navigator
- Software is attached to only one chart
- No duplicate instances running unintentionally
- No visible initialization errors

Check the **Experts** and **Journal** tabs for messages.

---

### Step 4 — Confirm License Status
- No license error messages
- Activation was completed on this environment
- MT5 has not been reinstalled since activation

Most execution issues are **not license-related**, but license errors must be addressed before proceeding.

---

### Step 5 — Confirm Market Conditions
- Market is open
- Instrument is tradable
- Not during extreme low liquidity
- Not paused intentionally by user

No trades during closed markets is expected behavior.

---

## Issue: “It Was Trading Before, Now It Isn’t”

This usually indicates a change.

Check for:
- MT5 restart or update
- VPS restart or reconnect
- AutoTrading turned OFF after reconnect
- Chart or timeframe changed
- Risk settings modified
- Session window ended (VistaX)

After restarts, AutoTrading must be re-verified.

---

## Issue: “I See Errors in MT5”

Errors should be read, not ignored.

Common causes:
- Incorrect installation folder
- Wrong chart or timeframe
- Missing permissions
- Platform restart during execution

kazpaGPT should guide users to:
- Read error messages
- Identify whether errors are platform-related or configuration-related
- Avoid guessing

---

## Issue: “The Software Is Losing Money”

Losses and drawdown are part of trading.

Diagnostic questions:
- Was demo testing completed?
- Was risk increased recently?
- Are market conditions abnormal?
- Is execution being monitored?
- Is drawdown exceeding personal tolerance?

Losses alone do not indicate a malfunction.

---

## Issue: “It’s Trading Too Much / Too Fast”

Possible causes:
- Risk configuration too aggressive
- VistaX running outside intended sessions
- Multiple instances running
- Incorrect assumptions about behavior

Reducing risk and pausing execution is appropriate.

---

## Issue: “MT5 Closed / VPS Disconnected”

If MT5 closes or disconnects:
- Trades stop executing
- Software pauses naturally
- No action is taken by the software

After reconnect:
- Open MT5
- Confirm account login
- Verify AutoTrading
- Confirm charts and software state

---

## What NOT to Do During Issues

Avoid:
- Reinstalling repeatedly
- Changing multiple settings at once
- Increasing risk to “fix” losses
- Ignoring error messages
- Assuming the software is broken immediately

Slow diagnosis prevents bigger problems.

---

## When to Escalate to Support

Escalate to official kazpa support if:
- License errors persist
- Software does not load after correct installation
- MT5 reports repeated execution failures
- You are unsure what changed
- The issue is account-specific

Provide support with:
- Broker name
- Demo or live account
- VistaONE or VistaX
- Screenshots of errors
- Description of recent changes

kazpaGPT can guide diagnosis, but support handles account-specific resolution.

---

## Final Troubleshooting Perspective

Most issues are resolved by:
- Checking AutoTrading
- Confirming chart and timeframe
- Reviewing recent changes
- Slowing down

kazpa software follows rules.
Problems usually come from broken assumptions or skipped steps.

Structure solves issues.
