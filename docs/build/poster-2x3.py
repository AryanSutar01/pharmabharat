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


def measure(flows, avail_w):
    """Height a list of flowables needs at a given width."""
    total = 0.0
    for fl in flows:
        total += fl.wrap(avail_w, 1e6)[1] + fl.getSpaceAfter() + fl.getSpaceBefore()
    return total


def autofit(builder, avail_w, avail_h, lo=12.0, hi=26.0, step=0.25):
    """Largest body size at which builder(size) still fits the box.

    A poster box that is two-thirds full reads as a mistake, and text sized for
    a screen is unreadable on a 2ft x 3ft flex. Measuring beats guessing.
    """
    best, size = lo, lo
    while size <= hi:
        if measure(builder(size), avail_w) <= avail_h:
            best, size = size, size + step
        else:
            break
    return best


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
BG_TEXT_H = A_H - BAND_H - 108


def bg(z):
    return [
        Paragraph(
            "India dispenses more medicine than any nation on earth through roughly <b>900,000 independent "
            "pharmacies</b> — and almost none of them can see the single number that decides whether stock "
            "becomes revenue or waste: <b>the batch expiry date</b>. It is printed on the carton, copied onto a "
            "paper bill, and then it disappears.", body(z, z * 1.29)),
        Paragraph(
            "<b>PharmaBharat rebuilds that missing layer.</b> One verified network on which retailers, "
            "distributors and manufacturers trade <b>at the level of the batch</b> — and on which every "
            "medical store simultaneously runs its whole business: stock, GST counter billing, customers, "
            "credit and compliance.", body(z, z * 1.29)),
    ]


Z_BG = autofit(bg, COL2 - 2 * 12, BG_TEXT_H - 22)
section(M, TOP, COL2, A_H, "Background", text_h=BG_TEXT_H, flowables=bg(Z_BG))

# chain-of-custody strip, drawn inside the Background panel
chain = [("Manufacturer", "batch created"), ("Distributor", "batch moved"),
         ("Pharmacy", "batch dispensed"), ("Patient", "batch on the bill")]
nw = (COL2 - 28 - 3 * 22) / 4.0
ny = TOP + 218
for i, (t, sub) in enumerate(chain):
    nx = M + 14 + i * (nw + 22)
    c.setFillColor(PALE)
    c.setStrokeColor(TEAL)
    c.setLineWidth(1.1)
    c.roundRect(nx, Y(ny + 62), nw, 62, 6, stroke=1, fill=1)
    c.setFillColor(BAND)
    c.setFont("Times-Bold", 18)
    c.drawCentredString(nx + nw / 2.0, Y(ny + 26), t)
    c.setFillColor(TEAL)
    c.setFont("Times-Italic", 18)
    c.drawCentredString(nx + nw / 2.0, Y(ny + 50), sub)
    if i < 3:
        c.setStrokeColor(TEAL)
        c.setLineWidth(2)
        ax = nx + nw + 4
        c.line(ax, Y(ny + 31), ax + 9, Y(ny + 31))
        c.setFillColor(TEAL)
        pth = c.beginPath()
        pth.moveTo(ax + 8, Y(ny + 31) - 5)
        pth.lineTo(ax + 16, Y(ny + 31))
        pth.lineTo(ax + 8, Y(ny + 31) + 5)
        pth.close()
        c.drawPath(pth, stroke=0, fill=1)
c.setFillColor(TEAL)
c.setFont("Times-Bold", 15.5)
c.drawCentredString(M + COL2 / 2.0, Y(ny + 86),
                    "One unbroken chain of custody — godown to the tablet cut at the counter.")

def ps(z):
    return [Paragraph("Pharmaceutical retail loses money in three places at once — and all three descend "
                      "from the same blind spot.", body(z, z * 1.27))] + bullets([
        "<b>On the shelf.</b> Medicines expire unseen. An estimated <b>3–5% of stock value</b> is written "
        "off to expiry across the distribution chain, a loss carried almost entirely by the smallest players.",
        "<b>At the point of purchase.</b> The same molecule carries different prices from different "
        "distributors, discoverable only by telephone. Most shops never compare — they reorder from habit.",
        "<b>In compliance.</b> Schedule H/H1 registers are handwritten, drug licences lapse unnoticed, and a "
        "batch recall still travels by phone call — if it travels at all.",
    ], z, z * 1.27, space=z * 0.42) + [
        Paragraph("<b>Nobody can see the batch. Everything else follows from that.</b>",
                  body(z + 1, (z + 1) * 1.22, TA_CENTER, BAND))]


Z_PS = autofit(ps, COL2 - 24, A_H - BAND_H - 22)
section(M + COL2 + GAP, TOP, COL2, A_H, "Problem Statement", ps(Z_PS))

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
Z_OBJ = min(autofit(lambda z: bullets(obj[:3], z, z * 1.27, bullet="▸", space=z * 0.45),
                    half - 12, B_H - BAND_H - 16),
            autofit(lambda z: bullets(obj[3:], z, z * 1.27, bullet="▸", space=z * 0.45),
                    half - 12, B_H - BAND_H - 16))
for i, chunk in enumerate([obj[:3], obj[3:]]):
    f = Frame(M + 14 + i * (half + 12), Y(B_TOP + B_H), half, B_H - BAND_H,
              leftPadding=4, rightPadding=8, topPadding=10, bottomPadding=4, showBoundary=0)
    f.addFromList(bullets(chunk, Z_OBJ, Z_OBJ * 1.27, bullet="▸", space=Z_OBJ * 0.45), c)

# ================================================================ C — methodology
C_TOP, C_H = B_TOP + B_H + 12, 188.0
band(M, C_TOP, CW, "Methodology")
panel(M, C_TOP + BAND_H, CW, C_H - BAND_H)
steps = [("1", "Requirements", "41 FRs in the SRS"),
         ("2", "System Design", "modular monolith"),
         ("3", "Development", "10 modules, in order"),
         ("4", "Security", "RBAC · ACID · KYC"),
         ("5", "Verification", "208 automated tests"),
         ("6", "Evaluation", "seeded pilot demo")]
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
    c.circle(x + 22, Y(sy_top + sh / 2.0), 15, stroke=0, fill=1)
    c.setFillColor(white)
    c.setFont("Times-Bold", 18)
    c.drawCentredString(x + 22, Y(sy_top + sh / 2.0 + 6), n)
    f = Frame(x, Y(sy_top + sh), sw, sh - 4, leftPadding=44, rightPadding=14,
              topPadding=(sh - 52) / 2.0, bottomPadding=2, showBoundary=0)
    f.addFromList([Paragraph("<b>%s</b>" % t, body(18, 22, TA_CENTER, BAND, space=5)),
                   Paragraph(s, body(18, 21, TA_CENTER, MUTE, space=0))], c)
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
SPEC = [
    "<b>Frontend:</b> Next.js 16 App Router, React 19, TypeScript, Tailwind CSS",
    "<b>Backend:</b> React Server Components + Server Actions — no separate API tier, so a page and the "
    "action that mutates it share one authorization path",
    "<b>Database:</b> MongoDB Atlas (ap-south-1 Mumbai), Mongoose ODM, 19 domain models",
    "<b>Integrity:</b> multi-document <b>ACID transactions</b> on checkout, counter billing and ledger posting",
    "<b>Identity:</b> better-auth with Google OAuth — no passwords ever stored",
    "<b>Authorization:</b> permission matrix of business type × member role, enforced server-side on "
    "<b>every</b> action; the edge proxy authorises nothing",
    "<b>Dispensing:</b> FEFO engine — the batch expiring first is always offered first",
    "<b>Taxation:</b> CGST/SGST/IGST engine, MRP-inclusive reverse computation, three GST positions",
    "<b>Compliance:</b> Schedule H/H1 digital register, licence-expiry enforcement, recall freeze",
    "<b>Localisation:</b> English, <font name=\"%s\">हिन्दी</font>, "
    "<font name=\"%s\">मराठी</font> — key parity enforced by test" % (DEVA, DEVA),
    "<b>Documents:</b> Cloudinary authenticated assets served only via signed redirects",
    "<b>Catalogue:</b> 246,064-medicine national master with fuzzy and salt-level search",
]
Z_SPEC = autofit(lambda z: bullets(SPEC, z, z * 1.24, space=z * 0.48), TW - 24, D_H - BAND_H - 22)
section(TX, D_TOP, TW, D_H, "Technical Specifications",
        bullets(SPEC, Z_SPEC, Z_SPEC * 1.24, space=Z_SPEC * 0.48))

# ================================================================ E — results | applications
E_TOP, E_H = D_TOP + D_H + 12, 292.0
def res(z):
    return [Paragraph("<b>Results</b>", body(z + 1, (z + 1) * 1.2, space=z * 0.3, color=BAND))] + bullets([
        "<b>41 / 41</b> functional requirements implemented and verified",
        "<b>208 automated tests</b> passing — 115 unit, 93 integration",
        "<b>10 production modules</b>, each delivered green, across <b>3 languages</b>",
        "<b>246,064 medicines</b> searchable; batch traceability godown → counter",
    ], z, z * 1.24, space=z * 0.3) + [
        Paragraph("<b>Conclusion</b>", body(z + 1, (z + 1) * 1.2, space=z * 0.3, color=BAND)),
        Paragraph("Verified B2B ordering, GST-compliant retail billing, unit-level inventory, credit "
                  "management, statutory registers and nationwide recall propagation, unified in one low-cost "
                  "platform an independent pharmacy can actually run — turning the batch expiry date from "
                  "the industry's most expensive blind spot into its most valuable signal.", body(z, z * 1.24))]


Z_RES = autofit(res, COL2 - 24, E_H - BAND_H - 22)
section(M, E_TOP, COL2, E_H, "Results and Conclusions", res(Z_RES))

APPS = [
    "<b>Retail pharmacies:</b> cheaper verified buying, plus a complete digital counter that replaces the register",
    "<b>Wholesale distributors:</b> verified demand, faster movement of near-expiry stock, fewer credit disputes",
    "<b>Pharmaceutical manufacturers:</b> true sell-through visibility and instant, provable recall reach",
    "<b>Patients:</b> correct GST bills, refill reminders, substitution savings and recall safety",
    "<b>Regulators &amp; drug inspectors:</b> machine-readable H/H1 registers and live licence status — an "
    "inspection becomes a download",
    "<b>Adjacent trades:</b> the batch-and-expiry core extends directly to agro-chemical, veterinary and "
    "perishable FMCG distribution",
]
Z_APP = autofit(lambda z: bullets(APPS, z, z * 1.24, space=z * 0.5), COL2 - 24, E_H - BAND_H - 22)
section(M + COL2 + GAP, E_TOP, COL2, E_H, "Applications",
        bullets(APPS, Z_APP, Z_APP * 1.24, space=Z_APP * 0.5))

# ================================================================ F — future scope
F_TOP, F_H = E_TOP + E_H + 12, 376.0
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
hh = F_H - BAND_H - 96
Z_HZ = min(autofit(lambda z, it=h[3]: bullets(it, z, z * 1.22, bullet="▪", indent=12,
                                             space=z * 0.45), hw - 17, hh - 10)
           for h in horizons)
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
    f.addFromList(bullets(items, Z_HZ, Z_HZ * 1.22, bullet="▪", indent=12, space=Z_HZ * 0.45), c)

kicker = hy + 38 + hh + 8
c.setFillColor(PALE)
c.rect(M + 14, Y(kicker + 30), CW - 28, 30, stroke=0, fill=1)
c.setFillColor(BAND)
c.setFont("Times-Bold", 16)
c.drawCentredString(W / 2.0, Y(kicker + 20),
                    "Every model above trains on data the platform already captures. The hard part — getting "
                    "every batch and every date into a system at all — is built.")

print("fitted sizes: bg=%.2f problem=%.2f objectives=%.2f spec=%.2f results=%.2f apps=%.2f horizons=%.2f"
      % (Z_BG, Z_PS, Z_OBJ, Z_SPEC, Z_RES, Z_APP, Z_HZ))

c.showPage()
c.save()
print("wrote", OUT)
