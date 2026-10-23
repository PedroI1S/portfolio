#!/usr/bin/env python3
"""Generate the otherweather° studio homepage, work index and project stories.

All pages are produced from the canonical catalog in docs/projects.json.
The finished concepts at /work/<slug>/ are never touched.

    python3 scripts/build_portfolio.py           # write pages
    python3 scripts/build_portfolio.py --check   # fail if generated pages are stale
"""
import argparse
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
STUDIO = SITE / "_studio"
EMAIL = "pedromariano.s@outlook.com"
FEATURED = ["challenger-deep", "mossline", "sort", "house-of-vey", "thimble-planet", "snack-atlas"]
ASSET_VERSION = "4"

DAY = {"background": "#F0F1ED", "ink": "#101317"}
FOG = {"background": "#E6EAEC", "ink": "#101317"}
DUSK = {"background": "#2A3348", "ink": "#EEF0F4"}
NIGHT = {"background": "#10151F", "ink": "#E9ECF2"}
DEEP = {"background": "#07090C", "ink": "#E9ECF2"}
INDEX = {"background": "#0C0E11", "ink": "#ECEEE9"}


def e(value):
    return html.escape(str(value), quote=True)


def luminance(hex_color):
    channels = [int(hex_color.lstrip("#")[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def theme(palette):
    return "dark" if luminance(palette["background"]) < 0.35 else "light"


def tone(palette):
    """Attributes that let the header adopt the colors of the section beneath it."""
    return (f'data-tone="{theme(palette)}" data-bg="{palette["background"]}" data-ink="{palette["ink"]}" '
            f'style="--bg:{palette["background"]};--ink:{palette["ink"]}"')


def split_title(name):
    """Break long names over two balanced lines for display headings."""
    words = name.split()
    if len(words) < 2 or len(name) < 10:
        return e(name)
    best = min(range(1, len(words)), key=lambda i: abs(len(" ".join(words[:i])) - len(" ".join(words[i:]))))
    return e(" ".join(words[:best])) + "<br>" + e(" ".join(words[best:]))


# ---------------------------------------------------------------- media ----

def poster(p, device="desktop"):
    return p["media"][device]


def clip(p, device="desktop", cls="", play="visible", label=None):
    """A lazy, muted interaction clip. main.js assigns the source when it is needed."""
    width, height = (1440, 900) if device == "desktop" else (390, 844)
    a11y = f'aria-label="{e(label)}"' if label else 'aria-hidden="true"'
    return (f'<video class="clip {cls}" muted loop playsinline preload="none" disablepictureinpicture '
            f'width="{width}" height="{height}" poster="{poster(p, device)}" '
            f'data-src="{p["media"][device + "Clip"]}" data-play="{play}" {a11y}></video>')


def image(p, device="desktop", cls="", eager=False):
    width, height = (1440, 900) if device == "desktop" else (390, 844)
    return (f'<img class="{cls}" src="{poster(p, device)}" width="{width}" height="{height}" alt="" '
            f'loading="{"eager" if eager else "lazy"}" decoding="async">')


def devices(p, caption=True, label=True, vt=False):
    """Desktop browser frame plus phone, both playing the concept's own captures."""
    desktop_label = f'{p["name"]}: {p["signature"]} (desktop capture)' if label else None
    phone_label = f'{p["name"]} on a phone (capture)' if label else None
    cap = p.get("mobileSignature") or "Designed for desktop and phone"
    caption_html = f'<figcaption class="mono">{e(cap)}</figcaption>' if caption else ""
    vt_attr = ' data-vt-media' if vt else ''
    return (f'<figure class="devices" data-tilt>'
            f'<div class="device-desktop"{vt_attr}><div class="device-bar" aria-hidden="true"><i></i><i></i><i></i>'
            f'<span>{e(p["path"])}</span></div><div class="device-screen">{clip(p, "desktop", label=desktop_label)}</div></div>'
            f'<div class="device-phone"><div class="device-screen">{clip(p, "phone", label=phone_label)}</div></div>'
            f'{caption_html}</figure>')


# ---------------------------------------------------------------- shell ----

def header():
    return ('<a class="skip-link" href="#main">Skip to content</a>'
            '<header class="site-header">'
            '<a class="wordmark" href="/" aria-label="otherweather, home">otherweather<span aria-hidden="true">°</span></a>'
            '<p class="conditions mono"><span>São Paulo</span> <time data-clock>UTC−03</time><span data-weather></span></p>'
            '<nav aria-label="Main"><a href="/work/" data-nav="work">Work</a><a href="/#studio" data-nav="studio">Studio</a>'
            '<a class="nav-contact" href="/#contact" data-nav="contact">Start a project <span aria-hidden="true">↗</span></a></nav>'
            '</header>')


def footer():
    letters = "".join(f'<span>{letter}</span>' for letter in "otherweather")
    return (f'<footer class="site-footer" {tone(DEEP)}>'
            f'<a class="footer-word" href="/" aria-label="otherweather, home" data-stretch><span class="footer-letters" aria-hidden="true">{letters}</span><sup aria-hidden="true">°</sup></a>'
            f'<div class="footer-meta mono"><span>Independent studio · São Paulo, BR</span>'
            f'<a href="mailto:{EMAIL}">{EMAIL}</a><span>© 2026 otherweather</span>'
            f'<a href="#top">Back to the surface ↑</a></div></footer>')


def document(name, description, body, page, palette, social="/_studio/social.jpg"):
    v = ASSET_VERSION
    return f'''<!doctype html>
<html lang="en" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{e(name)} — otherweather°</title>
<meta name="description" content="{e(description)}">
<meta name="theme-color" content="{palette["background"]}">
<meta property="og:type" content="website">
<meta property="og:title" content="{e(name)} — otherweather°">
<meta property="og:description" content="{e(description)}">
<meta property="og:image" content="{social}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/_studio/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/_studio/fonts/mona-sans-latin-standard-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/_studio/style.css?v={v}">
<script>document.documentElement.classList.replace('no-js','js')</script>
<script type="module" src="/_studio/main.js?v={v}"></script>
</head>
<body id="top" data-page="{page}" style="--page-bg:{palette["background"]};--page-ink:{palette["ink"]}">
{header()}
{body}
{footer()}
<div class="cursor" aria-hidden="true"><span></span></div>
<div class="page-wipe" aria-hidden="true"></div>
</body>
</html>
'''


# ----------------------------------------------------------------- home ----

def home(projects):
    by_slug = {p["slug"]: p for p in projects}
    featured = [by_slug[slug] for slug in FEATURED]
    reel = featured + [p for p in projects if p["slug"] not in FEATURED]

    # 1. The fogged window --------------------------------------------------
    first = reel[0]
    ticks = "".join(f'<i data-tick="{i}"></i>' for i in range(len(reel)))
    reel_data = e(json.dumps([{"slug": p["slug"], "name": p["name"], "n": p["number"],
                               "desktop": p["media"]["desktopClip"], "phone": p["media"]["phoneClip"],
                               "dposter": p["media"]["desktop"], "pposter": p["media"]["phone"]} for p in reel],
                              ensure_ascii=False, separators=(",", ":")))
    hero = f'''<section class="hero" {tone(FOG)} data-fog="day" aria-labelledby="hero-title">
<div class="hero-behind" aria-hidden="true"><video class="behind-video" muted playsinline preload="none" disablepictureinpicture poster="{first["media"]["desktop"]}" data-reel="{reel_data}"></video></div>
<div class="fog-static" aria-hidden="true"></div>
<canvas class="fog-canvas" aria-hidden="true"></canvas>
<canvas class="fog-fx" aria-hidden="true"></canvas>
<div class="hero-content">
<p class="eyebrow mono blend">Independent by nature. Different by design.</p>
<h1 id="hero-title" class="hero-title"><span class="blend">A different</span><br><span class="blend">atmosphere</span><br><span class="blend">for the web</span><span class="blue">.</span></h1>
<div class="hero-intro"><p class="blend">Distinctive websites, motion and interactive experiences. From São Paulo, for everywhere.</p>
<div class="hero-actions"><a class="button button-blue" href="#work">Explore the work <span aria-hidden="true">↓</span></a><a class="text-link blend" href="#contact">Start a project <span aria-hidden="true">↗</span></a></div></div>
</div>
<div class="hero-bottom mono">
<p class="behind blend"><span>Behind the glass</span> <a href="/projects/{first["slug"]}/" data-behind-link><span data-behind-number>{first["number"]:02d}</span> / <span data-behind-name>{e(first["name"])}</span> ↗</a></p>
<p class="behind-ticks" aria-hidden="true">{ticks}</p>
<p class="wipe-hint blend" aria-hidden="true">Wipe the glass ↔</p>
</div>
</section>'''

    # 2. Statement with inline interaction clips ----------------------------
    def pill(slug, word):
        p = by_slug[slug]
        return (f'<a class="pill" href="/projects/{slug}/" aria-label="{e(p["name"])}: {e(word)}" data-cursor="View">'
                f'{clip(p, "desktop")}</a>')

    statement = f'''<section id="statement" class="statement" {tone(DAY)} aria-label="About the studio">
<p class="eyebrow mono">01 / A change in atmosphere</p>
<h2 class="statement-text" data-words>otherweather is an independent studio for distinctive websites {pill("cal-sombra", "websites")}, motion {pill("challenger-deep", "motion")} and interactive experiences {pill("thimble-planet", "interactive experiences")}. Every project gets its own climate {pill("mossline", "climate")}<span class="blue">.</span></h2>
<div class="statement-foot mono"><span>One studio. No default setting.</span><a href="#work">The forecast / selected work ↓</a></div>
</section>'''

    # 3. The forecast: six stacked weather fronts ---------------------------
    scenes = []
    for i, p in enumerate(featured):
        tags = " · ".join(t.replace("-", " ").replace("interaction", "3D & interaction") for t in p["tags"])
        index = "".join('<li aria-current="step">%02d</li>' % (j + 1) if j == i else '<li>%02d</li>' % (j + 1) for j in range(len(featured)))
        scenes.append(f'''<section class="forecast" {tone(p["palette"])} data-scene aria-labelledby="forecast-{p["slug"]}">
<div class="front-edge" aria-hidden="true"></div>
<div class="forecast-inner">
<div class="forecast-copy">
<p class="eyebrow mono"><span>The forecast</span> <span>{i + 1:02d} — {len(featured):02d}</span></p>
<h2 id="forecast-{p["slug"]}" class="forecast-title" data-vt-title>{split_title("Challenger Deep" if p["slug"] == "challenger-deep" else p["name"])}</h2>
<p class="forecast-line">{e(p["forecast"] or p["premise"])}</p>
<div class="forecast-try"><p class="mono">Try in the concept</p><p>{e(p["signature"])}</p></div>
<p class="forecast-tags mono">{e(p["style"])} · {e(tags)}</p>
<div class="forecast-links"><a class="button button-ink" href="/projects/{p["slug"]}/">View project <span aria-hidden="true">→</span></a><a class="text-link" href="{p["path"]}" data-live data-color="{p["palette"]["background"]}">Open live concept <span aria-hidden="true">↗</span></a></div>
</div>
<a class="forecast-media" href="/projects/{p["slug"]}/" data-cursor="View" aria-label="View {e(p["name"])} project">{devices(p, label=False)}</a>
</div>
<ol class="forecast-index mono" aria-hidden="true">{index}</ol>
</section>''')
        scenes.append('<div class="forecast-dwell" aria-hidden="true"></div>')
    forecast = f'<div id="work" class="forecast-stack">{"".join(scenes)}</div>'

    # 4. 25 atmospheres -----------------------------------------------------
    cards = "".join(f'''<article class="strip-card" data-style="{e(p["style"])}" data-number="{p["number"]:02d}">
<a href="/projects/{p["slug"]}/" data-cursor="View" data-hover-play>
<div class="strip-media" data-vt-media>{clip(p, "desktop", play="hover")}<div class="strip-phone">{image(p, "phone")}</div></div>
<div class="strip-head"><h3 data-vt-title>{e(p["name"])}</h3><span class="mono">{p["number"]:02d}</span></div>
<p>{e(p["signature"])}</p></a></article>''' for p in projects)
    collection = f'''<section class="collection" {tone(DAY)} aria-labelledby="collection-title">
<div class="collection-head">
<div><p class="eyebrow mono">02 / The full outlook</p><h2 id="collection-title">25 atmospheres<span class="blue">.</span></h2></div>
<div class="collection-meta mono"><p><span data-strip-count>01</span> / {len(projects)}<br><span data-strip-style>{e(projects[0]["style"])}</span></p>
<div class="strip-buttons"><button type="button" data-strip="-1" aria-label="Previous projects">←</button><button type="button" data-strip="1" aria-label="Next projects">→</button></div></div>
</div>
<div class="collection-track" tabindex="0" role="region" aria-label="All {len(projects)} projects. Scroll sideways or use the arrow keys." data-cursor="Drag">
<div class="collection-rail">{cards}<a class="strip-end" href="/work/">All {len(projects)}.<br>Every climate.<span class="mono">Explore the collection ↗</span></a></div>
</div>
<div class="collection-foot mono"><div class="strip-progress" aria-hidden="true"><span></span></div><a class="text-link" href="/work/">Explore all {len(projects)} <span aria-hidden="true">↗</span></a></div>
</section>'''

    # 5. Studio -------------------------------------------------------------
    isobars = "".join(f'<path d="M-20 {20 + i * 12} Q300 {20 + i * 12} 620 {20 + i * 12}"/>' for i in range(14))
    studio = f'''<section id="studio" class="studio" {tone(DUSK)} aria-labelledby="studio-title">
<div class="studio-intro">
<p class="eyebrow mono">03 / A small studio, a wide horizon</p>
<h2 id="studio-title">Made with<br>perspective<span class="blue">.</span></h2>
<p>otherweather is Pedro’s independent web studio in São Paulo. A place for thoughtful design, creative code and the details that make a website feel like itself.</p>
<p>From the first idea to the final interaction, design and development move together.</p>
<p class="coords mono"><span>23°33′ S<br>46°38′ W</span><span>São Paulo, Brazil<br>Working across time zones</span></p>
</div>
<div class="capabilities">
<article class="capability"><p class="mono">01 / Website design</p><h3>A point of view.<br>At every width.</h3><p>Visual systems with character, from the largest desktop to the smallest screen.</p>
<div class="toy type-toy" data-type-toy aria-hidden="true">Different.</div>
<p class="proof mono"><a href="/projects/cal-sombra/">Cal &amp; Sombra ↗</a><a href="/projects/fieldbook/">Fieldbook ↗</a></p></article>
<article class="capability"><p class="mono">02 / Creative development</p><h3>Ideas you can<br>put your hands on.</h3><p>Creative code turns a visual idea into a responsive, tangible experience.</p>
<svg class="toy isobar-toy" data-isobar-toy viewBox="0 0 600 190" aria-hidden="true">{isobars}</svg>
<p class="proof mono"><a href="/projects/thimble-planet/">Thimble Planet ↗</a><a href="/projects/seedfile/">Seedfile ↗</a></p></article>
<article class="capability"><p class="mono">03 / Motion &amp; interactive storytelling</p><h3>Movement<br>with a reason.</h3><p>Scroll, time and interaction give a story its rhythm. You set the pace.</p>
<div class="toy timeline-toy" data-timeline-toy aria-hidden="true"><span>01</span><span>02</span><span>03</span><span>04</span><i></i></div>
<p class="proof mono"><a href="/projects/challenger-deep/">Challenger Deep ↗</a><a href="/projects/night-train/">Night Train ↗</a></p></article>
</div>
</section>'''

    # 6. Process barometer --------------------------------------------------
    stages = [("Direction", "Find the atmosphere.", "A conversation about your audience, ambitions and what the website needs to do.", "A clear brief and creative direction."),
              ("Design", "Give the idea a shape.", "Typography, composition and motion studies become a coherent visual language.", "A responsive design to build from."),
              ("Build", "Make it feel alive.", "Design becomes a working website. Interaction, movement and responsive behavior are developed together.", "A working website on every device."),
              ("Refine & launch", "Every last degree.", "Test the experience across devices, refine the details, and prepare the website for launch.", "A launched site and a clear handover.")]
    steps = "".join(f'<li class="process-step" data-step="{i}"><p class="mono">0{i + 1} / {e(name)}</p><h3>{e(claim)}</h3><p>{e(body)}</p><p class="deliver mono">You receive: {e(out)}</p></li>' for i, (name, claim, body, out) in enumerate(stages))
    ticks_svg = "".join(f'<line x1="300" y1="{48 if i % 5 == 0 else 62}" x2="300" y2="78" transform="rotate({-90 + i * 3} 300 320)"/>' for i in range(61))
    process = f'''<section class="process" {tone(NIGHT)} aria-labelledby="process-title">
<div class="process-dial-wrap">
<p class="eyebrow mono">04 / How the weather changes</p>
<h2 id="process-title">From a first thought<br>to out in the world.</h2>
<div class="barometer" aria-hidden="true"><svg viewBox="0 0 600 340"><g class="dial-ticks">{ticks_svg}</g>
<path class="dial-arc" d="M40 320 A260 260 0 0 1 560 320"/><g class="needle"><path d="M300 320 L300 70"/><circle cx="300" cy="320" r="8"/></g>
<text x="300" y="300" text-anchor="middle">otherweather°</text></svg>
<p class="dial-labels mono"><span>Direction</span><span>Design</span><span>Build</span><span>Launch</span></p></div>
</div>
<ol class="process-steps">{steps}</ol>
</section>'''

    # 7. Contact bookend -------------------------------------------------------
    contact = f'''<section id="contact" class="contact" {tone(DEEP)} data-fog="night" aria-labelledby="contact-title">
<div class="city-lights" aria-hidden="true"></div>
<div class="fog-static" aria-hidden="true"></div>
<canvas class="fog-canvas" aria-hidden="true"></canvas>
<canvas class="fog-fx" aria-hidden="true"></canvas>
<div class="contact-content">
<p class="eyebrow mono">05 / Good things start with a conversation</p>
<h2 id="contact-title">What are you<br>imagining<span class="blue">?</span></h2>
<div class="contact-actions"><a class="button button-blue button-large magnetic" href="mailto:{EMAIL}" data-cursor="Say hello">Start a project <span aria-hidden="true">↗</span></a>
<a class="contact-mail" href="mailto:{EMAIL}"><span class="mono">Or write directly</span>{EMAIL}</a></div>
<p class="contact-note">A first thought, a half-formed idea, a clear brief. There’s a good place to begin.</p>
</div>
</section>'''

    return f'<main id="main">{hero}{statement}{forecast}{collection}{studio}{process}{contact}</main>'


# ---------------------------------------------------------------- index ----

FILTERS = [("all", "All"), ("web-design", "Web design"), ("motion", "Motion"), ("interaction", "3D & interaction")]


def index(projects):
    rows = "".join(f'''<li class="work-row" data-tags="{" ".join(p["tags"])}" data-slug="{p["slug"]}" data-bg="{p["palette"]["background"]}" data-name="{e(p["name"])}">
<a class="row-main" href="/projects/{p["slug"]}/" data-cursor="Open">
<span class="row-number mono">{p["number"]:02d}</span>
<span class="row-media" data-vt-media>{clip(p, "desktop", "row-desktop", play="row")}{clip(p, "phone", "row-phone", play="row")}</span>
<h2 class="row-name" data-vt-title>{e(p["name"])}</h2>
<span class="row-style mono">{e(p["style"])}</span>
<span class="row-signature">{e(p["signature"])}</span>
<span class="row-arrow" aria-hidden="true">↗</span>
</a>
<a class="row-live mono" href="{p["path"]}" data-live data-color="{p["palette"]["background"]}">Open live concept ↗</a>
</li>''' for p in projects)
    filters = "".join(
        f'<button type="button" data-filter="{key}" aria-pressed="{"true" if key == "all" else "false"}">{e(label)} <span>{(len(projects) if key == "all" else sum(key in p["tags"] for p in projects)):02d}</span></button>'
        for key, label in FILTERS)
    return f'''<main id="main" class="work-index" {tone(INDEX)}>
<div class="index-tint" aria-hidden="true"></div>
<header class="index-head">
<p class="eyebrow mono">The collection / {len(projects)} self-initiated concepts</p>
<h1>Work &amp;<br>explorations<span class="blue">.</span></h1>
<p class="index-lede">{len(projects)} different subjects, {len(projects)} different ways in. Self-initiated websites, each with its own atmosphere and something to try.</p>
</header>
<div class="index-toolbar">
<div class="filters" role="group" aria-label="Filter projects">{filters}</div>
<button class="phone-toggle" type="button" aria-pressed="false">Phone view <span aria-hidden="true">↔</span></button>
</div>
<p class="filter-status mono" role="status" aria-live="polite">Showing all {len(projects)} concepts</p>
<div class="index-columns mono" aria-hidden="true"><span>No.</span><span>Project</span><span>Atmosphere</span><span>Try it</span></div>
<ol class="work-list">{rows}</ol>
<div class="index-enquiry"><p>A different atmosphere<br>for your next project?</p><a class="button button-blue" href="/#contact">Let’s talk <span aria-hidden="true">↗</span></a></div>
<div class="index-preview" aria-hidden="true"><div class="preview-frame"><img alt="" src="{poster(projects[0])}" width="1440" height="900"><video muted loop playsinline preload="none" disablepictureinpicture></video></div><span class="mono"></span></div>
</main>'''


# ---------------------------------------------------------------- story ----

def story(p, next_project):
    pal = p["palette"]
    live = f'href="{p["path"]}" data-live data-color="{pal["background"]}"'
    brief = "".join(f'<div><p class="mono">{label}</p><p>{e(p["brief"][key])}</p></div>'
                    for key, label in [("subject", "The imagined subject"), ("visitor", "The visitor"), ("question", "The design question")])
    interactions = "".join(f'<li><span class="mono">{i + 1:02d}</span><p>{e(text)}</p></li>' for i, text in enumerate(p["interactions"]))
    decisions = []
    for i, d in enumerate(p["decisions"]):
        device = "desktop" if i % 2 == 0 else "phone"
        artifact_label = f"{p['name']}, {device} capture for: {d['title']}"
        artifact = (f'<div class="decision-artifact is-{device}"><div class="device-{device}"><div class="device-screen">'
                    f'{clip(p, device, label=artifact_label)}</div></div>'
                    f'<p class="mono">{"Desktop" if device == "desktop" else "Phone"} capture</p></div>')
        decisions.append(f'<article class="decision{" is-flipped" if i % 2 else ""}"><div class="decision-copy"><p class="eyebrow mono">Decision / {i + 1:02d}</p>'
                         f'<h3>{e(d["title"])}</h3><p>{e(d["body"])}</p></div>{artifact}</article>')
    playable = p.get("embedEnabled", False)
    if playable:
        overlay = (f'<button type="button" class="button button-blue play-concept" data-src="{p["path"]}">Play it here <span aria-hidden="true">▷</span></button>')
        note = "Loads the real concept inside this frame. Press Stop or Esc to return to the story."
    else:
        overlay = f'<a class="button button-blue" {live}>Open the live concept <span aria-hidden="true">↗</span></a>'
        note = (p.get("embedNote") or "This concept is best experienced full screen.") + " The capture shows its interaction."
    nxt = next_project
    return f'''<main id="main" class="story" data-slug="{p["slug"]}">
<section class="story-hero" {tone(pal)}>
<p class="crumbs mono"><a href="/work/">All work</a><span>/ {p["number"]:02d}</span><span>Self-initiated concept</span></p>
<h1 class="story-title" data-vt-title style="view-transition-name:vt-title">{e(p["name"])}<span class="blue" aria-hidden="true">°</span></h1>
<div class="story-intro"><p class="story-premise">{e(p["premise"])}</p>
<div class="story-meta"><p class="mono">{e(p["style"])}<br>{e(" · ".join(t.replace("-", " ") for t in p["tags"]))}</p><a class="button button-ink" {live}>Open live concept <span aria-hidden="true">↗</span></a></div></div>
<div class="story-devices" style="view-transition-name:vt-media">{devices(p)}</div>
<p class="story-signature"><span class="mono">The signature interaction</span>{e(p["signature"])}</p>
</section>
<section class="story-brief" {tone(pal)}>
<p class="eyebrow mono">01 / The brief</p>
<div class="brief-grid">{brief}</div>
</section>
<section class="play" {tone(pal)} aria-labelledby="play-title">
<div class="play-head"><div><p class="eyebrow mono">02 / From looking to doing</p><h2 id="play-title">Play it here<span class="blue">.</span></h2></div>
<div class="device-toggle" role="group" aria-label="Device"><button type="button" data-device="phone" aria-pressed="true">Phone</button><button type="button" data-device="desktop" aria-pressed="false">Desktop</button></div></div>
<div class="play-stage" data-embed="{str(playable).lower()}" data-view="phone" data-slug="{p["slug"]}">
<div class="play-device"><div class="play-screen">
<video class="clip play-clip" muted loop playsinline preload="none" disablepictureinpicture width="390" height="844" poster="{poster(p, "phone")}" data-src="{p["media"]["phoneClip"]}" data-play="visible" aria-label="{e(p["name"])} interaction capture"></video>
<div class="embed-target"></div>
<div class="play-overlay">{overlay}</div>
</div></div>
<div class="play-side"><p class="mono">What to try</p><ol class="interactions">{interactions}</ol>
<p class="play-note mono">{e(note)}</p>
<div class="play-actions"><button type="button" class="stop-concept text-link" hidden>Stop concept ×</button><a class="text-link" {live}>Open full screen <span aria-hidden="true">↗</span></a></div></div>
</div>
</section>
<section class="decisions" {tone(pal)}>
<p class="eyebrow mono">03 / Decisions that shape the experience</p>
{"".join(decisions)}
</section>
<section class="credits" {tone(pal)}>
<p class="eyebrow mono">04 / Scope &amp; credits</p>
<div class="credits-body"><p>{e(p["credits"])}</p><p>Portfolio concept by Pedro / otherweather. Design, creative development, motion and responsive implementation.</p><a class="text-link" {live}>View the concept and its original credits <span aria-hidden="true">↗</span></a></div>
</section>
<section class="next-project" {tone(nxt["palette"])}>
<p class="eyebrow mono">Next atmosphere / {nxt["number"]:02d}</p>
<a class="next-link" href="/projects/{nxt["slug"]}/" data-cursor="Next" data-hover-play><span class="next-media" data-vt-media>{clip(nxt, "desktop", play="hover")}</span><h2 data-vt-title>{e(nxt["name"])} <span aria-hidden="true">→</span></h2><p>{e(nxt["premise"])}</p></a>
<div class="next-links"><a class="text-link" href="/work/">All concepts <span aria-hidden="true">↗</span></a><a class="text-link" href="/#contact">Have something in mind? <span aria-hidden="true">↗</span></a></div>
</section>
</main>'''


# ----------------------------------------------------------------- main ----

def outputs(projects):
    files = {
        STUDIO / "projects.json": json.dumps(projects, ensure_ascii=False, indent=2) + "\n",
        SITE / "index.html": document(
            "A different atmosphere for the web",
            "Independent studio in São Paulo for distinctive websites, motion and interactive experiences. Explore 25 self-initiated concepts.",
            home(projects), "home", FOG),
        SITE / "work/index.html": document(
            "Work & explorations",
            "25 self-initiated website concepts. Browse by design, motion and 3D interaction, on desktop and phone.",
            index(projects), "work", INDEX),
    }
    for i, p in enumerate(projects):
        files[SITE / "projects" / p["slug"] / "index.html"] = document(
            p["name"], p["premise"], story(p, projects[(i + 1) % len(projects)]), "story", p["palette"], poster(p))
    return files


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", action="store_true", help="Check generated pages without writing files")
    args = parser.parse_args()
    projects = json.loads((ROOT / "docs/projects.json").read_text())["projects"]
    files = outputs(projects)
    if args.check:
        stale = [str(path.relative_to(ROOT)) for path, content in files.items()
                 if not path.is_file() or path.read_text() != content]
        if stale:
            raise SystemExit("Run python3 scripts/build_portfolio.py; generated files differ:\n" + "\n".join(stale))
        print(f"OK: {len(files)} generated portfolio files match the catalog.")
        return
    for path, content in files.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
    print(f"Generated homepage, work index and {len(projects)} stories.")


if __name__ == "__main__":
    main()
