# -*- coding: utf-8 -*-
"""Builds docs/PharmaBharat-Features.pdf — the complete feature list, with a
diagonal watermark drawn behind every page."""

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

OUT = "docs/PharmaBharat-Features.pdf"

BRAND = colors.HexColor("#0d8467")
INK = colors.HexColor("#0f1f1b")
MUTED = colors.HexColor("#5b6b66")
LINE = colors.HexColor("#e3e8e6")
WATERMARK = colors.HexColor("#0d8467")

PAGE_W, PAGE_H = A4
MARGIN = 18 * mm


# ---------------------------------------------------------------- page canvas
def decorate(canvas, doc):
    """Watermark first (so it sits behind), then the running header and footer."""
    canvas.saveState()

    # Diagonal watermark, tiled faintly behind the content. The horizontal step
    # is measured from the text itself, or the words run into each other.
    word = "PHARMABHARAT"
    size = 26
    canvas.setFont("Helvetica-Bold", size)
    canvas.setFillColor(WATERMARK, alpha=0.05)
    canvas.rotate(45)
    step_x = canvas.stringWidth(word, "Helvetica-Bold", size) + 90
    step_y = 150
    # The rotated axes reach past the page corners, so over-draw the range.
    y = -int(PAGE_W)
    while y < int(PAGE_H * 1.6):
        # Offset alternate rows so the tiling does not read as columns.
        offset = 0 if (round((y + PAGE_W) / step_y) % 2 == 0) else step_x / 2
        x = -int(PAGE_H * 0.5) + offset
        while x < int(PAGE_W * 1.8):
            canvas.drawString(x, y, word)
            x += step_x
        y += step_y
    canvas.restoreState()

    # Header rule and wordmark (not on the cover).
    canvas.saveState()
    if doc.page > 1:
        canvas.setFont("Helvetica-Bold", 8.5)
        canvas.setFillColor(BRAND)
        canvas.drawString(MARGIN, PAGE_H - 13 * mm, "PHARMABHARAT")
        canvas.setFont("Helvetica", 8.5)
        canvas.setFillColor(MUTED)
        canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - 13 * mm, "Product features")
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.6)
        canvas.line(MARGIN, PAGE_H - 15.5 * mm, PAGE_W - MARGIN, PAGE_H - 15.5 * mm)

    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(MARGIN, 11 * mm, "Confidential — prepared for the client and their advisers")
    canvas.drawRightString(PAGE_W - MARGIN, 11 * mm, str(doc.page))
    canvas.restoreState()


# ---------------------------------------------------------------- styles
ss = getSampleStyleSheet()

S = {
    "cover_title": ParagraphStyle(
        "cover_title", parent=ss["Title"], fontName="Helvetica-Bold",
        fontSize=34, leading=38, textColor=BRAND, alignment=TA_CENTER, spaceAfter=6,
    ),
    "cover_sub": ParagraphStyle(
        "cover_sub", parent=ss["Normal"], fontName="Helvetica", fontSize=13,
        leading=19, textColor=INK, alignment=TA_CENTER,
    ),
    "cover_meta": ParagraphStyle(
        "cover_meta", parent=ss["Normal"], fontName="Helvetica", fontSize=9.5,
        leading=15, textColor=MUTED, alignment=TA_CENTER,
    ),
    "h1": ParagraphStyle(
        "h1", parent=ss["Heading1"], fontName="Helvetica-Bold", fontSize=15,
        leading=19, textColor=BRAND, spaceBefore=14, spaceAfter=2,
    ),
    "h1sub": ParagraphStyle(
        "h1sub", parent=ss["Normal"], fontName="Helvetica-Oblique", fontSize=9.5,
        leading=13, textColor=MUTED, spaceAfter=8,
    ),
    "h2": ParagraphStyle(
        "h2", parent=ss["Heading2"], fontName="Helvetica-Bold", fontSize=10.5,
        leading=14, textColor=INK, spaceBefore=9, spaceAfter=3,
    ),
    "body": ParagraphStyle(
        "body", parent=ss["Normal"], fontName="Helvetica", fontSize=9.5,
        leading=14, textColor=INK, spaceAfter=4,
    ),
    "muted": ParagraphStyle(
        "muted", parent=ss["Normal"], fontName="Helvetica", fontSize=9,
        leading=13, textColor=MUTED, spaceAfter=4,
    ),
    "bullet": ParagraphStyle(
        "bullet", parent=ss["Normal"], fontName="Helvetica", fontSize=9.5,
        leading=13.5, textColor=INK, leftIndent=10, bulletIndent=1, spaceAfter=2.5,
    ),
}


def bullets(items):
    return [Paragraph(t, S["bullet"], bulletText="•") for t in items]


def section(title, strap, blocks):
    """A feature area: heading, one-line rationale, then its content."""
    out = [Paragraph(title, S["h1"]), Paragraph(strap, S["h1sub"])]
    out.extend(blocks)
    return out


def factbox(rows):
    t = Table(rows, colWidths=[38 * mm, PAGE_W - 2 * MARGIN - 38 * mm])
    t.setStyle(
        TableStyle([
            ("FONT", (0, 0), (0, -1), "Helvetica-Bold", 9),
            ("FONT", (1, 0), (1, -1), "Helvetica", 9),
            ("TEXTCOLOR", (0, 0), (0, -1), BRAND),
            ("TEXTCOLOR", (1, 0), (1, -1), INK),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINE),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ])
    )
    return t


story = []

# ---------------------------------------------------------------- cover
story += [
    Spacer(1, 52 * mm),
    Paragraph("PharmaBharat", S["cover_title"]),
    Paragraph("A B2B pharma marketplace, and a complete system for the medical shop", S["cover_sub"]),
    Spacer(1, 10 * mm),
    Paragraph(
        "Every medicine is tracked as a <b>batch with an expiry date</b> — from the "
        "distributor's godown, through the order, onto the shop's shelf, to the strip "
        "that is cut at the counter. Everything in this document follows from that.",
        ParagraphStyle("lead", parent=S["cover_sub"], fontSize=10.5, leading=16, textColor=MUTED),
    ),
    Spacer(1, 26 * mm),
    Paragraph("Complete feature list", S["cover_meta"]),
    Paragraph("September 2026", S["cover_meta"]),
    Spacer(1, 4 * mm),
    Paragraph("Confidential", S["cover_meta"]),
    PageBreak(),
]

# ---------------------------------------------------------------- at a glance
story += section(
    "At a glance",
    "What the platform is, in one page.",
    [
        factbox([
            ["Who it serves", "Medical stores (retailers), wholesalers and distributors, and pharma companies."],
            ["Marketplace", "Verified businesses only. Search, compare margins, order, GST invoices, credit terms."],
            ["Shop system", "For the retailer: own stock, billing counter, customers, refills, compliance register, reports."],
            ["Central idea", "The batch and its expiry date are the unit of record everywhere."],
            ["Languages", "English, Hindi and Marathi across the entire interface."],
            ["Devices", "Responsive — phone, tablet and desktop. Bottom navigation on phones, sidebar on desktop."],
            ["Sign-in", "Google sign-in only. Several staff logins per business, each with its own role."],
            ["Catalogue", "246,064 medicines with brand, manufacturer, salts, strengths, pack size and MRP."],
        ]),
        Spacer(1, 4 * mm),
        Paragraph("How the expiry problem is actually solved", S["h2"]),
        Paragraph(
            "Not one feature — four, at every point the medicine is touched:",
            S["muted"],
        ),
        *bullets([
            "<b>Captured</b> — batch number and expiry are recorded when a distributor lists stock, and travel with the order onto the shop's shelf.",
            "<b>Watched</b> — automatic warnings at 90, 60 and 30 days, on both the distributor's and the shop's side, each batch warned once per level.",
            "<b>Respected</b> — the billing counter offers the batch expiring first, so old stock leaves before new; stock with under a month of life is kept off the counter entirely.",
            "<b>Counted</b> — the shop sees the money at risk in each expiry bucket, and what it actually lost to expiry last month, at purchase cost.",
        ]),
        Paragraph(
            "Redistribution follows from the same data: near-expiry stock is visible on the "
            "marketplace with its date shown honestly, so it can move to a shop that will sell "
            "it in time rather than die in a godown.",
            S["body"],
        ),
    ],
)

story.append(PageBreak())

# ---------------------------------------------------------------- marketplace
story += section(
    "1 · Marketplace — buying and selling",
    "The shop buys better, and knows what it is buying.",
    [
        Paragraph("Catalogue and search", S["h2"]),
        *bullets([
            "246,064 medicines, searchable by brand, by salt, or by the condition treated. Fuzzy matching and type-ahead suggestions.",
            "Substitutes: same salts and strengths, different brand or pack, cheapest first — the basis of generic substitution.",
            "Every offer shows MRP, the distributor's price, the resulting margin, <b>and the expiry date of the batch that would ship</b>.",
            "Photographs of the actual batch box, uploaded by the seller. The purchase invoice they upload is never shown to buyers.",
            "Only verified, unsuspended sellers appear in prices and counts.",
        ]),
        Paragraph("Cart, cheapest combination and checkout", S["h2"]),
        *bullets([
            "Cheapest-combination cart: every line is compared against other verified sellers who can actually fulfil it, showing the saving and how many deliveries the order would arrive in. One click switches the whole cart.",
            "Ties go to a seller already in the cart, so an order does not fragment into extra deliveries for nothing.",
            "One cart splits automatically into one order per distributor, since each invoices separately.",
            "Stock is reserved atomically at checkout — an order can never exist for stock that was not there.",
            "Quick order: paste a purchase list in the shape a chemist already writes it (CSV, tab-separated, \"Dolo 650 x 10\", serial numbers) and it is matched to the catalogue and priced.",
            "\"Buy again\" repeats a past order at today's best prices.",
        ]),
        Paragraph("Orders, GST and invoices", S["h2"]),
        *bullets([
            "Full order lifecycle: placed, accepted, packed, dispatched, delivered — with rejection and cancellation, and stock returned when an order falls through.",
            "CGST and SGST within a state, IGST across a state line, HSN codes per line, round-off, and the amount in words.",
            "Invoice numbers run per seller per financial year. The GST invoice is generated as a PDF and emailed.",
            "Line items are frozen copies — an invoice stays true even if the listing changes later.",
        ]),
        Paragraph("Selling side", S["h2"]),
        *bullets([
            "Listings per batch: price, stock, MRP, GST rate, HSN, storage, drug schedule, minimum order quantity.",
            "CSV import for bulk listing, with case-insensitive medicine name matching.",
            "Sellers can create products that are not in the master catalogue.",
            "Near-expiry digest emails at 90 / 60 / 30 days, so stock is flagged while it is still worth something.",
        ]),
    ],
)

story.append(PageBreak())

# ---------------------------------------------------------------- shop module
story += section(
    "2 · The shop — a complete system for the medical store",
    "The retailer is the busiest user in this chain, so the retailer gets a full shop system.",
    [
        Paragraph("Shop stock", S["h2"]),
        *bullets([
            "The shop's own shelf: batches with purchase cost, MRP, expiry, supplier and drug schedule.",
            "Marking a purchase order delivered puts its batches straight onto the shelf at what was actually paid. Receiving the same order twice changes nothing.",
            "Manual entry and catalogue search for stock bought outside the platform.",
            "Shelf valued both at purchase cost and at MRP; filters for expiring, expired and out of stock.",
            "<b>Stock is held in tablets, not strips.</b> Each batch knows how many units are in a pack, so a cut strip is tracked exactly: 176 units of a strip of 15 reads as \"11 strips + 11 loose\".",
        ]),
        Paragraph("Billing counter", S["h2"]),
        *bullets([
            "Type-ahead over the shop's own stock, with batches offered <b>first-expiry-first</b>.",
            "Stock with less than a month of shelf life is never offered at the counter.",
            "<b>Sell whole strips or loose tablets on the same bill</b> — no modes. A tablet is priced from the strip's MRP, with the paise rounded up by default (the shop can choose exact).",
            "MRP is treated as GST-inclusive and the tax is worked backwards out of it, as a retail bill requires.",
            "Per-line discounts; cash, UPI or card.",
            "The bill and the stock decrement happen in one transaction, so a bill can never exist for medicine that was not on the shelf; a partly fulfillable bill changes nothing.",
            "Bill numbers run per shop per financial year. Printable receipt with the shop's licence, batch, expiry, HSN, tax split and amount in words.",
            "Prescriber fields appear automatically when a scheduled medicine is billed.",
        ]),
        Paragraph("Customers", S["h2"]),
        *bullets([
            "The shop's own customer book — patients never sign in.",
            "Search and filters: on long-term medicines, agreed to reminders, lapsed.",
            "Profile with spend, visits, every bill, and <b>what they buy regularly</b>, including the typical gap between purchases.",
            "Long-term conditions (diabetes, blood pressure, thyroid and others) recorded for care and for refills.",
            "Loyalty points: earn rate, point value, minimum redemption and expiry all set by the shop. Points are redeemed at the counter and lapse oldest-first.",
        ]),
    ],
)

story.append(PageBreak())

# ---------------------------------------------------------------- expiry etc
story += section(
    "3 · Expiry, stock and demand",
    "Money that dies on the shelf, and money that is never made because the shelf was empty.",
    [
        Paragraph("Expiry management", S["h2"]),
        *bullets([
            "Expiring stock in three buckets — 90, 60 and 30 days — plus what has already expired.",
            "The money at risk in each bucket, at purchase cost. Not \"twelve batches\" but twelve batches worth a specific amount.",
            "Automatic warnings at each level, once per batch, so the alerts never become noise.",
            "The counter enforces first-expiry-first dispensing on every sale.",
            "Value lost to expiry is reported monthly, so it can be managed rather than absorbed.",
        ]),
        Paragraph("Low stock and reordering", S["h2"]),
        *bullets([
            "Reorder levels are computed nightly from how fast each medicine actually sells in that shop (a 90-day window, covering 15 days by default).",
            "The shop can override the level for any medicine, and a hand-set level is never overwritten.",
            "\"Running low\" shows days of cover left and a suggested order size.",
            "One click turns the low-stock list into a marketplace order at the best available prices.",
        ]),
        Paragraph("Refill reminders and restocking", S["h2"]),
        *bullets([
            "Customers due for a repeat medicine are worked out from the gaps between their own purchases — nothing extra is typed at the counter.",
            "Those who agreed get an email, once per cycle; everyone else lands on a call-list with their number and a \"called\" tick.",
            "A repeat medicine that is not on the shelf is flagged, and feeds the same one-click reorder — so a regular customer is not turned away.",
        ]),
        Paragraph("Redistribution", S["h2"]),
        *bullets([
            "Near-expiry stock stays visible and buyable on the marketplace with its expiry date shown, so it can reach a shop that turns it over quickly.",
            "The cheapest-combination cart and the quick order make that stock easy to find and buy.",
            "Batch-level data across the whole chain is what makes redistribution possible; a dedicated clearance channel for near-expiry stock is a small addition on top of it.",
        ]),
    ],
)

story.append(PageBreak())

# ---------------------------------------------------------------- compliance
story += section(
    "4 · Trust, compliance and safety",
    "A pharma marketplace is only as good as the businesses on it.",
    [
        Paragraph("Verification", S["h2"]),
        *bullets([
            "Detailed KYC: GSTIN with checksum validation, PAN, drug licences with their validity dates, pharmacist registration, FSSAI where relevant.",
            "Documents are uploaded to private storage and are never publicly reachable; administrators view them through signed, expiring links.",
            "Three-step onboarding with a progress bar; an administrator approves or returns the application with remarks.",
            "<b>Drug licence expiry is enforced.</b> Warnings at 60, 30 and 7 days, and the business is suspended the day the licence lapses. Renewing resets it.",
        ]),
        Paragraph("Batch recall", S["h2"]),
        *bullets([
            "An administrator issues a recall or advisory for a batch.",
            "Every matching listing across the platform is frozen — the seller cannot resume it.",
            "The distributors holding that batch and every shop that already bought it are told, in-app and by email.",
            "Affected orders show a banner. Withdrawing a recall releases the hold.",
        ]),
        Paragraph("Dispensing records", S["h2"]),
        *bullets([
            "Schedule H and H1 medicines are recorded as dispensed: medicine, batch, quantity, patient, doctor and registration number.",
            "Filterable by month and schedule, exportable as CSV — an inspection becomes a download.",
            "Sales where the prescriber was never recorded are listed so the gap can be closed.",
        ]),
        Paragraph("Personal data (DPDP)", S["h2"]),
        *bullets([
            "Consent is captured and dated when a customer is added, with a separate tick for reminders.",
            "Deleting a customer erases their personal details here <b>and on old bills</b>, while the bills themselves survive as accounting records.",
            "Customers who stop coming have their contact details purged automatically after a retention window the shop sets.",
        ]),
    ],
)

story.append(PageBreak())

# ---------------------------------------------------------------- money + rest
story += section(
    "5 · Money, insight and communication",
    "What the business is actually making, and who owes what.",
    [
        Paragraph("Credit ledger (khata)", S["h2"]),
        *bullets([
            "A running account per buyer–seller pair, with the credit limit and credit days the distributor gives.",
            "Terms are frozen onto the invoice when an order is accepted, which sets its due date.",
            "Receipts (cash, UPI, bank, cheque, adjustment) settle the oldest invoice first; anything extra stays on account.",
            "Statement with a running balance; receivable and payable views.",
            "Checkout refuses a credit order that would cross the limit. Overdue reminders are emailed weekly.",
        ]),
        Paragraph("Shop reports", S["h2"]),
        *bullets([
            "Sales, margin after purchase cost, bills and average bill — over 30, 90 or 365 days against the period before.",
            "Best sellers by value and the most profitable lines by money kept.",
            "Dead stock: in date, on the shelf, unsold for 90 days — and the money asleep in it.",
            "Customer retention: new, returning and lapsed, and the top customers by spend.",
            "Value lost to expiry, and output GST by rate ready for the monthly filing.",
        ]),
        Paragraph("Supplier comparison", S["h2"]),
        *bullets([
            "Spend per supplier, order count and last order.",
            "The credit terms each gives, what is outstanding and what is overdue.",
            "Quality record: batches they supplied that were later recalled, and deliveries that arrived with under six months of life.",
            "Price history per medicine — what each supplier charged, the lowest they ever charged, and the best price on the marketplace today.",
        ]),
        Paragraph("Dashboards for distributors and companies", S["h2"]),
        *bullets([
            "Wholesaler: sales, orders, average order value, daily sales, orders waiting at each status, stock health, top products.",
            "Retailer: purchases, orders, savings against MRP, open orders, daily purchases and top suppliers.",
        ]),
        Paragraph("Communication and support", S["h2"]),
        *bullets([
            "Real-time chat between businesses, with images, plus community threads; falls back to polling automatically.",
            "Price-drop and price-rise alerts on medicines a buyer follows.",
            "In-app notifications and templated emails throughout.",
            "Support desk with tickets, call-backs, live chat and an FAQ, and a staff-side queue.",
        ]),
        Paragraph("Administration", S["h2"]),
        *bullets([
            "KYC queue, user management with platform roles and bans, listing moderation with holds, reported-message moderation.",
            "Condition tags in three languages, home-page banners by audience, and platform-wide analytics.",
        ]),
    ],
)

story.append(PageBreak())

# ---------------------------------------------------------------- status
story += section(
    "6 · Status and honest notes",
    "What is built, and what a reader should know before relying on it.",
    [
        Paragraph(
            "Everything described in this document is built and working, covered by an automated "
            "test suite (197 tests at the time of writing, including transaction, GST, expiry, "
            "loyalty and compliance behaviour), and it builds clean.",
            S["body"],
        ),
        Spacer(1, 3 * mm),
        factbox([
            ["Stage", "Feature-complete and tested. Not yet in daily use in a live shop; first shop trial pending."],
            ["Stack", "Next.js on Vercel, MongoDB Atlas, Cloudinary, a separate real-time service. Built to run on free tiers."],
            ["Hosting", "The current deployment is on a non-commercial plan. A paid plan or a move to Render is required before commercial use."],
            ["Catalogue data", "The 246,064-medicine master is from a public dataset whose licence appears to be non-commercial. It is suitable for development and demonstration; commercial launch needs a licensed source or seller-created products."],
            ["Not included", "Customer credit (udhaar) at the counter, sales returns and refunds, prescription photographs, and B2C sales to patients."],
            ["Languages", "Hindi and Marathi translations are complete but have not yet been reviewed by a native speaker."],
        ]),
        Spacer(1, 5 * mm),
        Paragraph(
            "This document is confidential and prepared for the client and their advisers.",
            S["muted"],
        ),
    ],
)


doc = BaseDocTemplate(
    OUT,
    pagesize=A4,
    leftMargin=MARGIN,
    rightMargin=MARGIN,
    topMargin=21 * mm,
    bottomMargin=17 * mm,
    title="PharmaBharat — Product Features",
    author="PharmaBharat",
    subject="Complete feature list",
)
frame = Frame(MARGIN, 17 * mm, PAGE_W - 2 * MARGIN, PAGE_H - 21 * mm - 17 * mm, id="body")
doc.addPageTemplates([PageTemplate(id="all", frames=[frame], onPage=decorate)])
doc.build(story)
print("wrote", OUT)
