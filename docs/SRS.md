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
| Realtime | Socket.io service on Render (free tier; sleeps when idle). |

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

### 3.3 Catalog & search ⏳ (Days 5–7)
- FR-9 **Medicine master** seeded from a public Indian dataset (licence to be checked): brand, manufacturer, composition/salts, pack size, dosage form, Rx/OTC schedule.
- FR-10 **Condition tags**: a list managed by admins (Diabetes, Hypertension…). Sellers choose tags from the list, not free text.
- FR-11 **Seller listing** = master product + seller-specific fields: batch no., mfg/expiry date, MRP, selling price (PTR), GST rate, HSN code, stock quantity, minimum order quantity, storage conditions (room temperature, 2–8 °C cold chain, protect from light), and compliance (Schedule H/H1/X, narcotic flag).
- FR-12 Stock can be updated manually or by CSV upload. Tally/Marg sync is 🔜.
- FR-13 Search by brand, salt/composition, manufacturer and condition, tolerant of typos (Atlas Search fuzzy). "Substitutes" means the same salt combination and strength.
- FR-14 **Margin comparison**: reference price = MRP on the pack. Margin % = (MRP − seller price) / MRP. Show lowest and average price across sellers for the same product.

### 3.4 Cart, orders & GST ⏳ (Days 8–10)
- FR-15 One cart holds items from many sellers and is **split into one order per seller** at checkout.
- FR-16 GST: if seller state = buyer state, charge CGST + SGST at half the rate each; otherwise IGST. Totals are HSN-wise.
- FR-17 Placing an order reserves stock (atomic decrement). Cancelling before dispatch releases it.
- FR-18 Order status: Placed → Accepted → Packed → Dispatched → Delivered (plus Rejected/Cancelled). Email and in-app notice on each change.
- FR-19 Payment: **no gateway in v1**. Orders are "Pay on delivery / credit"; the seller marks the invoice paid.
- FR-20 GST tax invoice is generated as a PDF on demand. The email template has a "Download invoice" button.

### 3.5 Alerts ⏳ (Day 11)
- FR-21 Subscribe to price changes per product (drop and/or rise, optional % threshold). Delivered in-app and by email.
- FR-22 Near-expiry alerts for sellers' stock (90/60/30 days).

### 3.6 Chat ⏳ (Day 12)
- FR-23 Real-time one-to-one chat between two businesses, with image sharing (Cloudinary).
- FR-24 Community rooms (e.g. by city), with report/mute moderation.

### 3.7 Customer care ⏳ (Day 13)
- FR-25 Support tickets (category, priority, status, threaded replies), an FAQ page, call-back requests, and live chat with support agents (reuses the chat service).

### 3.8 Admin & analytics ⏳ (Day 14)
- FR-26 Admin: users and businesses (suspend), listing moderation, condition tags, banners, dispute notes.
- FR-27 Dashboards: sales trend, top products, order counts, near-expiry stock (wholesaler); spend and savings (retailer).

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
| `products` ⏳ | app | medicine master + text-search index |
| `listings` ⏳ | app | seller × product × batch, price, stock |
| `orders` ⏳ | app | one per seller, line items snapshot, GST breakdown |
| `alerts`, `notifications`, `conversations`, `messages`, `tickets` ⏳ | app | |
