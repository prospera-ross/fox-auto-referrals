# Provider contracts consulted

Retrieved 2026-10-10. Documentation supports design, not proof of production
behavior. Cloudflare staging and one QBO Sandbox paid-invoice path were exercised.

OAuth deployment review: Intuit's [SDK CompanyInfo fixture](https://github.com/intuit/QuickBooks-V3-PHP-SDK/blob/master/src/Utility.Test/XmlObjectSerializerTest.php)
uses an entity ID of 1; do not equate that entity ID with the OAuth realm ID.
The [SDK CompanyInfo reader](https://github.com/intuit/QuickBooks-V3-PHP-SDK/blob/master/src/DataService/DataService.php)
constructs the authenticated URL from the realm. The implementation checks the
callback realm, pins the API host/company URL and requires owner confirmation.
For the public Pages hostname, use [Cloudflare's Access setup](https://developers.cloudflare.com/pages/platform/known-issues/#enable-access-on-your-pagesdev-domain);
preview policy alone does not protect it. These details were added to the runbook.

| Contract | Official source | Reliance and limit |
| --- | --- | --- |
| Pages service bindings | [Cloudflare Pages bindings](https://developers.cloudflare.com/pages/functions/bindings/) | Same-origin function forwards to private Worker; exercised locally |
| D1 SQL atomicity | [D1 database API](https://developers.cloudflare.com/d1/worker-api/d1-database/) | Prepared statements/transactions; schema and trigger exercised in local D1; not remote |
| Rate controls | [Workers rate limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) | Binding configuration and locality/permissive limits; no live quota guarantee |
| Server secrets | [Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/) | Worker secret CLI and bindings; encrypted tokens persisted in D1, not KV |
| QBO notification format | [Intuit webhook reference](https://static.developer.intuit.com/output_html/qbo/docs/develop/webhooks/configure-webhooks.html) | HMAC SHA256 over original body; CloudEvents 1.0 array with per-event realm/entity. Portal subscriptions confirmed `void`; genuine webhook delivery remains unobserved |
| Invoice semantics | [Intuit Invoice schema](https://github.com/intuit/QuickBooks-V3-PHP-SDK/blob/master/src/Data/IPPInvoice.php) | Invoice/customer/linked-payment shape passed for one deployed Sandbox invoice; broader contract coverage remains open |
| Payment schema | [Intuit Payment schema](https://github.com/intuit/QuickBooks-V3-PHP-SDK/blob/master/src/Data/IPPPayment.php) | Current payment reads/allocations; mocked checks and one deployed Sandbox payment allocation passed; production contract review pending |
| Customer schema | [Intuit Customer schema](https://github.com/intuit/QuickBooks-V3-PHP-SDK/blob/master/src/Data/IPPCustomer.php) | Customer contact lookup; normalization is application policy |
| Security baseline | [OWASP ASVS 5.0.0](https://github.com/OWASP/ASVS/tree/v5.0.0/5.0/en) | Version pin and initial public-boundary mapping; full review remains open |

QBO Accounting REST v3 operations: GET Invoice, Customer and Payment by trusted ID
under an authorized company; minor version 75 is the current Sandbox baseline.
Dynamic Intuit Invoice/Payment API reference pages returned only their JavaScript
shell in the research tool, so SDK schemas informed interface structure. These
unversioned SDK links are not a frozen provider contract; pin the supported API
minor version and exact schema evidence before provider activation.

REST minor version 75 is a configurable baseline, not a claim that it is the latest
release. One actual Sandbox customer/invoice/payment path passed; additional
provider shapes, webhook delivery and production compatibility remain open.

- [Intuit discovery](https://developer.intuit.com/.well-known/openid_configuration/):
  authorization, token and revoke endpoints used by the adapter.
- [Intuit OAuth SDK](https://github.com/intuit/oauth-jsclient): protocol reference;
  token lifetimes come from responses and the latest refresh token is stored.
  Sample token logging/retry behavior was not copied.
- [Payment properties](https://static.developer.intuit.com/sdkdocs/qbv3doc/ippdotnetdevkitv3/html/0b501ee6-1a8e-88b0-9bfb-df31903d89d6.htm):
  TxnDate is an accounting transaction date; it does not establish an exact payment instant.
- [Cloudflare Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/):
  backend verification with issuer/audience; `jose` 6.2.12 supplies verification.

No assumption of a dedicated `Paid` webhook event, complete invoice contact fields,
read-only OAuth accounting scope, refund finality, exactly-once delivery, or
cash settlement from Balance=0. Those must be established or handled explicitly.
