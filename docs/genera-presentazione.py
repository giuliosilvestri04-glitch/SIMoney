"""
Generatore della presentazione aziendale del prototipo.

Produce `docs/Prototipo-App-Mobile.pptx`, 16:9, modificabile in PowerPoint.

Uso:  python docs/genera-presentazione.py
Richiede:  pip install python-pptx
"""

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pathlib import Path

# ---------------------------------------------------------------------------
# Palette e tipografia — coerenti con il design system dell'app
# ---------------------------------------------------------------------------

NAVY = RGBColor(0x0F, 0x27, 0x40)
NAVY_DEEP = RGBColor(0x0A, 0x17, 0x29)
ACCENT = RGBColor(0x25, 0x63, 0xEB)
ACCENT_LIGHT = RGBColor(0x4C, 0x8D, 0xFF)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
BG = RGBColor(0xF4, 0xF6, 0xF9)
SURFACE = RGBColor(0xFF, 0xFF, 0xFF)
TEXT = RGBColor(0x0F, 0x1B, 0x2D)
MUTED = RGBColor(0x5B, 0x6B, 0x82)
FAINT = RGBColor(0x8A, 0x98, 0xAC)
BORDER = RGBColor(0xE3, 0xE8, 0xEF)
POSITIVE = RGBColor(0x06, 0x7A, 0x52)
WARNING = RGBColor(0xA9, 0x65, 0x0B)
NEGATIVE = RGBColor(0xB4, 0x34, 0x2A)
VIOLET = RGBColor(0x7C, 0x3A, 0xED)
TEAL = RGBColor(0x0E, 0xA5, 0xE9)

FONT = "Segoe UI"
FONT_LIGHT = "Segoe UI Light"

W = Inches(13.333)
H = Inches(7.5)
MARGIN = Inches(0.85)

prs = Presentation()
prs.slide_width = W
prs.slide_height = H

page_counter = {"n": 0}


# ---------------------------------------------------------------------------
# Primitive di disegno
# ---------------------------------------------------------------------------

def new_slide(background=BG):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, W, H)
    bg.fill.solid()
    bg.fill.fore_color.rgb = background
    bg.line.fill.background()
    bg.shadow.inherit = False
    return slide


def textbox(slide, x, y, w, h, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP):
    box = slide.shapes.add_textbox(x, y, w, h)
    tf = box.text_frame
    tf.word_wrap = True
    tf.margin_left = 0
    tf.margin_right = 0
    tf.margin_top = 0
    tf.margin_bottom = 0
    tf.vertical_anchor = anchor
    tf.paragraphs[0].alignment = align
    return tf


def para(tf, text, size=14, color=TEXT, bold=False, font=FONT, space_before=0,
         space_after=6, align=None, first=False, line_spacing=1.15):
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    p.text = text
    p.space_before = Pt(space_before)
    p.space_after = Pt(space_after)
    p.line_spacing = line_spacing
    if align is not None:
        p.alignment = align
    for run in p.runs:
        run.font.size = Pt(size)
        run.font.color.rgb = color
        run.font.bold = bold
        run.font.name = font
    return p


def rect(slide, x, y, w, h, fill=SURFACE, line=None, radius=0.06, shape=MSO_SHAPE.ROUNDED_RECTANGLE):
    sh = slide.shapes.add_shape(shape, x, y, w, h)
    if fill is None:
        sh.fill.background()
    else:
        sh.fill.solid()
        sh.fill.fore_color.rgb = fill
    if line is None:
        sh.line.fill.background()
    else:
        sh.line.color.rgb = line
        sh.line.width = Pt(1)
    sh.shadow.inherit = False
    if shape == MSO_SHAPE.ROUNDED_RECTANGLE:
        try:
            sh.adjustments[0] = radius
        except (IndexError, ValueError):
            pass
    return sh


def line(slide, x1, y1, x2, y2, color=BORDER, width=1.0):
    connector = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, x1, y1, x2, y2)
    connector.line.color.rgb = color
    connector.line.width = Pt(width)
    connector.shadow.inherit = False
    return connector


def footer(slide, dark=False):
    """Numero di pagina e promemoria che si tratta di un prototipo."""
    page_counter["n"] += 1
    tf = textbox(slide, MARGIN, H - Inches(0.55), Inches(9), Inches(0.3))
    para(tf, "Prototipo dimostrativo · dati fittizi", 9,
         RGBColor(0xFF, 0xFF, 0xFF) if dark else FAINT, first=True, space_after=0)
    tf2 = textbox(slide, W - MARGIN - Inches(1), H - Inches(0.55), Inches(1), Inches(0.3),
                  align=PP_ALIGN.RIGHT)
    para(tf2, str(page_counter["n"]), 9,
         RGBColor(0xFF, 0xFF, 0xFF) if dark else FAINT, first=True, space_after=0)


def slide_title(slide, kicker, title, subtitle=None):
    """Intestazione standard delle slide di contenuto."""
    tf = textbox(slide, MARGIN, Inches(0.62), Inches(11.6), Inches(0.3))
    para(tf, kicker.upper(), 11, ACCENT, bold=True, first=True, space_after=0)

    # Oltre una certa lunghezza il titolo va a capo: si sposta tutto il resto.
    two_lines = len(title) > 48
    tf = textbox(slide, MARGIN, Inches(0.98), Inches(11.6),
                 Inches(1.0) if two_lines else Inches(0.7))
    para(tf, title, 32, TEXT, bold=True, font=FONT, first=True, space_after=0)

    y = Inches(2.2) if two_lines else Inches(1.75)
    if subtitle:
        tf = textbox(slide, MARGIN, y, Inches(10.5), Inches(0.5))
        para(tf, subtitle, 14.5, MUTED, first=True, space_after=0)
        y += Inches(0.47)
    else:
        y += Inches(0.1)
    return y


def card(slide, x, y, w, h, fill=SURFACE, line_color=BORDER, radius=0.05):
    return rect(slide, x, y, w, h, fill=fill, line=line_color, radius=radius)


def bullet(tf, text, size=14, color=TEXT, bold=False, space_after=9, first=False):
    return para(tf, text, size, color, bold=bold, space_after=space_after, first=first)


# ---------------------------------------------------------------------------
# Schema di uno smartphone: comunica "app mobile" senza fingere screenshot
# ---------------------------------------------------------------------------

def phone(slide, x, y, height, kind="client", detailed=None):
    """
    Schema di uno smartphone.

    Tutte le misure sono proporzionali all'altezza richiesta: lo stesso disegno
    resta leggibile sia grande in copertina sia piccolo in una griglia.
    Sotto una certa dimensione il testo interno sparisce e restano le forme:
    meglio uno schema pulito di un testo illeggibile.
    """
    EMU_IN = 914400
    hin = height / EMU_IN
    w = int(height * 0.475)
    win = w / EMU_IN
    if detailed is None:
        detailed = hin >= 3.6

    pad = int(w * 0.065)
    rect(slide, x, y, w, height, fill=WHITE, line=RGBColor(0xC6, 0xD0, 0xDC), radius=0.09)

    header_h = int(height * 0.30)
    rect(slide, x + pad // 2, y + pad // 2, w - pad, header_h, fill=NAVY, radius=0.10)

    label_pt = max(5.0, win * 3.1)
    value_pt = max(9.5, win * 7.8)
    delta_pt = max(5.0, win * 3.2)

    inner_x = x + int(pad * 1.5)
    inner_w = w - int(pad * 3.0)

    label = {"client": "PATRIMONIO", "advisor": "GESTITO", "admin": "TOTALE AZIENDA"}[kind]
    value = {"client": "€ 308.443", "advisor": "€ 4,9 Mln", "admin": "€ 15,3 Mln"}[kind]
    delta = {"client": "+19,2%", "advisor": "+11,4%", "admin": "+9,0%"}[kind]

    ly = y + int(pad * 1.3)
    tf = textbox(slide, inner_x, ly, inner_w, Pt(label_pt * 1.5))
    para(tf, label, label_pt, RGBColor(0x9A, 0xB4, 0xD4), bold=True, first=True,
         space_after=0, line_spacing=1.0)

    vy = ly + Pt(label_pt * 1.7)
    tf = textbox(slide, inner_x, vy, inner_w, Pt(value_pt * 1.45))
    para(tf, value, value_pt, WHITE, bold=True, first=True, space_after=0, line_spacing=1.0)

    dy = vy + Pt(value_pt * 1.5)
    tf = textbox(slide, inner_x, dy, inner_w, Pt(delta_pt * 1.5))
    para(tf, delta + "  ultimi 12 mesi", delta_pt, RGBColor(0x7B, 0xE0, 0xB0), first=True,
         space_after=0, line_spacing=1.0)

    # Il grafico occupa solo lo spazio rimasto sotto al testo, dentro l'intestazione.
    chart_top = dy + Pt(delta_pt * 1.9)
    chart_bottom = y + pad // 2 + header_h - int(pad * 0.9)
    if chart_bottom - chart_top > Pt(7):
        points = [0.05, 0.48, 0.30, 0.66, 0.52, 0.84, 1.00]
        span = inner_w / (len(points) - 1)
        amp = chart_bottom - chart_top
        for i in range(len(points) - 1):
            line(slide,
                 int(inner_x + i * span), int(chart_bottom - points[i] * amp),
                 int(inner_x + (i + 1) * span), int(chart_bottom - points[i + 1] * amp),
                 color=ACCENT_LIGHT, width=max(1.0, win * 0.7))

    # Contenuto: le card riempiono tutto lo spazio disponibile.
    rows = {
        "client": [("Asset allocation", ACCENT), ("Nuova proposta", WARNING),
                   ("Investimenti", VIOLET), ("Documenti", TEAL)],
        "advisor": [("Clienti · 7", ACCENT), ("Proposte in attesa", WARNING),
                    ("Nuova proposta", POSITIVE), ("Scadenze", TEAL)],
        "admin": [("Clienti · 20", ACCENT), ("Consulenti · 5", TEAL),
                  ("Accettazione 57%", POSITIVE), ("Registro attività", VIOLET)],
    }[kind]
    if not detailed:
        rows = rows[:3]

    bar_y = y + height - int(height * 0.085)
    content_top = y + pad // 2 + header_h + int(pad * 0.9)
    content_bottom = bar_y - int(pad * 0.9)
    gap = int(pad * 0.75)
    n = len(rows)
    card_h = int((content_bottom - content_top - gap * (n - 1)) / n)

    cy = content_top
    for label_text, color in rows:
        rect(slide, inner_x - pad // 2, cy, inner_w + pad, card_h, fill=BG, line=BORDER, radius=0.16)
        dot = int(card_h * 0.26)
        rect(slide, inner_x, cy + (card_h - dot) // 2, dot, dot, fill=color, shape=MSO_SHAPE.OVAL)
        if detailed:
            tf = textbox(slide, inner_x + dot + pad // 2, cy + int(card_h * 0.26),
                         inner_w - dot - pad, Pt(win * 4.0),
                         anchor=MSO_ANCHOR.MIDDLE)
            para(tf, label_text, max(6.0, win * 3.4), TEXT, bold=True, first=True,
                 space_after=0, line_spacing=1.0)
        else:
            # Segnaposto di testo: due righe grigie, come in un wireframe.
            bar_w = inner_w - dot - pad
            rect(slide, inner_x + dot + pad // 2, cy + int(card_h * 0.34),
                 int(bar_w * 0.72), int(card_h * 0.12), fill=RGBColor(0xC6, 0xD0, 0xDC), radius=0.5)
            rect(slide, inner_x + dot + pad // 2, cy + int(card_h * 0.56),
                 int(bar_w * 0.45), int(card_h * 0.12), fill=RGBColor(0xDE, 0xE4, 0xEC), radius=0.5)
        cy += card_h + gap

    # Barra di navigazione inferiore
    line(slide, x + pad // 2, bar_y, x + w - pad // 2, bar_y, color=BORDER, width=1)
    n_tabs = 5 if kind == "client" else 4
    tab_span = (w - pad * 2) / n_tabs
    dot = max(int(w * 0.05), Pt(3.5))
    for i in range(n_tabs):
        cx = int(x + pad + tab_span * (i + 0.5) - dot / 2)
        rect(slide, cx, bar_y + int((height - (bar_y - y)) * 0.30), dot, dot,
             fill=NAVY if i == 0 else RGBColor(0xC6, 0xD0, 0xDC), shape=MSO_SHAPE.OVAL)


# ---------------------------------------------------------------------------
# SLIDE 1 — Copertina
# ---------------------------------------------------------------------------

slide = new_slide(NAVY)

# Banda decorativa
rect(slide, W - Inches(4.6), 0, Inches(4.6), H, fill=NAVY_DEEP, radius=0, shape=MSO_SHAPE.RECTANGLE)
phone(slide, W - Inches(3.55), Inches(1.15), Inches(5.2), "client")

badge = rect(slide, MARGIN, Inches(1.15), Inches(1.55), Inches(0.34),
             fill=None, line=RGBColor(0x5B, 0x7B, 0xA0), radius=0.3)
tf = textbox(slide, MARGIN, Inches(1.22), Inches(1.55), Inches(0.25), align=PP_ALIGN.CENTER)
para(tf, "PROTOTIPO", 9, RGBColor(0xB9, 0xCB, 0xE2), bold=True, first=True, space_after=0)

tf = textbox(slide, MARGIN, Inches(2.05), Inches(7.6), Inches(2.2))
para(tf, "Una nuova app mobile", 44, WHITE, bold=True, first=True, space_after=2)
para(tf, "per clienti e consulenti", 44, ACCENT_LIGHT, bold=True, space_after=0)

tf = textbox(slide, MARGIN, Inches(4.25), Inches(7.2), Inches(1.2))
para(tf, "Più semplice, più veloce e pensata per lo smartphone.",
     17, RGBColor(0xC8, 0xD6, 0xE6), first=True, space_after=4)
para(tf, "Prototipo funzionante, navigabile e già provabile su dispositivi reali.",
     17, RGBColor(0x9A, 0xB4, 0xD4), space_after=0)

line(slide, MARGIN, Inches(5.75), MARGIN + Inches(2.2), Inches(5.75), color=ACCENT, width=2.5)

tf = textbox(slide, MARGIN, Inches(6.0), Inches(7), Inches(0.8))
para(tf, "Preparato per Reversal SIM", 13, RGBColor(0xC8, 0xD6, 0xE6), bold=True, first=True, space_after=3)
para(tf, "Settembre 2026", 12, RGBColor(0x7E, 0x98, 0xB8), space_after=0)

footer(slide, dark=True)

# ---------------------------------------------------------------------------
# SLIDE 2 — Il punto di partenza
# ---------------------------------------------------------------------------

slide = new_slide()
y = slide_title(slide, "Il punto di partenza", "Tutto funziona, ma non dallo smartphone",
                "Ciò che serve c'è già. Il problema è come ci si arriva.")

problems = [
    ("Pesante", "Tempi di caricamento lunghi e molte schermate per una sola informazione."),
    ("Complessa", "Il cliente deve sapere dove cercare: il patrimonio non è mai la prima cosa che vede."),
    ("Non mobile", "Pensata per il desktop: testi piccoli, tabelle larghe, poco usabile da telefono."),
    ("Fragile agli aggiornamenti", "Ogni rilascio richiede verifiche estese su tutta la piattaforma."),
]

cw = Inches(2.72)
gap = Inches(0.21)
for i, (title_text, body) in enumerate(problems):
    x = MARGIN + i * (cw + gap)
    card(slide, x, y, cw, Inches(2.25))
    rect(slide, x, y, cw, Inches(0.075), fill=NEGATIVE, radius=0.5)
    tf = textbox(slide, x + Inches(0.28), y + Inches(0.42), cw - Inches(0.56), Inches(0.35))
    para(tf, title_text, 16, TEXT, bold=True, first=True, space_after=6)
    para(tf, body, 12, MUTED, space_after=0, line_spacing=1.25)

y2 = y + Inches(2.6)
card(slide, MARGIN, y2, Inches(11.63), Inches(1.35), fill=NAVY, line_color=None)
tf = textbox(slide, MARGIN + Inches(0.45), y2 + Inches(0.28), Inches(10.8), Inches(0.9))
para(tf, "L'idea non è rifare la piattaforma.", 17, WHITE, bold=True, first=True, space_after=5)
para(tf, "È affiancarle un'app mobile che faccia poche cose, subito e bene: "
         "il patrimonio, il suo andamento e le proposte del consulente.",
     14.5, RGBColor(0xC8, 0xD6, 0xE6), space_after=0)

footer(slide)

# ---------------------------------------------------------------------------
# SLIDE 3 — Cosa vi mostriamo
# ---------------------------------------------------------------------------

slide = new_slide()
y = slide_title(slide, "Cosa vi mostriamo oggi", "Non un mockup: un prototipo che funziona davvero",
                "Si installa su un telefono, si naviga, risponde. I dati sono simulati, tutto il resto è reale.")

items = [
    ("34", "schermate navigabili", "Tre aree complete: cliente, consulente, direzione."),
    ("48", "API funzionanti", "Un backend vero dietro l'app, non schermate statiche."),
    ("20", "clienti simulati", "Con 2 anni di storico giornaliero e proposte in ogni stato."),
]

cw = Inches(3.65)
gap = Inches(0.34)
for i, (number, label, body) in enumerate(items):
    x = MARGIN + i * (cw + gap)
    card(slide, x, y, cw, Inches(1.95))
    tf = textbox(slide, x + Inches(0.32), y + Inches(0.3), cw - Inches(0.64), Inches(0.75))
    para(tf, number, 40, ACCENT, bold=True, first=True, space_after=0)
    tf = textbox(slide, x + Inches(0.32), y + Inches(0.98), cw - Inches(0.64), Inches(0.3))
    para(tf, label, 14, TEXT, bold=True, first=True, space_after=5)
    para(tf, body, 11.5, MUTED, space_after=0, line_spacing=1.25)

y2 = y + Inches(2.35)
tf = textbox(slide, MARGIN, y2, Inches(11.6), Inches(0.3))
para(tf, "COSA NON È", 11, FAINT, bold=True, first=True, space_after=10)

nots = [
    "Non è una serie di immagini: ogni schermata legge dati veri da un server.",
    "Non è la piattaforma web dentro un contenitore: è un'app nativa per Android e iPhone.",
    "Non è collegata ai vostri sistemi: funziona in autonomia, senza toccare nulla di vostro.",
]
tf = textbox(slide, MARGIN, y2 + Inches(0.42), Inches(11.6), Inches(1.4))
for i, text in enumerate(nots):
    para(tf, "—   " + text, 14, MUTED, first=(i == 0), space_after=9)

footer(slide)

# ---------------------------------------------------------------------------
# SLIDE 4 — I tre ruoli
# ---------------------------------------------------------------------------

slide = new_slide()
y = slide_title(slide, "Struttura", "Tre persone, tre app diverse",
                "Chi accede vede solo ciò che gli serve: l'app cambia forma in base al ruolo.")

roles = [
    ("CLIENTE", "Il proprio patrimonio", ACCENT, "client",
     ["Patrimonio e andamento", "Investimenti e composizione", "Proposte da accettare"],
     "Vede solo i propri dati."),
    ("CONSULENTE", "I clienti assegnati", POSITIVE, "advisor",
     ["Portafoglio gestito", "Scheda di ogni cliente", "Creazione delle proposte"],
     "Vede solo i clienti assegnati."),
    ("DIREZIONE", "L'andamento aziendale", WARNING, "admin",
     ["Patrimonio complessivo", "Risultati per consulente", "Registro delle attività"],
     "Vede i dati aggregati dell'azienda."),
]

cw = Inches(3.65)
gap = Inches(0.34)
ch = Inches(4.5)
phone_h = Inches(2.1)

for i, (role, claim, color, kind, features, note) in enumerate(roles):
    x = MARGIN + i * (cw + gap)
    card(slide, x, y, cw, ch)
    rect(slide, x, y, cw, Inches(0.075), fill=color, radius=0.5)

    # Schema del telefono, centrato: comunica il ruolo prima ancora del testo
    phone(slide, x + (cw - int(phone_h * 0.475)) // 2, y + Inches(0.3), phone_h, kind)

    # Un unico blocco di testo che fluisce: nessun rischio di sovrapposizioni
    ty = y + Inches(2.62)
    tf = textbox(slide, x + Inches(0.32), ty, cw - Inches(0.64), ch - Inches(2.9))
    para(tf, role, 10.5, color, bold=True, first=True, space_after=4)
    para(tf, claim, 15, TEXT, bold=True, space_after=11, line_spacing=1.1)
    for feature in features:
        para(tf, "· " + feature, 11.5, MUTED, space_after=6, line_spacing=1.1)
    para(tf, note, 10.5, FAINT, bold=True, space_before=7, space_after=0)

footer(slide)

# ---------------------------------------------------------------------------
# SLIDE 5 — Area cliente
# ---------------------------------------------------------------------------

slide = new_slide()
y = slide_title(slide, "Area cliente", "Il patrimonio è la prima cosa che si vede",
                "Aperta l'app, il numero che conta è già lì. Tutto il resto è a un tocco.")

phone(slide, MARGIN, y - Inches(0.05), Inches(4.4), "client")

tx = MARGIN + Inches(2.75)
tw = Inches(8.9)

features = [
    ("Home", "Patrimonio, variazione, andamento, proposte in attesa e ultime operazioni: una sola schermata, una sola richiesta al server."),
    ("Portafoglio", "Grafico dell'andamento con sette periodi, dalla giornata all'intero storico. Si tiene il dito sul grafico e si legge il valore giorno per giorno."),
    ("Investimenti", "Ogni posizione con controvalore, peso e rendimento. Il dettaglio tecnico c'è, ma un livello più sotto: non disturba chi vuole solo il quadro d'insieme."),
    ("Proposte e documenti", "Le proposte del consulente si leggono, si confrontano con la situazione attuale e si accettano. I PDF si aprono e si salvano."),
]

cy = y
for title_text, body in features:
    rect(slide, tx, cy + Inches(0.08), Inches(0.05), Inches(0.42), fill=ACCENT, radius=0.5)
    tf = textbox(slide, tx + Inches(0.28), cy, tw - Inches(0.3), Inches(0.95))
    para(tf, title_text, 15.5, TEXT, bold=True, first=True, space_after=5)
    para(tf, body, 13, MUTED, space_after=0, line_spacing=1.3)
    cy += Inches(1.13)

footer(slide)

# ---------------------------------------------------------------------------
# SLIDE 6 — Il patrimonio nel tempo (funzione chiave)
# ---------------------------------------------------------------------------

slide = new_slide()
y = slide_title(slide, "La funzione che fa la differenza", "«Quanto avevo il 15 giugno?»",
                "Si sceglie una data sul calendario e l'app mostra il patrimonio di quel giorno, con la sua composizione.")

# Riquadro sinistro: selettore data + valore
card(slide, MARGIN, y, Inches(5.55), Inches(3.85))

tf = textbox(slide, MARGIN + Inches(0.42), y + Inches(0.35), Inches(4.7), Inches(0.3))
para(tf, "DATA SELEZIONATA", 10, FAINT, bold=True, first=True, space_after=0)

datebox = rect(slide, MARGIN + Inches(0.42), y + Inches(0.68), Inches(4.7), Inches(0.62),
               fill=BG, line=BORDER, radius=0.12)
tf = textbox(slide, MARGIN + Inches(0.62), y + Inches(0.85), Inches(4.3), Inches(0.3))
para(tf, "15 giugno 2026", 16, TEXT, bold=True, first=True, space_after=0)

tf = textbox(slide, MARGIN + Inches(0.42), y + Inches(1.55), Inches(4.7), Inches(0.3))
para(tf, "PATRIMONIO A QUELLA DATA", 10, FAINT, bold=True, first=True, space_after=0)
tf = textbox(slide, MARGIN + Inches(0.42), y + Inches(1.85), Inches(4.7), Inches(0.6))
para(tf, "€ 297.698,57", 33, TEXT, bold=True, first=True, space_after=0)

alloc = [
    ("Azionario", "40,3%", "€ 120.076", ACCENT),
    ("Obbligazionario", "26,2%", "€ 77.928", TEAL),
    ("Fondi e ETF", "14,9%", "€ 44.447", VIOLET),
    ("Liquidità", "13,6%", "€ 40.526", RGBColor(0x64, 0x74, 0x8B)),
]

ay = y + Inches(2.55)
for name, pct, value, color in alloc:
    rect(slide, MARGIN + Inches(0.42), ay + Inches(0.045), Inches(0.11), Inches(0.11),
         fill=color, shape=MSO_SHAPE.OVAL)
    tf = textbox(slide, MARGIN + Inches(0.66), ay, Inches(2.0), Inches(0.22))
    para(tf, name, 11, TEXT, first=True, space_after=0)
    tf = textbox(slide, MARGIN + Inches(2.8), ay, Inches(0.8), Inches(0.22), align=PP_ALIGN.RIGHT)
    para(tf, pct, 11, MUTED, bold=True, first=True, space_after=0)
    tf = textbox(slide, MARGIN + Inches(3.7), ay, Inches(1.42), Inches(0.22), align=PP_ALIGN.RIGHT)
    para(tf, value, 11, TEXT, bold=True, first=True, space_after=0)
    ay += Inches(0.3)

# Riquadro destro: perché conta
rx = MARGIN + Inches(5.95)
rw = Inches(5.68)
card(slide, rx, y, rw, Inches(3.85), fill=NAVY, line_color=None)

tf = textbox(slide, rx + Inches(0.45), y + Inches(0.4), rw - Inches(0.9), Inches(0.5))
para(tf, "Perché conta", 20, WHITE, bold=True, first=True, space_after=12)

reasons = [
    ("È la domanda che i clienti fanno davvero",
     "«Quanto avevo prima di quell'operazione?». Oggi richiede una telefonata o una ricerca nella piattaforma."),
    ("Non è un numero finto",
     "Dietro c'è uno storico giorno per giorno: due anni di rilevazioni, con la composizione di ogni giornata."),
    ("Funziona anche sul grafico",
     "Si tiene il dito sulla curva e si leggono valore e data, come nelle app di investimento più diffuse."),
]

ry = y + Inches(1.05)
for title_text, body in reasons:
    rect(slide, rx + Inches(0.45), ry + Inches(0.06), Inches(0.045), Inches(0.32),
         fill=ACCENT_LIGHT, radius=0.5)
    tf = textbox(slide, rx + Inches(0.7), ry, rw - Inches(1.15), Inches(0.85))
    para(tf, title_text, 13.5, WHITE, bold=True, first=True, space_after=4)
    para(tf, body, 11.5, RGBColor(0xA8, 0xC0, 0xDC), space_after=0, line_spacing=1.25)
    ry += Inches(0.93)

footer(slide)

# ---------------------------------------------------------------------------
# SLIDE 7 — Le proposte
# ---------------------------------------------------------------------------

slide = new_slide()
y = slide_title(slide, "Proposte di investimento", "Dal consulente al cliente, in quattro passaggi",
                "Il percorso completo è già funzionante nel prototipo: si può provare dal vivo.")

steps = [
    ("1", "Il consulente prepara", "Sceglie cliente, importo e strumenti, guidato passo per passo."),
    ("2", "Il cliente riceve", "La proposta compare in home con il conteggio sulla scheda «Proposte»."),
    ("3", "Il cliente valuta", "Legge le operazioni, confronta la composizione attuale con quella proposta, apre il PDF."),
    ("4", "Il cliente risponde", "Accetta o rifiuta, con una nota facoltativa. Il consulente vede subito l'esito."),
]

cw = Inches(2.72)
gap = Inches(0.21)
for i, (num, title_text, body) in enumerate(steps):
    x = MARGIN + i * (cw + gap)
    card(slide, x, y, cw, Inches(2.15))
    circle = rect(slide, x + Inches(0.28), y + Inches(0.3), Inches(0.46), Inches(0.46),
                  fill=ACCENT, shape=MSO_SHAPE.OVAL)
    tf = textbox(slide, x + Inches(0.28), y + Inches(0.38), Inches(0.46), Inches(0.3),
                 align=PP_ALIGN.CENTER)
    para(tf, num, 14, WHITE, bold=True, first=True, space_after=0)

    tf = textbox(slide, x + Inches(0.28), y + Inches(0.95), cw - Inches(0.56), Inches(1.1))
    para(tf, title_text, 14.5, TEXT, bold=True, first=True, space_after=6)
    para(tf, body, 11.5, MUTED, space_after=0, line_spacing=1.25)

    if i < 3:
        line(slide, x + cw + Inches(0.03), y + Inches(0.53),
             x + cw + gap - Inches(0.03), y + Inches(0.53), color=RGBColor(0xC6, 0xD0, 0xDC), width=1.5)

# Stati
y2 = y + Inches(2.52)
tf = textbox(slide, MARGIN, y2, Inches(5), Inches(0.3))
para(tf, "QUATTRO STATI, SEMPRE CHIARI", 11, FAINT, bold=True, first=True, space_after=0)

states = [("In attesa", WARNING), ("Accettata", POSITIVE), ("Rifiutata", NEGATIVE), ("Scaduta", RGBColor(0x8A, 0x98, 0xAC))]
sx = MARGIN
for label_text, color in states:
    pill = rect(slide, sx, y2 + Inches(0.4), Inches(1.45), Inches(0.42), fill=WHITE, line=BORDER, radius=0.35)
    rect(slide, sx + Inches(0.18), y2 + Inches(0.555), Inches(0.13), Inches(0.13), fill=color, shape=MSO_SHAPE.OVAL)
    tf = textbox(slide, sx + Inches(0.4), y2 + Inches(0.5), Inches(1.0), Inches(0.25))
    para(tf, label_text, 11, TEXT, bold=True, first=True, space_after=0)
    sx += Inches(1.62)

# Nota sulla firma
nx = MARGIN + Inches(6.85)
card(slide, nx, y2 + Inches(0.1), Inches(4.78), Inches(1.3), fill=RGBColor(0xFB, 0xF0, 0xDE), line_color=None)
tf = textbox(slide, nx + Inches(0.38), y2 + Inches(0.32), Inches(4.05), Inches(0.9))
para(tf, "Nota importante", 12, WARNING, bold=True, first=True, space_after=5)
para(tf, "L'accettazione nel prototipo riproduce l'esperienza d'uso. "
         "Non sostituisce il vostro sistema ufficiale di firma.",
     11, RGBColor(0x7A, 0x4C, 0x0B), space_after=0, line_spacing=1.25)

footer(slide)

# ---------------------------------------------------------------------------
# SLIDE 8 — Area consulente
# ---------------------------------------------------------------------------

slide = new_slide()
y = slide_title(slide, "Area consulente", "Il lavoro quotidiano, dal telefono",
                "Vedere come stanno i clienti e preparare una proposta senza aprire il computer.")

left_w = Inches(5.55)
card_h8 = Inches(4.35)
card(slide, MARGIN, y, left_w, card_h8)
tf = textbox(slide, MARGIN + Inches(0.42), y + Inches(0.35), left_w - Inches(0.84), Inches(0.4))
para(tf, "I clienti assegnati", 17, TEXT, bold=True, first=True, space_after=12)

clients = [
    ("Francesco Fontana", "€ 634.554", "+15,4%", POSITIVE, "1 in attesa"),
    ("Andrea Longo", "€ 417.242", "+7,6%", POSITIVE, ""),
    ("Mario Rossi", "€ 308.443", "+19,2%", POSITIVE, "2 in attesa"),
    ("Valentina Colombo", "€ 301.723", "−1,2%", NEGATIVE, ""),
]

cy = y + Inches(0.95)
for name, value, delta, color, badge_text in clients:
    rect(slide, MARGIN + Inches(0.42), cy, left_w - Inches(0.84), Inches(0.62), fill=BG, line=BORDER, radius=0.12)
    rect(slide, MARGIN + Inches(0.58), cy + Inches(0.14), Inches(0.34), Inches(0.34),
         fill=NAVY, shape=MSO_SHAPE.OVAL)
    tf = textbox(slide, MARGIN + Inches(1.05), cy + Inches(0.1), Inches(2.4), Inches(0.25))
    para(tf, name, 11.5, TEXT, bold=True, first=True, space_after=2)
    if badge_text:
        para(tf, badge_text, 9, WARNING, bold=True, space_after=0)
    tf = textbox(slide, MARGIN + Inches(3.5), cy + Inches(0.11), Inches(1.5), Inches(0.25), align=PP_ALIGN.RIGHT)
    para(tf, value, 11.5, TEXT, bold=True, first=True, space_after=2)
    para(tf, delta, 9.5, color, bold=True, space_after=0)
    cy += Inches(0.72)

# Destra: creazione proposta
rx = MARGIN + Inches(5.95)
rw = Inches(5.68)
card(slide, rx, y, rw, card_h8)
tf = textbox(slide, rx + Inches(0.42), y + Inches(0.35), rw - Inches(0.84), Inches(0.4))
para(tf, "Creare una proposta: sei passaggi", 17, TEXT, bold=True, first=True, space_after=4)
para(tf, "Una domanda alla volta, con controllo immediato degli importi.", 12, MUTED, space_after=0)

wizard = ["Cliente", "Titolo e descrizione", "Importo e validità",
          "Operazioni sugli strumenti", "Nuova composizione", "Riepilogo e invio"]

wy = y + Inches(1.25)
for i, step in enumerate(wizard):
    filled = i < 6
    rect(slide, rx + Inches(0.45), wy + Inches(0.03), Inches(0.26), Inches(0.26),
         fill=ACCENT if filled else BORDER, shape=MSO_SHAPE.OVAL)
    tf = textbox(slide, rx + Inches(0.45), wy + Inches(0.065), Inches(0.26), Inches(0.2),
                 align=PP_ALIGN.CENTER)
    para(tf, str(i + 1), 9, WHITE, bold=True, first=True, space_after=0)
    tf = textbox(slide, rx + Inches(0.85), wy + Inches(0.03), rw - Inches(1.3), Inches(0.25))
    para(tf, step, 12.5, TEXT, first=True, space_after=0)
    if i < len(wizard) - 1:
        line(slide, rx + Inches(0.58), wy + Inches(0.3), rx + Inches(0.58), wy + Inches(0.41),
             color=RGBColor(0xC6, 0xD0, 0xDC), width=1.2)
    wy += Inches(0.40)

line(slide, rx + Inches(0.45), y + card_h8 - Inches(0.62),
     rx + rw - Inches(0.45), y + card_h8 - Inches(0.62), color=BORDER, width=1)
tf = textbox(slide, rx + Inches(0.45), y + card_h8 - Inches(0.46), rw - Inches(0.9), Inches(0.3))
para(tf, "Il PDF della proposta viene generato e allegato automaticamente.",
     11, FAINT, first=True, space_after=0)

footer(slide)

# ---------------------------------------------------------------------------
# SLIDE 9 — Area direzione
# ---------------------------------------------------------------------------

slide = new_slide()
y = slide_title(slide, "Area direzione", "L'andamento dell'azienda in una schermata",
                "Gli stessi dati di sempre, ma leggibili in trenta secondi dal telefono.")

kpis = [
    ("Patrimonio complessivo", "€ 15,3 Mln", "+9,0% sui 12 mesi", POSITIVE),
    ("Clienti", "20", "4 per consulente", MUTED),
    ("Consulenti", "5", "confronto sui risultati", MUTED),
    ("Tasso di accettazione", "57%", "delle proposte con risposta", POSITIVE),
]

cw = Inches(2.72)
gap = Inches(0.21)
for i, (label_text, value, hint, color) in enumerate(kpis):
    x = MARGIN + i * (cw + gap)
    card(slide, x, y, cw, Inches(1.62))
    tf = textbox(slide, x + Inches(0.28), y + Inches(0.28), cw - Inches(0.56), Inches(0.25))
    para(tf, label_text.upper(), 9.5, FAINT, bold=True, first=True, space_after=6)
    para(tf, value, 25, TEXT, bold=True, space_after=5)
    para(tf, hint, 10.5, color, space_after=0)

# Grafico schematico
y2 = y + Inches(2.0)
card(slide, MARGIN, y2, Inches(7.1), Inches(2.35))
tf = textbox(slide, MARGIN + Inches(0.4), y2 + Inches(0.28), Inches(5), Inches(0.25))
para(tf, "PATRIMONIO AZIENDALE · 12 MESI", 10, FAINT, bold=True, first=True, space_after=0)

pts = [0.18, 0.30, 0.24, 0.42, 0.38, 0.55, 0.50, 0.68, 0.74, 0.66, 0.85, 1.00]
gx = MARGIN + Inches(0.4)
gw = Inches(6.3)
gy = y2 + Inches(1.95)
amp = Inches(1.15)
span = gw / (len(pts) - 1)
line(slide, gx, gy, gx + gw, gy, color=BORDER, width=1)
for i in range(len(pts) - 1):
    line(slide, int(gx + i * span), int(gy - pts[i] * amp),
         int(gx + (i + 1) * span), int(gy - pts[i + 1] * amp), color=ACCENT, width=2.2)
rect(slide, int(gx + gw - Inches(0.07)), int(gy - amp - Inches(0.07)), Inches(0.14), Inches(0.14),
     fill=ACCENT, shape=MSO_SHAPE.OVAL)

# Confronto consulenti
rx = MARGIN + Inches(7.5)
rw = Inches(4.13)
card(slide, rx, y2, rw, Inches(2.35))
tf = textbox(slide, rx + Inches(0.35), y2 + Inches(0.28), rw - Inches(0.7), Inches(0.25))
para(tf, "PER CONSULENTE", 10, FAINT, bold=True, first=True, space_after=0)

bars = [("Sara M.", 1.00), ("Giulia F.", 0.98), ("Davide G.", 0.78), ("Marco C.", 0.53), ("Elena R.", 0.31)]
by = y2 + Inches(0.68)
for name, ratio in bars:
    tf = textbox(slide, rx + Inches(0.35), by, Inches(1.0), Inches(0.22))
    para(tf, name, 10, MUTED, first=True, space_after=0)
    track_w = Inches(2.35)
    rect(slide, rx + Inches(1.4), by + Inches(0.05), track_w, Inches(0.14), fill=BG, radius=0.5)
    rect(slide, rx + Inches(1.4), by + Inches(0.05), int(track_w * ratio), Inches(0.14),
         fill=ACCENT, radius=0.5)
    by += Inches(0.32)

footer(slide)

# ---------------------------------------------------------------------------
# SLIDE 10 — Demo dal vivo
# ---------------------------------------------------------------------------

slide = new_slide(NAVY)

tf = textbox(slide, MARGIN, Inches(1.5), Inches(6.4), Inches(0.4))
para(tf, "ADESSO", 12, ACCENT_LIGHT, bold=True, first=True, space_after=10)
para(tf, "Proviamola insieme", 40, WHITE, bold=True, space_after=14)
para(tf, "Dieci minuti sul telefono valgono più di qualunque slide.",
     16, RGBColor(0xA8, 0xC0, 0xDC), space_after=0)

# Il telefono riempie la metà sinistra: la slide annuncia una prova, non un elenco
phone(slide, MARGIN + Inches(0.9), Inches(3.15), Inches(3.3), "client", detailed=True)

demo = [
    ("Come cliente", "Patrimonio, grafico che si esplora col dito, il calendario che riporta al 15 giugno, una proposta accettata in due tocchi."),
    ("Come consulente", "La lista clienti, la scheda di uno di loro, e una proposta creata dal vivo."),
    ("Di nuovo cliente", "La proposta appena creata è già arrivata."),
    ("Come direzione", "Il quadro aziendale e il confronto fra consulenti."),
]

dy = Inches(1.55)
dx = MARGIN + Inches(6.9)
for i, (title_text, body) in enumerate(demo):
    rect(slide, dx, dy + Inches(0.05), Inches(0.42), Inches(0.42), fill=ACCENT, shape=MSO_SHAPE.OVAL)
    tf = textbox(slide, dx, dy + Inches(0.13), Inches(0.42), Inches(0.3), align=PP_ALIGN.CENTER)
    para(tf, str(i + 1), 13, WHITE, bold=True, first=True, space_after=0)
    tf = textbox(slide, dx + Inches(0.65), dy, Inches(4.1), Inches(1.0))
    para(tf, title_text, 15, WHITE, bold=True, first=True, space_after=5)
    para(tf, body, 12, RGBColor(0xA8, 0xC0, 0xDC), space_after=0, line_spacing=1.3)
    dy += Inches(1.2)

footer(slide, dark=True)

# ---------------------------------------------------------------------------
# SLIDE 11 — Come è fatto
# ---------------------------------------------------------------------------

slide = new_slide()
y = slide_title(slide, "Come è fatto", "Due pezzi, con un confine netto",
                "L'app non sa da dove arrivano i dati. È la scelta che rende semplice il passo successivo.")

# App
card(slide, MARGIN + Inches(1.6), y, Inches(8.4), Inches(1.35), fill=NAVY, line_color=None)
tf = textbox(slide, MARGIN + Inches(2.0), y + Inches(0.28), Inches(7.6), Inches(0.8))
para(tf, "APP MOBILE", 11, ACCENT_LIGHT, bold=True, first=True, space_after=5)
para(tf, "Android e iPhone, una sola base di codice", 17, WHITE, bold=True, space_after=4)
para(tf, "Conosce soltanto le nostre API: nessun collegamento diretto ad altri sistemi.",
     12, RGBColor(0xA8, 0xC0, 0xDC), space_after=0)

# Freccia
line(slide, W // 2, y + Inches(1.35), W // 2, y + Inches(1.85), color=RGBColor(0xC6, 0xD0, 0xDC), width=2)
tf = textbox(slide, W // 2 + Inches(0.15), y + Inches(1.42), Inches(3), Inches(0.3))
para(tf, "richieste protette da autenticazione", 10, FAINT, first=True, space_after=0)

# Backend
card(slide, MARGIN + Inches(1.6), y + Inches(1.85), Inches(8.4), Inches(2.55))
tf = textbox(slide, MARGIN + Inches(2.0), y + Inches(2.12), Inches(7.6), Inches(0.6))
para(tf, "SERVIZIO APPLICATIVO", 11, ACCENT, bold=True, first=True, space_after=5)
para(tf, "Regole, permessi, proposte, documenti, tracciamento", 17, TEXT, bold=True, space_after=0)

boxes = [
    ("Origine dati attuale", "Dati simulati del prototipo", POSITIVE, "IN USO"),
    ("Origine dati futura", "I vostri sistemi", FAINT, "DA COLLEGARE"),
]
bx = MARGIN + Inches(2.0)
for label_text, body, color, tag in boxes:
    card(slide, bx, y + Inches(2.95), Inches(3.7), Inches(1.2), fill=BG, line_color=BORDER)
    tf = textbox(slide, bx + Inches(0.3), y + Inches(3.15), Inches(3.1), Inches(0.8))
    para(tf, tag, 9, color, bold=True, first=True, space_after=5)
    para(tf, label_text, 13, TEXT, bold=True, space_after=3)
    para(tf, body, 11, MUTED, space_after=0)
    bx += Inches(4.0)

footer(slide)

# ---------------------------------------------------------------------------
# SLIDE 12 — Collegamento ai sistemi reali
# ---------------------------------------------------------------------------

slide = new_slide()
y = slide_title(slide, "Il passo successivo", "Collegare i vostri dati cambia un solo pezzo",
                "L'app, le schermate e le regole restano identiche. Si sostituisce la sorgente.")

card(slide, MARGIN, y, Inches(11.63), Inches(2.5))

col_w = Inches(3.5)
cx = MARGIN + Inches(0.5)

stages = [
    ("OGGI", "Prototipo", "Dati simulati", "Funziona in autonomia,\nsenza toccare i vostri sistemi.", POSITIVE),
    ("DOMANI", "Collegamento", "I vostri dati reali", "Si scrive un solo componente:\nquello che parla con i vostri sistemi.", ACCENT),
    ("RISULTATO", "Nessuna riscrittura", "Stessa app, stesse schermate", "Il lavoro fatto finora\nnon si butta via.", NAVY),
]

for i, (tag, title_text, subtitle, body, color) in enumerate(stages):
    tf = textbox(slide, cx, y + Inches(0.42), col_w, Inches(0.25))
    para(tf, tag, 10, color, bold=True, first=True, space_after=8)
    para(tf, title_text, 18, TEXT, bold=True, space_after=4)
    para(tf, subtitle, 12.5, MUTED, bold=True, space_after=8)
    para(tf, body, 11.5, MUTED, space_after=0, line_spacing=1.3)

    if i < 2:
        arrow_x = cx + col_w + Inches(0.08)
        line(slide, arrow_x, y + Inches(1.2), arrow_x + Inches(0.35), y + Inches(1.2),
             color=RGBColor(0xC6, 0xD0, 0xDC), width=2)
    cx += col_w + Inches(0.5)

y2 = y + Inches(2.85)
card(slide, MARGIN, y2, Inches(11.63), Inches(1.3), fill=NAVY, line_color=None)
tf = textbox(slide, MARGIN + Inches(0.5), y2 + Inches(0.28), Inches(10.6), Inches(0.85))
para(tf, "Cosa serve da voi, quando deciderete di procedere", 14.5, WHITE, bold=True, first=True, space_after=6)
para(tf, "Le credenziali di accesso ai vostri sistemi e la documentazione tecnica. "
         "Nient'altro: il prototipo continua a funzionare anche senza.",
     12.5, RGBColor(0xA8, 0xC0, 0xDC), space_after=0)

footer(slide)

# ---------------------------------------------------------------------------
# SLIDE 13 — Sicurezza
# ---------------------------------------------------------------------------

slide = new_slide()
y = slide_title(slide, "Sicurezza e controllo", "Ognuno vede solo ciò che gli compete",
                "Non è una regola scritta nell'app: è il servizio a decidere, e non si può aggirare.")

items = [
    ("Perimetro dei dati", "Il cliente accede solo alla propria posizione. Il consulente solo ai clienti assegnati. Nessuna richiesta può ampliare questo confine."),
    ("Accesso protetto", "Credenziali cifrate, sessione a scadenza, uscita che revoca l'accesso dal dispositivo."),
    ("Registro delle attività", "Accessi, proposte create, consultate, accettate e rifiutate: ogni azione resta tracciata con utente e data."),
    ("Dati sul telefono", "Solo le chiavi di sessione, nell'area cifrata del sistema operativo. Nessun dato patrimoniale salvato in locale."),
]

cw = Inches(5.55)
ch = Inches(1.72)
for i, (title_text, body) in enumerate(items):
    x = MARGIN + (i % 2) * (cw + Inches(0.53))
    yy = y + (i // 2) * (ch + Inches(0.35))
    card(slide, x, yy, cw, ch)
    rect(slide, x, yy, Inches(0.075), ch, fill=ACCENT, radius=0.5)
    tf = textbox(slide, x + Inches(0.45), yy + Inches(0.32), cw - Inches(0.85), Inches(1.1))
    para(tf, title_text, 15.5, TEXT, bold=True, first=True, space_after=6)
    para(tf, body, 12.5, MUTED, space_after=0, line_spacing=1.3)

footer(slide)

# ---------------------------------------------------------------------------
# SLIDE 14 — Qualità
# ---------------------------------------------------------------------------

slide = new_slide()
y = slide_title(slide, "Come è stato verificato", "Non è un prototipo «che sembra funzionare»",
                "Ogni parte è controllata automaticamente a ogni modifica.")

checks = [
    ("76", "verifiche automatiche sul servizio", "Accessi, permessi, patrimonio, storico, proposte, accettazioni, analisi."),
    ("40", "controlli app–servizio", "Le stesse chiamate delle schermate, con i campi che l'app legge davvero."),
    ("2", "piattaforme compilate", "L'app viene costruita per Android e iPhone a ogni verifica."),
]

cw = Inches(3.65)
gap = Inches(0.34)
for i, (number, label_text, body) in enumerate(checks):
    x = MARGIN + i * (cw + gap)
    card(slide, x, y, cw, Inches(2.1))
    tf = textbox(slide, x + Inches(0.32), y + Inches(0.32), cw - Inches(0.64), Inches(1.5))
    para(tf, number, 40, POSITIVE, bold=True, first=True, space_after=2)
    para(tf, label_text, 13.5, TEXT, bold=True, space_after=7)
    para(tf, body, 11.5, MUTED, space_after=0, line_spacing=1.25)

y2 = y + Inches(2.5)
tf = textbox(slide, MARGIN, y2, Inches(11.6), Inches(0.3))
para(tf, "COSA SIGNIFICA IN PRATICA", 11, FAINT, bold=True, first=True, space_after=12)

practical = [
    "Se una modifica rompe qualcosa, lo si scopre subito e non in demo.",
    "L'app e il servizio restano allineati: nessuna schermata che mostra dati sbagliati.",
    "Il codice è documentato in italiano: chi lo riprenderà in mano capirà le scelte fatte.",
]
tf = textbox(slide, MARGIN, y2 + Inches(0.45), Inches(11.6), Inches(1.4))
for i, text in enumerate(practical):
    para(tf, "—   " + text, 14, MUTED, first=(i == 0), space_after=10)

footer(slide)

# ---------------------------------------------------------------------------
# SLIDE 15 — Distribuzione
# ---------------------------------------------------------------------------

slide = new_slide()
y = slide_title(slide, "Come ve la facciamo provare", "Sui vostri telefoni, senza passare dagli store",
                "Distribuzione privata: l'app resta vostra e non è pubblica.")

card(slide, MARGIN, y, Inches(5.55), Inches(2.15))
rect(slide, MARGIN, y, Inches(5.55), Inches(0.075), fill=POSITIVE, radius=0.5)
tf = textbox(slide, MARGIN + Inches(0.42), y + Inches(0.4), Inches(4.7), Inches(2.0))
para(tf, "Android", 20, TEXT, bold=True, first=True, space_after=8)
para(tf, "Vi inviamo un file da installare direttamente, anche su Samsung.",
     13, MUTED, space_after=10, line_spacing=1.3)
para(tf, "Pronto in circa mezz'ora.  ·  Nessun costo.", 12, POSITIVE, bold=True, space_after=0)

card(slide, MARGIN + Inches(5.95), y, Inches(5.68), Inches(2.15))
rect(slide, MARGIN + Inches(5.95), y, Inches(5.68), Inches(0.075), fill=WARNING, radius=0.5)
tf = textbox(slide, MARGIN + Inches(6.37), y + Inches(0.4), Inches(4.8), Inches(2.0))
para(tf, "iPhone", 20, TEXT, bold=True, first=True, space_after=8)
para(tf, "Invito via TestFlight, l'applicazione ufficiale Apple per le prove.",
     13, MUTED, space_after=10, line_spacing=1.3)
para(tf, "Richiede un account sviluppatore Apple: 99 $ l'anno.", 12, WARNING, bold=True, space_after=0)

y2 = y + Inches(2.55)
card(slide, MARGIN, y2, Inches(11.63), Inches(1.5), fill=BG, line_color=BORDER)
tf = textbox(slide, MARGIN + Inches(0.5), y2 + Inches(0.28), Inches(10.6), Inches(1.0))
para(tf, "Serve anche un punto da cui l'app prende i dati", 14.5, TEXT, bold=True, first=True, space_after=6)
para(tf, "Per la presentazione di oggi è sufficiente un computer sulla stessa rete. "
         "Se volete tenere l'app in prova nelle settimane successive, prepariamo un ambiente "
         "dimostrativo raggiungibile da qualsiasi rete: mezza giornata di lavoro, costi trascurabili.",
     12.5, MUTED, space_after=0, line_spacing=1.3)

footer(slide)

# ---------------------------------------------------------------------------
# SLIDE 16 — Prossimi passi
# ---------------------------------------------------------------------------

slide = new_slide(NAVY)

tf = textbox(slide, MARGIN, Inches(0.95), Inches(11.6), Inches(0.4))
para(tf, "PROSSIMI PASSI", 12, ACCENT_LIGHT, bold=True, first=True, space_after=10)
para(tf, "Se la direzione vi convince", 36, WHITE, bold=True, space_after=0)

steps = [
    ("Subito", "Provate l'app", "Vi lasciamo il file da installare e le credenziali dimostrative: usatela qualche giorno e diteci cosa manca."),
    ("Poi", "Decidiamo il perimetro", "Quali funzioni entrano nella prima versione vera e quali possono attendere."),
    ("Quindi", "Colleghiamo i vostri dati", "Con le credenziali dei vostri sistemi, l'app passa dai dati simulati a quelli reali."),
    ("Infine", "Firma e notifiche", "Si collega il vostro sistema di accettazione ufficiale e si attivano gli avvisi sul telefono."),
]

sy = Inches(2.1)
for i, (when, title_text, body) in enumerate(steps):
    card(slide, MARGIN, sy, Inches(11.63), Inches(0.98), fill=RGBColor(0x14, 0x30, 0x4C), line_color=None)
    tf = textbox(slide, MARGIN + Inches(0.42), sy + Inches(0.3), Inches(1.2), Inches(0.3))
    para(tf, when.upper(), 10, ACCENT_LIGHT, bold=True, first=True, space_after=0)
    tf = textbox(slide, MARGIN + Inches(1.85), sy + Inches(0.24), Inches(2.7), Inches(0.4))
    para(tf, title_text, 15, WHITE, bold=True, first=True, space_after=0)
    tf = textbox(slide, MARGIN + Inches(4.7), sy + Inches(0.28), Inches(6.6), Inches(0.5))
    para(tf, body, 12, RGBColor(0xA8, 0xC0, 0xDC), first=True, space_after=0, line_spacing=1.2)
    sy += Inches(1.08)

tf = textbox(slide, MARGIN, Inches(6.55), Inches(11.6), Inches(0.4))
para(tf, "I dati mostrati sono simulati. L'accettazione delle proposte riproduce l'esperienza "
         "d'uso e non sostituisce il vostro sistema di firma ufficiale.",
     10.5, RGBColor(0x7E, 0x98, 0xB8), first=True, space_after=0)

footer(slide, dark=True)

# ---------------------------------------------------------------------------

output = Path(__file__).resolve().parent / "Prototipo-App-Mobile.pptx"
prs.save(output)
print(f"Presentazione creata: {output}")
print(f"Slide totali: {len(prs.slides.__iter__.__self__._sldIdLst)}")
