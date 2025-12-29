# Software Installation — Correct Placement & Verification

This page explains how to correctly install kazpa trading software inside MetaTrader 5 (MT5).

Incorrect installation is the most common reason users believe the software is “not working.”

Follow these steps carefully and do not improvise.

---

## Before You Install (Checklist)

Before installing kazpa software, confirm:
- MT5 is installed and opens correctly
- You are logged into the intended account (demo or live)
- License activation is completed or ready to complete
- MT5 is fully updated
- AutoTrading is OFF during installation

If any of these are not true, stop and fix them first.

---

## Where kazpa Software Files Go

kazpa software files must be placed in the **correct MT5 directory**.

Correct path: MQL5 → Experts → Advisors


Important notes:
- Files must go inside **Advisors**
- Do not place files directly in `Experts`
- Do not place files in `Indicators`
- Do not rename software files

Incorrect placement will prevent the software from loading.

---

## Installing the Software

1. Open MT5
2. Go to **File → Open Data Folder**
3. Navigate to: MQL5 → Experts → Advisors


4. Copy the kazpa software files into this folder
5. Close and restart MT5

Restarting MT5 is required for the software to appear.

---

## Confirming Successful Installation

After restarting MT5:
- Open the **Navigator** panel
- Expand **Expert Advisors**
- Confirm the kazpa software appears in the list

If it does not appear:
- Recheck the folder path
- Confirm MT5 was restarted
- Confirm files were not blocked or renamed

---

## Attaching the Software to a Chart

To attach the software:
1. Open a chart for the correct instrument
2. Set the correct timeframe
3. Drag the kazpa software onto the chart
4. Review the input settings
5. Click **OK**

The software must be attached to:
- The correct market
- The correct timeframe
- Only one chart per instance

---

## Timeframe & Instrument Requirements

Each kazpa software has specific requirements.

- VistaONE:
- Instrument: EURUSD
- Timeframe: M15

- VistaX:
- Instrument: XAUUSD (Gold)
- Timeframe: M5

Incorrect charts or timeframes will prevent proper execution.

---

## AutoTrading Verification

After attaching the software:
- Enable AutoTrading (green)
- Confirm no error messages appear
- Confirm the software initializes correctly

AutoTrading must be ON for execution to occur.

---

## Common Installation Mistakes

Avoid these issues:
- Placing files in the wrong folder
- Forgetting to restart MT5
- Attaching to the wrong chart
- Using the wrong timeframe
- Running multiple instances incorrectly
- Turning AutoTrading ON before installation is complete

Most problems are installation-related, not software failures.

---

## If the Software Does Not Trade

If the software loads but does not execute:
- Check AutoTrading status
- Confirm correct instrument and timeframe
- Verify license activation
- Review input settings
- Check the MT5 Experts and Journal tabs for messages

Do not reinstall repeatedly without understanding the issue.

---

## When to Escalate to Support

Escalate to official kazpa support if:
- Software does not appear after correct installation
- License errors persist
- MT5 reports repeated execution errors
- You are unsure whether installation was completed correctly

kazpaGPT can guide setup, but account-specific issues require support.

---

## Final Installation Perspective

Correct installation is foundational.

When installed properly:
- The software loads cleanly
- Execution behaves as expected
- Troubleshooting becomes easier

Rushing installation causes confusion.
Follow the steps exactly.
