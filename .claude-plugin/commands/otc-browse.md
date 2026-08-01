---
description: Browse open OTC intents on PrivateOTC
argument-hint: [filter: pair like cETH/cUSDC]
---

Show currently open OTC intents on PrivateOTC.

If $ARGUMENTS is provided, filter by that asset pair.

Use the `private_otc_browse_intents` MCP tool. Then format the response as a table with:
- Intent ID
- Asset pair
- Mode (Direct or RFQ)
- Deadline (relative time)
- Maker (truncated address)

Note that amounts are encrypted and not shown unless the user is authorized to decrypt them.
