# -*- coding: utf-8 -*-
"""PharmaBharat conference poster — 2:3 portrait (24in x 36in), RIT Quantum 2k26 template."""
import os
from reportlab.lib.colors import Color, HexColor, white, black
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.platypus import Frame, Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

DEVA = "Times-Roman"
try:
    pdfmetrics.registerFont(TTFont("Deva", r"C:/Windows/Fonts/mangal.ttf"))
    DEVA = "Deva"
except Exception as e:
    print("devanagari font unavailable:", e)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, os.pardir, "PharmaBharat-Poster-2x3.pdf")
LOGO = os.path.join(HERE, "poster-assets", "rit_logo.png")
DIAG = os.path.join(HERE, "poster-assets", "arch_diagram.png")

# ---------------------------------------------------------------- template
W, H = 1728.0, 2592.0          # 24in x 36in at 72dpi -> exactly 2:3
M = 36.0
CW = W - 2 * M                 # 1656
GAP = 24.0
COL2 = (CW - GAP) / 2.0        # 816

YELLOW = HexColor("#FCC426")
BAND = HexColor("#376092")
BAND2 = HexColor("#558ED5")
ACCENT = HexColor("#0070C0")
PALE = HexColor("#EBF1DE")
TEAL = HexColor("#0F766E")
INK = HexColor("#101828")
MUTE = HexColor("#475569")

BAND_H = 44.0

c = pdfcanvas.Canvas(OUT, pagesize=(W, H))
c.setTitle("PharmaBharat - B2B Pharmaceutical Supply, Redistribution and Retail Intelligence Platform")


def Y(top):
    """Convert a top-down y to reportlab's bottom-up y."""
    return H - top


def body(size=15, leading=19.5, align=TA_JUSTIFY, color=INK, font="Times-Roman", space=5):
    return ParagraphStyle("b", fontName=font, fontSize=size, leading=leading,
                          alignment=align, textColor=color, spaceAfter=space)


def band(x, top, w, text, h=BAND_H, fill=BAND, size=23):
    c.setFillColor(fill)
    c.rect(x, Y(top + h), w, h, stroke=0, fill=1)
    c.setFillColor(white)
    c.setFont("Times-Bold", size)
    c.drawCentredString(x + w / 2.0, Y(top + h) + (h - size) / 2.0 + 3, text)


def panel(x, top, w, h, border=1.4):
    c.setStrokeColor(black)
    c.setLineWidth(border)
    c.setFillColor(white)
    c.rect(x, Y(top + h), w, h, stroke=1, fill=1)


def section(x, top, w, h, title, flowables, pad=12, band_fill=BAND, text_h=None):
    """Blue caption band + bordered white body, text flowed inside.

    text_h shortens only the text frame, leaving the panel its full height, so a
    drawing can occupy the space below the prose."""
    band(x, top, w, title, fill=band_fill)
    panel(x, top + BAND_H, w, h - BAND_H)
    th = (h - BAND_H) if text_h is None else text_h
    f = Frame(x, Y(top + BAND_H + th), w, th, leftPadding=pad, rightPadding=pad,
              topPadding=pad - 2, bottomPadding=pad, showBoundary=0)
    f.addFromList(list(flowables), c)


def bullets(items, size=15, leading=19.5, bullet="▪", indent=15, space=6, align=TA_JUSTIFY):
    st = ParagraphStyle("li", fontName="Times-Roman", fontSize=size, leading=leading,
                        alignment=align, textColor=INK, spaceAfter=space,
                        leftIndent=indent, bulletIndent=2, bulletFontName="Times-Bold",
                        bulletFontSize=size - 2)
    return [Paragraph(t, st, bulletText=bullet) for t in items]


# ================================================================ header
c.setFillColor(YELLOW)
c.rect(0, Y(224), W, 224, stroke=0, fill=1)
c.drawImage(LOGO, 44, Y(206), width=262, height=192, mask=None)
c.setFillColor(black)
c.setFont("Times-Bold", 46)
c.drawCentredString(W / 2.0 + 60, Y(96), "Rajarambapu Institute of Technology, Rajaramnagar")
c.setFillColor(ACCENT)
c.setFont("Times-Bold", 42)
c.drawCentredString(W / 2.0 + 60, Y(166), "Quantum 2k26")

# ================================================================ title strip
TITLE_TOP, TITLE_H = 238.0, 152.0
c.setFillColor(BAND)
c.rect(M, Y(TITLE_TOP + 66), CW, 66, stroke=0, fill=1)
c.setFillColor(white)
c.setFont("Times-Bold", 29)
c.drawCentredString(W / 2.0, Y(TITLE_TOP + 46),
                    "PharmaBharat — Verified B2B Pharmaceutical Supply, Redistribution & Retail Intelligence Platform")
panel(M, TITLE_TOP + 66, CW, TITLE_H - 66)
st_center = body(16, 20, TA_CENTER, space=2)
f = Frame(M, Y(TITLE_TOP + TITLE_H), CW, TITLE_H - 66, leftPadding=14, rightPadding=14,
          topPadding=9, bottomPadding=4, showBoundary=0)
f.addFromList([
    Paragraph("<b>Students:</b> Ms. Rutuja Yadav (2303124) &nbsp;•&nbsp; Mr. Aryan Sutar (2303134) "
              "&nbsp;•&nbsp; Mr. Ganesh Kumar (2303142) &nbsp;•&nbsp; Ms. Anannya Verma (2303148)", st_center),
    Paragraph("<b>Group No.</b> G23 &nbsp;&nbsp;|&nbsp;&nbsp; <b>Supervisor:</b> Prof. A. M. Jagtap "
              "&nbsp;&nbsp;|&nbsp;&nbsp; <b>Department of Computer Science &amp; Engineering</b>", st_center),
], c)

TOP = 406.0

# ================================================================ A — background | problem
A_H = 312.0
section(M, TOP, COL2, A_H, "Background", text_h=A_H - BAND_H - 108, flowables=[
    Paragraph(
        "India dispenses more medicine than any nation on earth through roughly <b>900,000 independent "
        "pharmacies</b> — and almost none of them can see the single number that decides whether stock "
        "becomes revenue or waste: <b>the batch expiry date</b>. It is printed on the carton, copied onto a "
        "paper bill, and then it disappears.", body(15.5, 20)),
    Paragraph(
        "<b>PharmaBharat rebuilds that missing layer.</b> It is one verified network on which retailers, "
        "wholesale distributors and pharmaceutical manufacturers trade <b>at the level of the batch</b> — "
        "and on which every medical store simultaneously runs its entire business: unit-level stock, GST "
        "counter billing, customers, credit and statutory compliance, all on the same data.", body(15.5, 20)),
])

# chain-of-custody strip, drawn inside the Background panel
chain = [("Manufacturer", "batch created"), ("Distributor", "batch moved"),
         ("Pharmacy", "batch dispensed"), ("Patient", "batch on the bill")]
nw = (COL2 - 28 - 3 * 22) / 4.0
ny = TOP + 232
for i, (t, sub) in enumerate(chain):
    nx = M + 14 + i * (nw + 22)
    c.setFillColor(PALE)
    c.setStrokeColor(TEAL)
    c.setLineWidth(1.1)
    c.roundRect(nx, Y(ny + 52), nw, 52, 6, stroke=1, fill=1)
    c.setFillColor(BAND)
    c.setFont("Times-Bold", 14)
    c.drawCentredString(nx + nw / 2.0, Y(ny + 22), t)
    c.setFillColor(TEAL)
    c.setFont("Times-Italic", 12)
    c.drawCentredString(nx + nw / 2.0, Y(ny + 40), sub)
    if i < 3:
        c.setStrokeColor(TEAL)
        c.setLineWidth(2)
        ax = nx + nw + 4
        c.line(ax, Y(ny + 26), ax + 9, Y(ny + 26))
        c.setFillColor(TEAL)
        pth = c.beginPath()
        pth.moveTo(ax + 8, Y(ny + 26) - 4.5)
        pth.lineTo(ax + 15, Y(ny + 26))
        pth.lineTo(ax + 8, Y(ny + 26) + 4.5)
        pth.close()
        c.drawPath(pth, stroke=0, fill=1)
c.setFillColor(TEAL)
c.setFont("Times-Bold", 13.5)
c.drawCentredString(M + COL2 / 2.0, Y(ny + 74),
                    "One unbroken chain of custody — godown to the single tablet cut at the counter.")

section(M + COL2 + GAP, TOP, COL2, A_H, "Problem Statement", [
    Paragraph("Pharmaceutical retail loses money in three places at once — and all three descend from the "
              "same blind spot.", body(15.5, 19.5)),
] + bullets([
    "<b>On the shelf.</b> Medicines expire unseen. An estimated <b>3–5% of stock value</b> is written off to "
    "expiry across the distribution chain, a loss carried almost entirely by the smallest players.",
    "<b>At the point of purchase.</b> The same molecule carries different prices from different distributors, "
    "discoverable only by telephone. Most shops never compare — they reorder from habit.",
    "<b>In compliance.</b> Schedule H/H1 registers are handwritten, drug licences lapse unnoticed, and a batch "
    "recall still travels by phone call — if it travels at all.",
], 15, 19) + [
    Paragraph("<b>Nobody can see the batch. Everything else follows from that.</b>",
              body(16, 19, TA_CENTER, BAND)),
])

# ================================================================ B — objectives
B_TOP, B_H = TOP + A_H + 12, 202.0
obj = ["Verify <b>every</b> trading entity through KYC — drug licence, GST position and PAN — before a single transaction.",
       "Make the <b>batch and its expiry date</b> a first-class, visible object across the whole supply chain.",
       "Let a pharmacy compare every verified seller on <b>price, margin and expiry</b> before committing a rupee.",
       "Run the complete retail counter — <b>unit-level stock, GST billing, loyalty, credit</b> — on the same data.",
       "Convert expiry from an invisible loss into a <b>measured, escalating 90/60/30-day signal</b>.",
       "Make compliance automatic: <b>digital H/H1 register, licence enforcement, instant recall propagation</b>."]
band(M, B_TOP, CW, "Objectives")
panel(M, B_TOP + BAND_H, CW, B_H - BAND_H)
half = (CW - 40) / 2.0
for i, chunk in enumerate([obj[:3], obj[3:]]):
    f = Frame(M + 14 + i * (half + 12), Y(B_TOP + B_H), half, B_H - BAND_H,
              leftPadding=4, rightPadding=8, topPadding=10, bottomPadding=4, showBoundary=0)
    f.addFromList(bullets(chunk, 15, 19, bullet="▸", space=7), c)

# ================================================================ C — methodology
C_TOP, C_H = B_TOP + B_H + 12, 188.0
band(M, C_TOP, CW, "Methodology")
panel(M, C_TOP + BAND_H, CW, C_H - BAND_H)
steps = [("1", "Requirement<br/>Engineering", "41 functional<br/>requirements, SRS"),
         ("2", "Domain &amp;<br/>System Design", "modular monolith,<br/>permission matrix"),
         ("3", "Iterative<br/>Development", "10 modules, built<br/>in dependency order"),
         ("4", "Security &amp;<br/>Compliance", "RBAC, ACID<br/>transactions, KYC"),
         ("5", "Verification", "208 automated tests,<br/>end-to-end typing"),
         ("6", "Evaluation &amp;<br/>Pilot Readiness", "seeded demo shop,<br/>deployment")]
sw = (CW - 28 - 5 * 14) / 6.0
sy_top = C_TOP + BAND_H + 16
sh = C_H - BAND_H - 30
for i, (n, t, s) in enumerate(steps):
    x = M + 14 + i * (sw + 14)
    c.setFillColor(PALE)
    c.setStrokeColor(BAND)
    c.setLineWidth(1.1)
    c.roundRect(x, Y(sy_top + sh), sw, sh, 7, stroke=1, fill=1)
    c.setFillColor(BAND)
    c.circle(x + 19, Y(sy_top + 19), 13, stroke=0, fill=1)
    c.setFillColor(white)
    c.setFont("Times-Bold", 15)
    c.drawCentredString(x + 19, Y(sy_top + 24), n)
    f = Frame(x, Y(sy_top + sh), sw, sh - 6, leftPadding=36, rightPadding=6,
              topPadding=5, bottomPadding=2, showBoundary=0)
    f.addFromList([Paragraph("<b>%s</b>" % t, body(13, 15, TA_CENTER, BAND, space=3)),
                   Paragraph(s, body(11.5, 13.5, TA_CENTER, MUTE, space=0))], c)
    if i < 5:
        c.setStrokeColor(BAND)
        c.setLineWidth(2)
        ax = x + sw + 3
        c.line(ax, Y(sy_top + sh / 2), ax + 8, Y(sy_top + sh / 2))
        c.setFillColor(BAND)
        p = c.beginPath()
        p.moveTo(ax + 7, Y(sy_top + sh / 2) - 4.5)
        p.lineTo(ax + 13, Y(sy_top + sh / 2))
        p.lineTo(ax + 7, Y(sy_top + sh / 2) + 4.5)
        p.close()
        c.drawPath(p, stroke=0, fill=1)

# ================================================================ D — diagram | tech spec
D_TOP, D_H = C_TOP + C_H + 12, 748.0
DW = 1046.0
TW = CW - DW - GAP

band(M, D_TOP, DW, "Project Diagram — System Architecture")
panel(M, D_TOP + BAND_H, DW, D_H - BAND_H)
img_w = DW - 24
img_h = img_w / (2800.0 / 1858.0)
avail = D_H - BAND_H - 16 - 44
if img_h > avail:
    img_h = avail
    img_w = img_h * (2800.0 / 1858.0)
c.drawImage(DIAG, M + (DW - img_w) / 2.0, Y(D_TOP + BAND_H + 10 + img_h),
            width=img_w, height=img_h, mask=None)
cap_y = D_TOP + BAND_H + 14 + img_h
c.setFillColor(TEAL)
c.setFont("Times-Bold", 13.5)
c.drawCentredString(M + DW / 2.0, Y(cap_y + 13),
                    "Every request reaches the database only after a server-side permission check.")
c.setFillColor(MUTE)
c.setFont("Times-Roman", 12.5)
c.drawCentredString(M + DW / 2.0, Y(cap_y + 30),
                    "The nightly job is the one path that does not — it carries a shared secret instead.")

TX = M + DW + GAP
section(TX, D_TOP, TW, D_H, "Technical Specifications", bullets([
    "<b>Frontend:</b> Next.js 16 App Router, React 19, TypeScript, Tailwind CSS",
    "<b>Backend:</b> React Server Components + Server Actions — no separate API tier, so a page and the "
    "action that mutates it share one authorization path",
    "<b>Database:</b> MongoDB Atlas (ap-south-1 Mumbai), Mongoose ODM, 19 domain models",
    "<b>Integrity:</b> multi-document <b>ACID transactions</b> on checkout, counter billing and ledger posting",
    "<b>Identity:</b> better-auth with Google OAuth — no passwords ever stored",
    "<b>Authorization:</b> permission matrix of business type × member role, enforced server-side on "
    "<b>every</b> action; the edge proxy authorises nothing",
    "<b>Dispensing:</b> FEFO engine — the batch expiring first is always offered first",
    "<b>Taxation:</b> CGST/SGST/IGST engine, MRP-inclusive reverse computation, three GST positions "
    "(registered, composition, unregistered)",
    "<b>Compliance:</b> Schedule H/H1 digital register, licence-expiry enforcement, platform-wide recall freeze",
    "<b>Localisation:</b> English, <font name=\"%s\">हिन्दी</font>, "
    "<font name=\"%s\">मराठी</font> — key parity enforced by automated test" % (DEVA, DEVA),
    "<b>Documents:</b> Cloudinary authenticated assets served only via signed redirects",
    "<b>Catalogue:</b> 246,064-medicine national master with fuzzy and salt-level search",
], 14, 17.5, space=7))

# ================================================================ E — results | applications
E_TOP, E_H = D_TOP + D_H + 12, 292.0
section(M, E_TOP, COL2, E_H, "Results and Conclusions", [
    Paragraph("<b>Results</b>", body(16, 18, space=4, color=BAND)),
] + bullets([
    "<b>41 / 41</b> functional requirements implemented and verified",
    "<b>208 automated tests</b> passing — 115 unit, 93 integration",
    "<b>10 production modules</b>, each delivered green, across <b>3 languages</b>",
    "<b>246,064 medicines</b> searchable; batch traceability godown → counter",
], 14.5, 17.5, space=4) + [
    Paragraph("<b>Conclusion</b>", body(16, 18, space=4, color=BAND)),
    Paragraph("PharmaBharat demonstrates that verified B2B ordering, GST-compliant retail billing, unit-level "
              "inventory, credit management, statutory registers and nationwide recall propagation can be unified "
              "in a single low-cost platform an independent pharmacy can actually run — turning the batch "
              "expiry date from the industry's most expensive blind spot into its most valuable signal.",
              body(14.5, 17.5)),
])

section(M + COL2 + GAP, E_TOP, COL2, E_H, "Applications", bullets([
    "<b>Retail pharmacies:</b> cheaper verified buying, plus a complete digital counter that replaces the register",
    "<b>Wholesale distributors:</b> verified demand, faster movement of near-expiry stock, fewer credit disputes",
    "<b>Pharmaceutical manufacturers:</b> true sell-through visibility and instant, provable recall reach",
    "<b>Patients:</b> correct GST bills, refill reminders, substitution savings and recall safety",
    "<b>Regulators &amp; drug inspectors:</b> machine-readable H/H1 registers and live licence status — an "
    "inspection becomes a download",
    "<b>Adjacent trades:</b> the batch-and-expiry core extends directly to agro-chemical, veterinary and "
    "perishable FMCG distribution",
], 14.5, 17.5, space=8))

# ================================================================ F — future scope
F_TOP, F_H = E_TOP + E_H + 12, 362.0
band(M, F_TOP, CW, "Future Scope — The Artificial Intelligence Roadmap")
panel(M, F_TOP + BAND_H, CW, F_H - BAND_H)

horizons = [
    (BAND, "HORIZON 1 · 0–12 MONTHS", "Intelligence Layer", [
        "<b>Predictive Expiry Engine</b> — a per-batch survival model that forecasts, 60 days out, which stock will die before it sells",
        "<b>Demand Forecasting</b> — molecule-level and shop-level, aware of season, festival and local epidemic signal",
        "<b>Autonomous Replenishment Agent</b> — drafts the order, optimises the split across sellers, waits for one tap",
        "<b>Vision Batch Capture</b> — photograph an invoice or a strip; batch, expiry and HSN enter with no typing",
        "<b>Substitution Intelligence</b> — generic alternatives ranked by margin, availability and patient saving at the moment of billing",
    ]),
    (HexColor("#1D6F8B"), "HORIZON 2 · 1–2 YEARS", "Network Effects", [
        "<b>National Near-Expiry Exchange</b> — a live redistribution market routing stock from where it will expire to where it will sell",
        "<b>Embedded Working Capital</b> — credit underwritten from on-platform ledger behaviour, not collateral",
        "<b>Voice-First Counter</b> — hands-free dispensing in Hindi, Marathi and eight further Indian languages",
        "<b>ABDM &amp; ONDC Integration</b> — e-prescriptions and open-network commerce at national scale",
        "<b>Federated Learning</b> — models trained across thousands of shops without a shop's data ever leaving it",
    ]),
    (TEAL, "HORIZON 3 · 2–5 YEARS", "Category-Defining Infrastructure", [
        "<b>Spurious-Drug Detection</b> — graph anomaly detection over batch provenance to surface counterfeit flows",
        "<b>Blockchain-Anchored Provenance</b> — immutable manufacturer-to-patient chain of custody",
        "<b>IoT Cold-Chain Digital Twin</b> — live temperature telemetry bound to the batch record itself",
        "<b>Clinical Adherence Engine</b> — chronic-patient refill prediction and timely intervention",
        "<b>National Pharmaco-Signal Grid</b> — anonymised real-time dispensing as public-health early warning",
    ]),
]
hw = (CW - 28 - 2 * 14) / 3.0
hy = F_TOP + BAND_H + 12
hh = F_H - BAND_H - 24 - 34
for i, (col, label, name, items) in enumerate(horizons):
    x = M + 14 + i * (hw + 14)
    c.setFillColor(col)
    c.rect(x, Y(hy + 38), hw, 38, stroke=0, fill=1)
    c.setFillColor(white)
    c.setFont("Times-Bold", 13)
    c.drawCentredString(x + hw / 2.0, Y(hy + 16), label)
    c.setFont("Times-Italic", 13.5)
    c.drawCentredString(x + hw / 2.0, Y(hy + 32), name)
    c.setStrokeColor(col)
    c.setLineWidth(1.1)
    c.setFillColor(white)
    c.rect(x, Y(hy + 38 + hh), hw, hh, stroke=1, fill=0)
    f = Frame(x, Y(hy + 38 + hh), hw, hh, leftPadding=9, rightPadding=8,
              topPadding=8, bottomPadding=2, showBoundary=0)
    f.addFromList(bullets(items, 12.6, 15, bullet="▪", indent=12, space=6), c)

kicker = hy + 38 + hh + 8
c.setFillColor(PALE)
c.rect(M + 14, Y(kicker + 30), CW - 28, 30, stroke=0, fill=1)
c.setFillColor(BAND)
c.setFont("Times-Bold", 16)
c.drawCentredString(W / 2.0, Y(kicker + 20),
                    "Every model above trains on data the platform already captures. The hard part — getting "
                    "every batch and every date into a system at all — is built.")

c.showPage()
c.save()
print("wrote", OUT)
