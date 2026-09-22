# PharmaBharat — Software Requirements Specification (v1.0)

**Status:** Build in progress · **Build window:** 21 Sep – 6 Oct 2026 (15 days) · **Team:** 1 developer (+ Claude Code)

## 1. Product

PharmaBharat is a **B2B** marketplace that connects **Retailers (medical stores)**, **Wholesalers / Distributors** and **Pharma Companies**. It is a responsive website for phones, tablets and desktops. **B2C (selling to patients) is out of scope.**

### 1.1 Constraints
| Constraint | Decision |
|---|---|
| Budget | Free tiers only. No SMS/OTP, no WhatsApp, no paid APIs. |
| Login | Google sign-in only (better-auth). |
| Stack | Next.js 16 (App Router) · MongoDB Atlas M0 · Cloudinary · Vercel/Render. |
| Languages | English, Hindi and Marathi for all interface text. Medicine names stay in English. |
| Email | Gmail SMTP via Nodemailer now; move to Brevo or Resend when there's a domain. |
| Realtime | `realtime/` Socket.io broadcaster on Render free tier (sleeps when idle; clients fall back to polling). |

### 1.2 Hosting note
Vercel's free **Hobby plan is for non-commercial use only**. For a paying client, either run everything on Render, or have the client move to Vercel Pro before launch.

## 2. Users & roles

### 2.1 Platform roles (per user account)
| Role | Access |
|---|---|
| `user` | Default. Acts through the businesses they belong to. |
| `support` | Customer-care desk; can read KYC documents. |
| `admin` | Everything: KYC approval, moderation, banners, disputes. Set via `ADMIN_EMAILS`. |

### 2.2 Business types
| Type | Can do |
|---|---|
| Retailer | Search, compare margins, cart and order, chat, price alerts. |
| Wholesaler | Listings, stock, CSV import, fulfil orders, chat, analytics. |
| Pharma company | Official product listings and profile (v1). Promotions and demand analytics come later. Companies don't sell directly; they reach retailers through wholesalers. |

### 2.3 Business roles (per membership)
One Google account can belong to **several businesses**, with a different role in each. The active business is chosen with the business switcher.

| Role | Permissions |
|---|---|
| owner | Everything, including `team.manage` and `business.edit`. |
| manager | Everything except team management and profile/KYC editing. |
| inventory | `inventory.manage`, `orders.manage`, `chat.use` |
| billing | `orders.place`, `billing.view`, `chat.use` |
| viewer | `analytics.view` |

Staff join only through an **emailed invitation**. The invite link is single-use and expires after 7 days. The staff member must sign in with the Google account for the invited address, which is how the role assignment is authenticated.

## 3. Functional requirements

Status: ✅ done · 🚧 in progress · ⏳ planned (v1) · 🔜 after launch (v2)

### 3.1 Onboarding & KYC ✅
- FR-1 Sign in with Google. Unauthenticated access to `/app`, `/onboarding`, `/admin` and `/invite` redirects to sign-in.
- FR-2 Create a business: pick a type and enter the legal name. The creator becomes owner.
- FR-3 Business profile: GSTIN (with checksum validation), PAN (must match the GSTIN), mobile, email, address (the state must match the GSTIN state code), up to 4 drug licences (form, number, valid-till date; forms restricted by business type), pharmacist (retailers only), and FSSAI (optional).
- FR-4 Document upload directly to Cloudinary as **authenticated (private)** assets: PDF/JPG/PNG/WebP, 5 MB maximum. Required documents per type:
  - Retailer: GST certificate, drug licence, PAN, pharmacist certificate
  - Wholesaler: GST certificate, drug licence, PAN
  - Company: GST certificate, manufacturing licence, PAN
- FR-5 Submit for review only when the profile is valid and all required documents are present. Details lock while under review.
- FR-6 Admin queue with filters by status. The review screen shows details, documents (10-minute signed links), members, and a link to the GST portal. Decisions: approve, request changes (note required), suspend (note required), reinstate. The owner is emailed on approval or rejection.
- FR-7 Only **approved** businesses can use `/app`. Suspended businesses lose access.

### 3.2 Team ✅
- FR-8 Owner invites by email and role; can revoke pending invites, change roles, and disable or enable members. The owner's own role can't be changed.

### 3.3 Catalog & search ✅
- FR-9 **Medicine master**: 246,064 active products imported by `npm run import:medicines`. Each has brand, manufacturer, salts with strengths, dosage form, pack and MRP.
  > ⚠️ **Licensing:** the source is [junioralive/Indian-Medicine-Dataset](https://github.com/junioralive/Indian-Medicine-Dataset). It's labelled MIT, but appears to be derived from the Kaggle "A-Z Medicine Dataset of India", which is **CC BY-NC-SA 4.0 (non-commercial)**. Use it for development and the demo only. Before a commercial launch, license data or rely on seller- and company-created products. Only factual columns are imported, never descriptive text.
- FR-10 **Condition tags**: 20 conditions with names in English, Hindi and Marathi, mapped to salts in `src/lib/catalog/conditions-seed.ts`. The table was written for this project; admins will edit it. Products are tagged from their salts, and sellers can add tags per listing.
- FR-11 **Seller listing** = product + batch, mfg/expiry, MRP, selling price (per pack, excluding GST, ≤ MRP), GST rate (default 5% under GST 2.0), HSN, stock, MOQ, storage condition, drug schedule. Unique per seller + product + batch.
- FR-12 Stock is managed by manual form, inline stock edit, or CSV import (up to 2,000 rows; upserts by product + batch; template at `/templates/listings-template.csv`). If a product is missing, a seller can add it to the master. Tally/Marg sync is 🔜.
- FR-13 Search uses Atlas Search (free tier): fuzzy autocomplete on brand and salt, plus manufacturer, filterable by condition. Substitutes are products with the same `compositionKey` (salts + strengths), cheapest seller first.
- FR-14 Margin % = (MRP − price) / MRP. The catalog shows the best price, best margin and number of sellers. Only listings that are active, in stock and more than 30 days from expiry are shown to buyers.
- Only **wholesalers** with `inventory.manage` can list stock. Retailers and companies browse.
- Dev helper: `npm run seed:demo` creates two `[DEMO]` distributors (MH and GJ) with sample listings; `--remove` deletes them.

### 3.4 Cart, orders & GST ✅
- FR-15 The cart is stored per (buyer business, user), so staff don't overwrite each other's carts. Checkout **splits it into one order per seller**, and all the resulting orders share a `groupId`. Retailers and wholesalers can buy; pharma companies can't, and nobody can buy their own stock.
- FR-16 GST is calculated per line on the taxable value (price excluding GST × qty), rounded to paise. Same state → CGST + SGST (half each; the split always adds back to the full GST). Different states → IGST. The order total is rounded to the rupee, with a separate round-off line. Pure functions live in `src/lib/orders/gst.ts`, with unit tests.
- FR-17 Checkout runs in **one MongoDB transaction**. Each line's stock is decremented only if `stock ≥ qty`, so if any line fails, nothing is written and the cart is kept. Rejecting or cancelling an order returns its stock.
- FR-18 Order status: Placed → Accepted → (Packed) → Dispatched → Delivered, or Rejected (seller, note required) / Cancelled (buyer, before dispatch). Each change is a conditional update, so two people clicking at once can't both apply it. Every change is logged in the order's history and triggers an email.
- FR-19 Payment is Credit or Cash on delivery; there's no gateway. The seller marks the order paid once it's dispatched or delivered.
- FR-20 On acceptance the order gets an invoice number `INV/<FY>/<seq>`, sequential per seller per financial year. The **GST tax invoice PDF** is generated when requested at `/api/orders/[id]/invoice`, with HSN summary, amount in words, place of supply, batch and expiry. Buyer and seller details are frozen at order time. Status emails include a "Download invoice" link.
- Integration tests (`npm run test:integration`, using a throwaway `pharmabharat_test` database) cover: split orders, CGST/SGST vs IGST, stock reservation, full rollback when stock runs out, own-listing block, invoice numbering, and stock release on reject.

### 3.5 Alerts & notifications ✅
- FR-21 **Price alerts** per user and product: drop, rise or either way; optional minimum % change; email on/off (in-app is always on). The best price is re-checked whenever it can change: listing save/edit, pause/resume, stock edit, delete, CSV import, checkout, reject/cancel. Checks run after the response (`after()`), so they never slow down the action. Each move is reported once: the reference price moves to the price that triggered the alert. Rules live in `src/lib/alerts/rules.ts`, with unit tests.
- FR-22 **Near-expiry alerts** for sellers at 90, 60 and 30 days: a daily in-app notification plus one email digest per seller. Idempotent, because each listing stores the last level sent, and correcting an expiry date resets it. Triggered by `GET /api/cron/daily` with `Authorization: Bearer $CRON_SECRET`: Vercel Cron (`vercel.json`, 09:00 IST) or cron-job.org when hosted on Render.
- **Notification centre** (`/app/notifications`) for price alerts, near-expiry, new orders (sellers), order status changes (buyers; cancellations go to sellers) and KYC decisions. Notifications are stored as kind + values and rendered in the viewer's language. Unread count shows in the navigation. Old notifications are deleted automatically after 90 days to keep the free tier small.

### 3.6 Chat ✅
- FR-23 **Direct chat** between two verified businesses: exactly one thread per pair, started from "Chat" on a seller's offer or on an order. Text up to 2,000 characters, plus images (JPG/PNG/WebP, 5 MB, private Cloudinary files shown through signed URLs), a "Seen" marker, unread badges, and paging through older messages.
- FR-24 **Community rooms**: "All India" plus one room per state, open to verified businesses in scope. Community rules are shown in the room. Any message can be reported, and admins can hide reported messages (admin screen: Day 14).
- Architecture: the Next.js app stores messages in MongoDB (source of truth) and pushes them through `realtime/`, a **stateless Socket.io broadcaster** (Render free tier; `render.yaml`).
  - Browsers get a 10-minute HMAC token from `/api/realtime/token` that lists the only rooms they may join: their business, and their community rooms.
  - The app publishes with a shared secret.
  - When the socket is down (free tier asleep, network loss), the client polls every 15 s and catches up after reconnecting, so no messages are lost.
- Limits: 30 messages per minute per user; chat requires the `chat.use` permission.
- Tests: `realtime/` has node tests for token verification, room isolation and publish auth. `web/` checks token compatibility between the two implementations, and chat integration tests cover pair uniqueness, access rules and unread/read tracking.

### 3.7 Customer care ✅
- FR-25 **Support tickets** (`/app/support`):
  - Fields: category, priority, subject, optional order number. Tickets are numbered `TKT-000001`.
  - Threaded replies between the business and agents, with statuses Open → In progress → Waiting for you → Resolved → Closed.
  - Automatic status changes: a customer reply reopens a waiting or resolved ticket; the first agent reply moves an open ticket to In progress and assigns it to that agent.
  - Customers can close and reopen their own tickets.
  - Notifications: agents are emailed about new tickets and customer replies; the business gets an email plus an in-app notice for agent replies and status changes.
- **Call-back requests** are a ticket type that also stores phone, time slot (morning/afternoon/evening) and preferred language (en/hi/mr). They're highlighted in the desk queue.
- **FAQ** at `/help`: a public page with 10 questions in all three languages. Businesses still in verification, who can't use `/app` yet, can request a call back from there.
- **Live chat with support** reuses Day 12's chat as a third thread type, `support`: one thread per business, pinned in its chat list. Agents receive it through the `support` realtime room, and each side has its own unread count and "Seen".
- **Support desk** (`/support-desk`, platform roles `support` and `admin`):
  - Ticket queue with an Active/All filter, sorted by priority, then most recent activity.
  - Ticket view with reply, status and priority changes, and "assign to me".
  - Live-chat inbox, with unread highlighted.
- Phone navigation: the bottom bar has 4 sections plus **More** (`/app/more`), which lists everything else (Team, Alerts, Help, Support desk, Admin…). The navigation list lives in one place, `src/lib/nav.ts`.
- Integration tests cover ticket numbering, reply-driven status changes, customer close, in-app notices, and support-chat isolation and unread tracking on both sides.

### 3.8 Admin & analytics ✅
- FR-26 **Admin panel** (`/admin`, platform role `admin`), with tabs and pending counts on the tabs:
  - **Overview:** order value (GMV) and orders (30 days vs previous 30), daily GMV chart, verified businesses by type, pending KYC, reported messages, open tickets.
  - **Verification:** the existing KYC queue.
  - **Users:** search; change platform role (user / support agent / admin); ban/unban. A ban deletes the user's sessions, and admins can't change or ban themselves.
  - **Listings:** search by seller or product (Atlas Search). **Hold** pauses a listing with a reason the seller sees, and the seller can't resume it until an admin releases the hold.
  - **Reports:** reported chat messages → hide (shown as "removed by a moderator") or dismiss.
  - **Conditions:** edit names (en/hi/mr) and salts, add new tags. Saving re-tags every product that contains or no longer contains those salts.
  - **Banners:** title and text in three languages, optional link, audience (all / retailer / wholesaler / company), style, date window; turn on/off or delete. Shown on the app home page.
- FR-27 **Dashboards** on `/app`, shown to roles with `analytics.view`; roles without it get quick links:
  - **Wholesaler:** sales, orders, average order (30 days vs previous 30); daily sales chart; orders waiting at each status; stock health (live, low ≤10, out, expiring ≤90 days); top 5 products by sales.
  - **Retailer:** purchases (change shown in neutral grey), orders, **savings vs MRP** (₹ and %), open orders; daily purchases chart; top suppliers.
  - **Pharma company:** placeholder; demand analytics are after launch.
  - Cancelled and rejected orders never count. Days are bucketed in IST.
- Charts follow the dataviz guidance:
  - one brand hue, validated for contrast on the surface (passes);
  - columns at most 24px wide with 2px gaps and 4px rounded tops;
  - three date labels, not one per column;
  - hover/focus tooltips, plus a "View as table" fallback;
  - changes marked with an arrow and text, not colour alone;
  - fluid width, checked at 375px wide.
- Tests: `tests/integration/analytics.test.ts` checks every dashboard figure against real orders placed through checkout, including cancelled-order exclusion and savings.

### 3.9 After launch 🔜
Plus membership and Razorpay · commission model · pharma company promotions and regional demand analytics · Tally/Marg integration · returns and disputes workflow · delivery tracking · installable PWA with offline support · prescription records (DPDP-compliant) · retailer-side inventory.

## 4. Non-functional requirements
- **Responsive:** 360 px phones through desktop. Bottom tab bar under 1024 px, sidebar above.
- **Security:** every mutation re-checks session, business membership and permission on the server. The proxy does only an optimistic cookie check. KYC files are never public. Invite tokens are stored hashed.
- **Performance on the free tier:** at most 5 connections per pool; session cookie cache (5 min) avoids a database hit on every request.
- **i18n:** every UI string comes from `messages/{en,hi,mr}.json`. A test fails if the key sets differ.
- **Quality gates:** `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` must pass before each commit.

## 5. Data model (MongoDB)
| Collection | Owner | Notes |
|---|---|---|
| `user`, `session`, `account`, `verification` | better-auth | `user.platformRole`, `user.banned` |
| `businesses` | app | type, profile, licences, documents[], kyc{status, remarks, reviewedBy…} |
| `memberships` | app | (businessId, userId) unique, role, status |
| `invitations` | app | tokenHash (sha256), role, expiresAt, status |
| `products` | app | medicine master; Atlas Search index `products_search` |
| `listings` | app | seller × product × batch, price, stock |
| `orders` | app | one per seller; frozen line items + parties; GST totals; status history; invoice no. |
| `carts`, `counters` | app | cart per (business, user); atomic sequences for order/invoice numbers |
| `conditions` | app | condition tags (en/hi/mr) → salts |
| `banners` | app | home-page announcements by audience + date window |
| `pricealerts`, `notifications` | app | per-user price subscriptions; in-app notifications (TTL 90 days) |
| `conversations`, `messages` | app | direct (pairKey) + community (slug) threads; read markers; message reports |
| `tickets` | app | tickets + call-backs with embedded replies; `TKT-` numbers from `counters` |
