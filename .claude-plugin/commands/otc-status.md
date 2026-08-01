---
description: Check status of an OTC intent or RFQ
argument-hint: <intent-id>
---

Look up status for intent ID: $ARGUMENTS

Use the `private_otc_audit_trade` MCP tool to fetch:
- Current status (Open, Filled, Cancelled, Expired)
- Maker address
- Mode (Direct or RFQ)
- Deadline (and time remaining if Open)
- For RFQ: number of bids submitted (count visible, prices encrypted)

If the user is the maker or has been authorized, also show:
- Encrypted handle for sell amount (with offer to decrypt)
- Encrypted handle for min buy amount (with offer to decrypt)
