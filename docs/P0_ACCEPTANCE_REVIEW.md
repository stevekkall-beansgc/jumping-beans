# P0 acceptance review

Date: 2026-08-31  
Scope: Terra's local P0 resolver, consent, comparison, partner-boundary, and
Watch-flow slice. Review only; no production code was changed and nothing was
deployed.

## Verdict: STOP / NO-GO

The deterministic gate is green, and the local UI passes the anonymous-context,
explicit-demo-consent, apply-once, and staged-watch presentation checks. P0 is
not accepted and the product is not competition-ready because the required
headed WebMCP cross-origin execution could not be run in this browser session,
the deployed origin is an older baseline, and Watch replay with the same request
ID and a changed payload silently succeeds instead of returning an idempotency
conflict.

## Evidence and passed checks

### Mechanical and source-level checks

- \`node scripts/check-product.mjs\` passed: **336 assertions**. The planning
  documents still report 317; the current gate output is 336.
- \`git diff --check\` passed.
- The isolated resolver probe preserved two valid offers and normalized the
  other origins as \`ready\`, \`invalid\`, \`timeout\`, and \`failed\`;
  comparison exposure was deterministic (\`b,c\`) and the truncated offer was
  represented as \`stage: "exposure"\`; anonymous projection returned no
  categories or max price. This is source-level evidence, not live partner
  evidence.
- Capability negative cases in the product gate cover missing grant,
  wrong-origin, insufficient-scope, and expired-grant denial, plus a valid
  scoped grant.

### Fresh local browser UI

The fresh-state run used \`http://127.0.0.1:8082/\`, which avoids the existing
\`localhost\` browser storage without deleting it.

- **Pass — anonymous by default:** no saved notes were shown; the Alex demo
  checkbox was unchecked; the page stated that partner calls begin without
  persona data.
- **Pass — explicit demo consent:** checking the labeled Alex demo checkbox
  changed the Concierge message to say the profile was approved for this
  request and would be sent only to opted-in sites. It remained a user action,
  not an implicit seed.
- **Pass — apply once:** selecting Testimonials and clicking “Apply once
  without saving” changed Site B to an adapted illustrative preview, showed the
  applied-once status, and left saved notes empty.
- **Pass — staged Watch confirmation:** “Prepare deal watch” opened a panel
  containing the exact product/price fact, browser scope, retention, and the
  explicit non-outcomes (no notification, order, payment, or message). No save
  was performed.
- **Pass — Watch declarative surface:** the fresh Watch page exposed
  \`toolname="register_interest"\`, a descriptive \`tooldescription\`, and an
  empty \`toolautosubmit\` attribute. The merchant page rendered the four SKU
  aggregates with zero active signals and the stated 30-day retention.
- **Pass — honest degraded UI:** the engine showed an illustrative Site B
  preview and per-origin \`failed · 0 eligible · 0 exposed\` rows rather than
  claiming partner success.

## Failed checks and blockers

### 1. Real WebMCP discovery and partner execution — BLOCKED / NOT PROVEN

The in-app headed browser connected, but its WebMCP execution surface returned
\`gpt-5.6-luna does not support command "webmcp_list_tools"\`. Direct inspection
of all three fresh partner pages returned \`typeof document.modelContext ===
"undefined"\`; the engine console captured \`tool.js\` errors at the partner
registration calls. The local engine therefore showed no opted-in tools and
never rendered a real partner comparison.

This means there is no acceptance proof for real cross-origin tool discovery,
real partner execution, multi-origin comparison in the browser, or browser
receipts. No pass is claimed for those cases.

### 2. Partial, malformed, timeout, and no-match browser outcomes — NOT PROVEN

The adapter probe and gate exercise these cases in-process, but no headed
WebMCP partner call ran. The browser only observed the all-unavailable/failed
fallback state. A fresh flagged headed Chrome run with real tools is still
required, including a partner returning no matches and a mixed-origin failure
matrix.

### 3. Watch idempotency conflict — FAIL

The Watch API deduplicates an existing request ID without comparing the
normalized payload. Reusing \`acceptance-replay-001\` first at $100 and then at
$999 returned HTTP 200 both times and returned the original $100 record; the
second request did not return a conflict. This is not replay-safe for a
consequential write.

The browser staging panel passed, but the final browser save was not submitted
because this review did not authorize an external side effect without an
action-time confirmation. The non-browser ephemeral API harness reproduced the
replay defect without touching deployed storage.

### 4. Journey receipt evidence — FAIL / NOT PROVEN

The source contains a \`get_journey_receipt\` engine tool and decision-receipt
construction, but WebMCP was unavailable, so the tool could not be discovered
or called. No exportable receipt was captured linking the fresh journey,
context, invocation outcomes, comparison decision, intervention, and terminal
outcome. This prevents the requested audit-evidence claim.

### 5. Production cross-origin evidence — FAIL for this slice

\`https://jumping-beans-engine.steve-k-kall.workers.dev/\` loaded, but it is the
older deployed baseline: it has the one-off journey copy and no demo-context
control. It reported no opted-in tools. The local Terra slice was not deployed,
as required by this review, so production cannot corroborate the current diff.

### 6. Remaining competition-readiness risks

- Grants are browser-local objects, not externally verifiable authorization
  evidence or a server execution boundary.
- The local Watch write has no payload-bound confirmation grant, stable
  action-level idempotency conflict handling, atomic claim/store boundary, rate
  limit, or action receipt.
- Cross-partner canonical product identity and freshness/expiry policy are not
  fully enforced; comparison behavior is covered only by the in-process probe.

## Exact reproductions

Run from the product root:

\`\`\`bash
cd /Users/stephenkall/beans/products/jumping-beans
node scripts/check-product.mjs
git diff --check
\`\`\`

Start the four local isolated origins in separate terminals:

\`\`\`bash
python3 spikes/a-cross-origin/serve.py 8082 engine
python3 spikes/a-cross-origin/serve.py 8084 partners/petsupply
python3 spikes/a-cross-origin/serve.py 8085 partners/coffee
python3 spikes/a-cross-origin/serve.py 8086 partners/watch
\`\`\`

In a fresh headed Chrome session with the repository's required
\`--enable-features=WebMCP,WebMCPTesting\` flag, open:

\`\`\`text
http://127.0.0.1:8082/
http://127.0.0.1:8084/
http://127.0.0.1:8085/
http://127.0.0.1:8086/
http://127.0.0.1:8086/merchant/
\`\`\`

On the engine, verify the initial anonymous state, opt into the labeled Alex
demo profile, apply a presentation rule once, and stage (but do not confirm)
the Watch. On each partner page, verify the page's WebMCP registration in the
headed browser and run the engine's documented \`getTools({ fromOrigins })\`
probe. Capture \`get_journey_receipt\` output only if the browser exposes it.

The in-process resolver matrix used for this review is:

\`\`\`bash
node --input-type=module -e 'import * as p from "./engine/p0.js"; const origins=["https://one.invalid","https://two.invalid","https://three.invalid","https://four.invalid"]; const deal=(sku,price,origin)=>({sku,name:"Offer "+sku,category:"coffee",listPrice:price+10,dealPrice:price,partnerId:origin,partnerName:origin,collateral:[{type:"price-proof"}]}); const result=await p.resolvePartnerTools({tools:origins.map(origin=>({origin,name:"get_matching_deals"})),allowedOrigins:origins,timeoutMs:10,inputForOrigin:()=>({categories:[]}),execute:tool=>tool.origin===origins[1]?Promise.resolve({deals:[{nope:true}]}):tool.origin===origins[2]?new Promise(()=>{}):tool.origin===origins[3]?Promise.reject(new Error("offline")):Promise.resolve({deals:[deal("one",20,"one"),deal("two",10,"one")]})}); const comparison=p.resolveOfferDeals([deal("a",30,"a"),deal("b",10,"b"),deal("c",20,"c")],{profile:null,preferences:{formats:[]},limit:2}); const anonymous=p.createContextSnapshot({profile:{personaId:"seed",recurringCategories:["coffee"]},preferences:{formats:[]},applied:false}); console.log(JSON.stringify({dealCount:result.deals.length,outcomes:result.originOutcomes,comparison:comparison.exposed.map(x=>x.sku),withheld:comparison.withheld,projected:p.projectPartnerContext(anonymous,origins[0])}));'
\`\`\`

The replay defect is reproduced without deployed storage:

\`\`\`bash
node --input-type=module -e 'import { onRequestPost } from "./partners/watch/functions/api/register-interest.js"; const req=(body)=>new Request("http://watch.local/api/register-interest",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)}); const base={confirmed:true,product:"NIV-77007Q45",requestId:"acceptance-replay-001"}; const a=await onRequestPost({request:req({...base,pricePoint:100}),env:{}}); const b=await onRequestPost({request:req({...base,pricePoint:999}),env:{}}); console.log(JSON.stringify({first:{status:a.status,body:await a.json()},replayDifferentPayload:{status:b.status,body:await b.json()}}));'
\`\`\`

Observed replay result: first request \`200\`, second request \`200\`, second body
returned the original $100 record. Expected result for acceptance is an explicit
idempotency conflict for the changed payload.

