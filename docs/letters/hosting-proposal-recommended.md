# Hosting proposal — Recommended plan

*[Replace the bracketed details before sending. Date it the day you send it.]*

---

**[Your name]**
[Your address]
[Phone] · [Email]

**Date:** [DD Month 2026]

**To:**
[Client name]
[Business name]
[Address]

---

**Subject: Hosting and domain costs for PharmaBharat — Recommended plan (₹22,500 for the first year)**

Dear [Client name],

As PharmaBharat moves from my development machine to a server you can reach from
anywhere, it needs a home of its own: a domain name and a hosting account. This
letter sets out the option I recommend, and explains what the extra cost buys over
the cheaper alternative.

The figures are for **infrastructure only**. They do not include my development
work, which is covered under our existing arrangement.

## What this covers

| Item | Purpose | Cost for 12 months |
|---|---|---|
| Domain name (.com, 1 year) | Your own web address, with privacy protection included | ₹1,400 |
| Application server — Amazon Lightsail, 2 GB, Mumbai | Runs the website, with room to work | ₹16,800 |
| Server images, two kept at all times | A complete snapshot of the machine, for fast recovery | ₹2,800 |
| Nightly database backup to Amazon S3 | A copy of your shop data taken every night | ₹350 |
| Managed DNS — Amazon Route 53 | Directs your domain to the server | ₹700 |
| Contingency | Exchange-rate movement and small overages | ₹450 |
| Database — MongoDB Atlas | Stores stock, bills, customers and accounts | Free tier |
| Document storage — Cloudinary | Drug licences and KYC documents, held privately | Free tier |
| Email delivery | Expiry alerts, refill reminders, invoices | Free tier |
| Security certificate (HTTPS) | Encrypts everything between the shop and the server | Free |
| **Total for the first year** | | **₹22,500** |

This works out to about **₹1,875 per month**. Amounts include 18% GST, which Amazon
charges on Indian accounts.

**Nothing is payable on day one except the domain, around ₹1,400.** Amazon gives new
accounts an opening credit and the server is free for its first three months, so
actual spending in the first year will likely be lower than the figure above. I have
budgeted the full amount rather than counting on the discount.

## Why I recommend this over the cheaper plan

The Essential plan at **₹11,500** is a genuine option and the system runs correctly
on it. The difference is about **₹900 a month**, and it buys two specific things.

**1 · The server itself is backed up, not only your data.**
Both plans copy your shop records — stock, bills, customers, accounts — to separate
storage every night, so your data survives either way. This plan also keeps a full
image of the machine. If the server fails, the difference is:

| | Essential | Recommended |
|---|---|---|
| Your data | Safe | Safe |
| Getting the site back up | I rebuild it by hand — about **half a working day** offline | Restored from the image in **minutes** |

Once a shop is billing customers over the counter on this system, half a day offline
is not an inconvenience — it is a shop that cannot sell. That is what the extra cost
is really for.

**2 · A machine that is not working at its limit.**
The larger server can prepare and install new versions of the site on its own. On the
smaller one, that has to be done elsewhere and transferred across, which is slower
and gives me one more thing that can go wrong on an evening when something needs
fixing quickly.

## What this does not cover

So that there are no surprises later:

- **SMS and WhatsApp notifications.** These are not free at any volume. Alerts and
  reminders currently go by email and are shown inside the app.
- **Growth well beyond the pilot stage.** See the next section.
- **My development time.**

## When this cost will rise

I would rather say this now than present it as a surprise:

The free database tier holds 512 MB. That is ample while we are testing, but once
several shops are billing on the system every day it will fill, and the paid tier is
about **₹6,500 per month**. That is the one item that changes this budget
materially — it is roughly three times the rest of the plan put together, and it
arrives with success rather than with any fault. Everything else grows in small
steps.

On current usage I do not expect to reach it during the pilot, and I will give you
warning well before we do rather than letting it appear on an invoice.

## What I need from you

1. Approval of the **₹22,500** figure for the first year.
2. Your preferred domain name, with a second choice in case the first is taken.
3. Confirmation of whether the account should be in your name or mine. **I would
   recommend your name**, so that the domain and the hosting remain yours
   regardless of what happens to our working arrangement. I can administer it
   either way.

Prices are as checked on 9 October 2026. Amazon bills in US dollars, so the rupee
total may move by a few percent with the exchange rate.

If you would prefer to begin on the Essential plan and move up when the first shop
goes live, that is a sound decision and I am happy to work that way. I have set out
that option in a separate letter.

Yours sincerely,

<br>

**[Your name]**
[Designation]
