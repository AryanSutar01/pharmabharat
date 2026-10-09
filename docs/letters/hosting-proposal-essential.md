# Hosting proposal — Essential plan

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

**Subject: Hosting and domain costs for PharmaBharat — Essential plan (₹11,500 for the first year)**

Dear [Client name],

As PharmaBharat moves from my development machine to a server you can reach from
anywhere, it needs a home of its own: a domain name and a hosting account. This
letter sets out the lower of two options so you can decide what to approve.

The figures are for **infrastructure only**. They do not include my development
work, which is covered under our existing arrangement.

## What this covers

| Item | Purpose | Cost for 12 months |
|---|---|---|
| Domain name (.com, 1 year) | Your own web address, with privacy protection included | ₹1,400 |
| Application server — Amazon Lightsail, 1 GB, Mumbai | Runs the website | ₹9,700 |
| Nightly database backup to Amazon S3 | A copy of your shop data taken every night | ₹400 |
| Database — MongoDB Atlas | Stores stock, bills, customers and accounts | Free tier |
| Document storage — Cloudinary | Drug licences and KYC documents, held privately | Free tier |
| Email delivery | Expiry alerts, refill reminders, invoices | Free tier |
| Security certificate (HTTPS) | Encrypts everything between the shop and the server | Free |
| **Total for the first year** | | **₹11,500** |

This works out to about **₹960 per month**. Amounts include 18% GST, which Amazon
charges on Indian accounts.

**Nothing is payable on day one except the domain, around ₹1,400.** Amazon gives new
accounts an opening credit and the server is free for its first three months, so
actual spending in the first year will likely be lower than the figure above. I have
budgeted the full amount rather than counting on the discount.

## What this does not cover

So that there are no surprises later:

- **SMS and WhatsApp notifications.** These are not free at any volume. Alerts and
  reminders currently go by email and are shown inside the app.
- **Growth beyond the pilot stage.** This plan is sized for you, me, and the first
  one or two pilot shops. The point at which it has to increase is in the next
  section.
- **My development time.**

## One thing I want to be straightforward about

The Essential plan protects **your data** but not **the server itself**.

Your shop records — stock, bills, customers, accounts — are copied to separate
storage every night, so they survive even if the server is lost. What is not
included is a full image of the server. If the machine itself fails, I rebuild and
reinstall it by hand, and the site would be down for roughly **half a working day**
while I do.

The Recommended plan, which I have set out in a separate letter at **₹22,500 for the
first year**, adds that server image and a larger machine. Recovery then takes
minutes instead of hours. The difference is about **₹900 per month**.

For the present stage — testing, your review, and the first pilot shop — **I think
the Essential plan is a reasonable choice**, and I am happy to proceed on it. I
would want to move to the Recommended plan before real shops depend on the system
daily, and I will tell you clearly when I think we have reached that point.

## When this cost will rise

I would rather say this now than present it as a surprise:

The free database tier holds 512 MB. That is ample while we are testing, but once
several shops are billing on the system every day it will fill, and the paid tier
is about **₹6,500 per month**. That is the one item that changes this budget
materially; everything else grows in small steps. On current usage I do not expect
to reach it during the pilot.

## What I need from you

1. Approval of the **₹11,500** figure for the first year.
2. Your preferred domain name, with a second choice in case the first is taken.
3. Confirmation of whether the account should be in your name or mine. **I would
   recommend your name**, so that the domain and the hosting remain yours
   regardless of what happens to our working arrangement. I can administer it
   either way.

Prices are as checked on 9 October 2026. Amazon bills in US dollars, so the rupee
total may move by a few percent with the exchange rate.

I am glad to go through any part of this in person.

Yours sincerely,

<br>

**[Your name]**
[Designation]
