# PharmaBharat — product walkthrough video

**Runtime:** ~9 minutes (trimmable to 8, stretchable to 10)
**Audience:** the client's prospective investors — people who know the pharma trade but have not seen this product
**Purpose:** show that the hard part is built and working, and that it solves a problem they recognise

---

## Before you record

**Read this first — one of these is a blocker.**

| | |
|---|---|
| ⚠️ **Demo data** | The marketplace has a seeder (`npm run seed:demo`), but **the shop module has none**. Reports, refills, customers, the ledger and the alert pages will be **empty**, and empty screens kill sections 4–8. You need a seeded shop with ~3 months of bills before you record. |
| ⚠️ **Numbers on screen** | Every `[VERIFY]` marker below is a figure I could not source. Either get a citation or cut the sentence. Do not put an unsourced number in front of investors. |
| **Browser** | Chrome, 1920×1080, zoom 100%, **no bookmarks bar**, one clean profile. Hide any real email address. |
| **Recording** | OBS or Loom at 1080p60. Mouse movements slow and deliberate — a fast cursor reads as nervous. |
| **Audio** | Record narration **separately** from the screen capture. It is far easier to re-do one sentence than one take. |
| **Language** | English. Show the Hindi/Marathi switch (section 7) rather than talking about it. |
| **Do not show** | The admin panel's real user list, any real GSTIN, any real phone number, the `.env` file, or your terminal. |

**Honesty note.** This product has no live users and has not yet been run in a real
shop. Nothing in this script claims otherwise, and you should not add it. If an
investor asks "who is using it", the true answer — *"it's built and tested, and
we're putting it in front of our first shop this week"* — is a better answer than
a vague one, because the next question is always "can I talk to them?"

---

## 1 · The problem (0:00 – 0:50)

**On screen:** No UI yet. A plain title card, or you on camera.

> Every medical store in India is losing money in two places at once.
>
> The first is the shelf. Medicines expire. A strip sits at the back of a drawer,
> nobody notices the date, and one morning it is worth nothing. The shop paid for
> it, and now the shop throws it away.
>
> The second is the buying. The same medicine costs different amounts from
> different distributors, and the only way to know is to ring around. Most shops
> don't. They order from whoever they always order from.
>
> Both of these come from the same thing: **nobody can see the batch.** The batch
> number and the expiry date are written on the box, copied onto a paper bill, and
> then they disappear.
>
> PharmaBharat starts there.

**Direction:** Slow down on "nobody can see the batch." That is the thesis of the
whole product — everything after this is a consequence of it.

---

## 2 · What it is (0:50 – 1:25)

**On screen:** The landing page. Scroll once, slowly, top to bottom.

> PharmaBharat is a B2B marketplace connecting medical stores, wholesale
> distributors and pharma companies — and, for the store, a complete shop system:
> its stock, its billing counter, its customers, its accounts.
>
> Every business on it is verified against its GST registration and its drug
> licence before it can trade. Nobody sells here anonymously.
>
> And everything in it is tracked at the level of the **batch**, not the medicine.

**Direction:** Do not read the feature cards aloud. Let them be read while you
talk over them.

---

## 3 · Buying: what a shop sees (1:25 – 2:55)

**On screen:** `/app/catalog` → search "Dolo" → open a product page.

> This is the catalogue. A shop searches the way it thinks — by brand name, by the
> salt, or by the condition it treats.

**On screen:** The product page, with the seller list visible.

> Here is one medicine, and every verified distributor selling it. Look at what a
> shop can see in one place: the MRP, what each distributor is charging, the
> margin that leaves, **and the expiry date of the actual batch they would ship.**
>
> That last column does not exist anywhere else. A shop buying on the phone finds
> out the expiry when the box arrives.

**On screen:** Add two or three items to the cart → open `/app/cart` → point at the
savings card.

> The cart does something useful here. It checks every line against every other
> distributor, and if the same medicine is cheaper elsewhere it says so — with the
> saving, and with how many deliveries the order would come from, because five
> cheap deliveries is not cheaper than two.
>
> One click switches the whole cart.

**On screen:** Checkout → the orders page showing the split.

> One cart, but the order splits by distributor automatically, because each one
> invoices separately. CGST and SGST within the state, IGST across a state line,
> HSN codes on every line — the GST invoice is generated and emailed, not typed.

**[VERIFY]** If you want to claim a typical saving percentage here, it needs to
come from real orders. Do not estimate it.

---

## 4 · The shop counter (2:55 – 4:25)

**On screen:** `/app/shop/billing`.

> Now the other side of the same shop — the counter, where the medicine actually
> gets sold.
>
> The counter searches the shop's own shelf. And notice the order the batches come
> in: **the one expiring first is offered first.** Not the newest, not the one on
> top. The one that will die soonest.

**On screen:** Add a medicine. Point at the batch dropdown.

> That single decision is most of the expiry problem, solved quietly, every time
> anybody sells anything.

**On screen:** Add a second line, switch it to **Tablets**, enter 4.

> And this matters more than it looks. A chemist does not always sell a whole
> strip. Somebody comes in with a fever and wants four tablets. So the system
> holds stock in tablets, not strips — it prices four tablets from the strip's
> MRP, takes exactly four off the shelf, and leaves an open strip of eleven, which
> it will keep track of.
>
> Software that cannot cut a strip does not get used in an Indian medical shop.

**On screen:** Attach a customer, save the bill, show the printable receipt.

> A GST bill, with batch and expiry printed on it, in about fifteen seconds.

**Direction:** This section sells the product to anyone who has stood behind a
counter. Do not rush the loose-tablet moment.

---

## 5 · Expiry (4:25 – 6:00) — **the centre of the video**

**On screen:** `/app/shop/alerts`.

> Here is what the shop sees every morning.
>
> Everything expiring in the next ninety days, in three buckets — ninety, sixty,
> thirty days — and next to each one, **the money.** Not "twelve batches". Twelve
> batches, worth this much, at what you paid for it.
>
> Because that is the number that makes somebody act.

**On screen:** Scroll to the expired section, then to the low-stock tab.

> Expiry warnings go out automatically at each of those three levels, once per
> batch — no repeats, no noise. The same thing runs on the distributor's side, so
> stock gets flagged while it is still worth something to somebody.

**On screen:** `/app/shop/reports` → the "Lost to expiry" card.

> And it is measured. This is what actually expired on the shelf last month, at
> cost. A shop that can see this number can manage it. Today, almost no shop can.

> So: the date is captured when the batch arrives, watched while it sits,
> respected when it is sold, and counted when it is lost. That is the whole chain,
> and there is no manual step in it.

---

## 6 · Redistribution (6:00 – 7:00)

**On screen:** `/app/shop/alerts` low-stock tab → click **Order these** → the quick
order page filling itself in.

> Now the other half of the problem — getting stock to where it will actually sell.
>
> When the shop is running low, it does not guess. The reorder level comes from
> how fast that medicine really sells in that shop. One click turns the low-stock
> list into an order, priced at the best available distributor.

**On screen:** Show the pasted purchase list working.

> Or the shop pastes its own list — the way it already writes it — and the system
> matches it to the catalogue and prices it.

**On screen:** Back to a catalogue product page, pointing at expiry dates on offers.

> And this is where expiry and buying meet. A distributor with stock that has six
> months left is visible here, with that date shown honestly. A shop that turns
> over that medicine quickly can take it and sell it — where sitting in the
> distributor's godown it would have died.
>
> The batch-level data is what makes that possible, and that is the part that is
> built.

**Say this plainly — it is true and it is the stronger position:**

> A dedicated clearance channel for near-expiry stock is the obvious next step. It
> is a small feature on top of the data we already capture. The hard part —
> getting every batch and every date into the system in the first place — is done.

---

## 7 · Trust and compliance (7:00 – 7:55)

**On screen:** `/admin/recalls` → issue a recall on a batch (use a seeded one).

> When a batch is recalled — and it happens — today that is phone calls.
>
> Here, one entry. Every listing of that batch is frozen across the platform, the
> distributors holding it are told, and so is every shop that already bought it.
> In seconds.

**On screen:** `/app/shop/register`.

> Schedule H and H1 medicines are recorded as they are dispensed — the medicine,
> the batch, the patient, the doctor and the registration number — and it exports
> as a register. A drug inspector's visit becomes a download.

**On screen:** Briefly: the KYC queue, then the language switcher (English → हिन्दी →
मराठी).

> Drug licences are checked at onboarding, and watched after it — the platform
> warns a business before its licence expires and stops it trading if it lapses.
>
> And the whole product works in English, Hindi and Marathi, because the person at
> the counter is not always the person who owns the shop.

---

## 8 · The money (7:55 – 8:40)

**On screen:** `/app/ledger` → open one account → the statement.

> Trade here runs on credit, so the credit is built in. Every distributor
> relationship has its terms, its limit, and a running account. Payments settle
> the oldest invoice first, the way a khata actually works. Overdue reminders go
> out on their own.

**On screen:** `/app/shop/reports`, scrolling through.

> And the shop can finally see itself: sales, margin after purchase cost, what
> sells, what has not moved in ninety days and how much money is asleep in it,
> which customers came back, and the GST it collected — ready for filing.

---

## 9 · Close (8:40 – 9:15)

**On screen:** Back to the landing page, or you on camera.

> So — to put it simply.
>
> A shop's money dies in two places: on the shelf, and at the point of purchase.
> PharmaBharat watches both, because it treats the batch and its expiry date as
> the thing that matters, from the distributor's godown to the strip that is cut
> at the counter.
>
> What you have seen is built and working today: the marketplace, the shop system,
> the compliance, the accounts. [VERIFY — insert the honest current status: e.g.
> "We go into our first live shop this week."]
>
> Thank you for your time.

---

## Shot list (record in this order, not script order)

Screen capture is faster if you do it by screen, not by story. Cut to order later.

1. Landing page — slow scroll, and the language switch (§2, §7)
2. Catalogue: search → product page → cart → savings → checkout → orders (§3)
3. Shop billing: search → whole strip → **cut strip** → customer → bill → print (§4)
4. Shop alerts: expiry buckets → expired → low stock → **Order these** → quick order (§5, §6)
5. Shop reports: full scroll, pausing on margin and on "Lost to expiry" (§5, §8)
6. Admin: issue a recall, then the affected shop's notification (§7)
7. Register + KYC queue (§7)
8. Ledger: accounts → statement (§8)

---

## Things that will go wrong

- **An empty screen.** Seed first. See the blocker at the top.
- **A slow first load.** If it's on Vercel's free tier it sleeps; open every page
  once before you hit record.
- **The recall demo needs two accounts** — the admin issues it, the shop receives
  it. Have both signed in, in two browser profiles, before you start.
- **Don't narrate the mouse.** "Now I click here" is filler. Say what it means.
- **Silence is fine.** Let a screen breathe for a second after a point lands.
