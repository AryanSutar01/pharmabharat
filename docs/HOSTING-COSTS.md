# PharmaBharat — initial capital for hosting

**Drafted:** 9 October 2026
**Assumes:** USD/INR **₹96.9** (checked today), and **+18% GST** on AWS India (AISPL) invoices.
**Assumes about traffic:** a handful of users — the client, us, and the first one or
two pilot shops. Not public launch traffic. Every number below falls apart if that
changes, and §6 says where.

---

## 1 · The short answer

| | Day one | 12 months |
|---|---|---|
| **Lean** — smallest box that runs the app | **₹1,400** (domain only) | **≈ ₹11,500** |
| **Comfortable** — recommended | **₹1,400** (domain only) | **≈ ₹22,000** |

Day one is only the domain because **AWS gives new accounts $100–200 in credits**
and **Lightsail is free for the first 3 months**. So the server costs nothing to
start. Budget the 12-month figure anyway and treat the free months as buffer —
the credits expire 6 months after sign-up whether you use them or not.

**If you want one number to give the client: ₹22,000 for the first year.**

---

## 2 · Recommended monthly (the "comfortable" tier)

| Item | USD/mo | Why this and not less |
|---|---|---|
| Lightsail **2 GB RAM, 2 vCPU, 60 GB SSD, 3 TB transfer** | **$12.00** | A Next.js 16 production build needs more than 512 MB. The $5 nano will OOM mid-build. |
| Lightsail snapshots (2 kept) | $2.00 | The only thing standing between you and rebuilding the box by hand. |
| S3 bucket for database dumps | $0.30 | See §5 — Atlas's free tier has no backups. |
| Route 53 hosted zone | $0.50 | Or **₹0** on Cloudflare DNS. |
| | **$14.80** | |
| **+ 18% GST** | **$17.46** | |
| **In rupees** | **≈ ₹1,694/mo** | **≈ ₹20,330/year** |

Plus the domain: **.com $14/yr ≈ ₹1,358** from Route 53 (WHOIS privacy included).

**Year one total ≈ ₹21,700.** Call it **₹22,000**.

### The lean version — ≈ ₹836/mo

Drop to the **1 GB Lightsail bundle (~$7)**, use **Cloudflare DNS (free)**, and skip
snapshots. **≈ ₹11,500 for the year.**

This works, with one condition: **don't run `npm run build` on the box.** 1 GB
won't survive it. Build in GitHub Actions and ship the output, or add 2 GB of swap.
If you'd rather not think about that, pay the extra ₹70/month.

### One saving I'd skip

Lightsail sells the same 2 GB bundle **IPv6-only for $10** instead of $12. It saves
₹194/month and I'd still not take it. A chemist on an IPv4-only broadband or mobile
network simply cannot reach an IPv6-only host. Don't make reachability a line item
on a product for small-town pharmacies.

---

## 3 · What stays free, and should

| Service | Tier | Keep it because |
|---|---|---|
| **MongoDB Atlas M0** | free forever, 512 MB, Mumbai region | DocumentDB starts around $200/mo. Not a candidate. |
| **Cloudinary** | free tier | KYC documents already work as authenticated assets. Migrating to S3 is work with no saving at this size. |
| **Gmail SMTP** | free, ~500 mails/day | Already wired. SES is $0.10 per 1,000 but needs out-of-sandbox approval. |
| **Let's Encrypt** | free | TLS via certbot. ACM is also free but wants a load balancer (~$16/mo) you don't need. |
| **GitHub Actions** | free minutes on a private repo | Enough for deploys at this frequency. |
| **UptimeRobot** | free tier | Tells you the box died before the client does. |

**Do not self-host MongoDB on the same instance to save the Atlas bill.** Atlas M0
is already free, and 2 GB cannot hold Next.js and MongoDB together. You'd be paying
in reliability for a discount of zero.

---

## 4 · Honest comparison

The current setup is Vercel Hobby, which is **free but not licensed for commercial
use** — that's the actual reason to move, not cost.

| | Per month, incl. GST | Ops work |
|---|---|---|
| **Lightsail 2 GB** | ₹1,694 | You own the server, nginx, TLS renewal, cron, deploys |
| Vercel Pro | ₹2,290 (~$20/seat) | Almost none |
| Render Starter | ~₹800 (~$7) | Almost none |

So AWS is **cheaper than Vercel Pro and commercially licensed** — your instinct is
right on both counts.

**But in fairness: Render is cheaper than both and needs no server administration.**
Lightsail costs roughly ₹900/month more than Render once you count GST, and the
difference is paid in your evenings — nginx, certbot renewals, a cron entry, a
deploy script, and being the person who gets up when it stops. At this traffic
level the technical case for AWS is weak; the case for *learning* AWS, or for a
client who wants to hear "AWS", is real. Both are legitimate. Just pick it knowing
that's the trade.

Budget below is AWS, as asked.

---

## 5 · Work this budget assumes (free in money, not in time)

These are not optional — the app will not run correctly on AWS without them.

1. **Cron.** `vercel.json` crons are a Vercel feature and do nothing on a VPS.
   `/api/cron/daily` drives expiry alerts, licence-expiry checks and reorder
   calculations — the heart of the product. Needs a system crontab entry hitting it
   with the `CRON_SECRET` bearer token.
2. **Database backups.** **Atlas M0 has no automated backups.** For a paying client
   holding real shop data, that's the largest uninsured risk in this plan. A nightly
   `mongodump` to S3 is a few lines and about ₹30/month.
3. **Process + proxy.** systemd or pm2 to keep Node alive, nginx in front, certbot
   for TLS with auto-renewal.
4. **`BETTER_AUTH_URL`** must be set to the real domain, and that exact callback URL
   registered with Google. Off Vercel there is no fallback to derive it from — the
   app will refuse to start rather than guess, which is deliberate.
5. **Deploy path.** Manual `git pull && npm ci && npm run build && restart`, or a
   GitHub Actions workflow. Decide before launch, not during an outage.

---

## 6 · Where this budget breaks

Worth saying out loud to the client, because it is the honest shape of the thing:
**₹22,000/year is a development-phase number, not an operating number.**

| Trigger | New cost |
|---|---|
| Atlas 512 MB fills up (real bills, several shops) | **M10 ≈ $57/mo ≈ ₹6,500/mo incl. GST** — the real cliff, ~4× the entire current budget |
| Traffic outgrows 2 GB | Lightsail 4 GB **$24/mo** |
| SMS or WhatsApp notifications | Not free at any volume. Currently out of scope by decision. |
| Cloudinary free tier exhausted | Move KYC documents to S3 |
| More than one person needs server access | Not a cost, but a reason to reconsider a managed host |

The first row is the one to watch. Everything else is small.

---

## 7 · What to buy, in order

1. Register the domain — **₹1,400**. Do this first; it's the only real day-one cost,
   and `BETTER_AUTH_URL` plus the Google OAuth callback both depend on the final name.
2. Create the AWS account, claim the credits, set a **Budgets alert at $20** before
   launching anything. This is the step people skip and regret.
3. Launch the 2 GB Lightsail instance in **ap-south-1 (Mumbai)** — same region as
   Atlas, and the users are here.
4. Static IP, nginx, certbot, systemd, cron, nightly dump to S3.
5. Point DNS, set `BETTER_AUTH_URL`, register the Google callback, redeploy.

---

## Price sources

Checked today: Lightsail bundles and the 3-months-free offer, the AWS free-tier
credits, Route 53 domain prices, USD/INR.

Taken from memory and **worth confirming before you commit**: the 1 GB Lightsail
bundle (~$7), Route 53 hosted zone ($0.50/mo), S3 storage ($0.023/GB), Lightsail
snapshot storage ($0.05/GB), Atlas M10 (~$57/mo), Vercel Pro ($20/seat), Render
Starter ($7).

- [Lightsail pricing](https://aws.amazon.com/lightsail/pricing/)
- [Lightsail bundles](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-bundles.html)
- [AWS Free Tier credits announcement](https://aws.amazon.com/about-aws/whats-new/2025/07/aws-free-tier-credits-month-free-plan/)
- [Route 53 TLD prices](https://tld-list.com/registrars/amazon-route-53)
- [USD/INR](https://wise.com/us/currency-converter/usd-to-inr-rate)
