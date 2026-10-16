---
name: frontend-style-guideline
description: Style guideline v1.2 for our fintech product's frontend. Use whenever building or restyling any UI (landing page, app screen, component) so it gets a bold, confident look with seamless scroll-driven transitions. The tokens are defaults; a direction picked with frontend-design-explorer overrides them.
---

# Style Guideline v1.2

Product: a fintech app. The UI must feel trustworthy, clear and confident, with bold type that grabs attention and sections that expand and settle smoothly as the user scrolls.

## Ground rules
- Original look only. Do not imitate any existing brand's logo, palette, font or layouts. Use our own product name and mark.
- Everything is a CSS variable, so switching to another direction means swapping values, not rewriting components.
- Hackathon time budget: tokens first (10 min), scroll sections second, visual effects last.
- If a direction was chosen with frontend-design-explorer, its token block overrides section 1 and its signature moment overrides the default scroll pattern in section 5.

## 0. Design Read and dials (do this before building any screen)
State a one-line Design Read first: screen type, audience, vibe words and the dial values. Ask at most one question, and only if the read is genuinely unclear.
Example: "Design Read: landing hero for first-time savers, calm but bold, variance 6 / motion 7 / density 3."

| Dial (1-10) | 1-3 | 4-7 | 8-10 | Default |
|---|---|---|---|---|
| DESIGN_VARIANCE | symmetrical, predictable | some asymmetry | experimental, asymmetric | 6 |
| MOTION_INTENSITY | hover and active states only | fluid CSS transitions | scroll choreography, pinning | 7 |
| VISUAL_DENSITY | airy, gallery-like | balanced | packed, cockpit-like | 3 on landing pages, 6 on app screens |

- Variance of 4 or more: layouts collapse to a single column under 768px.
- Motion above 3: a reduced-motion path is required. If a screen claims motion above 4, it must actually move.
- Density on app screens (balances, transactions): tabular numbers, tighter spacing, but never at the cost of readability.
- Dials can be changed in plain words ("calmer", "denser", "bolder") and the screen re-applied.

## 1. Color tokens (defaults)
```css
:root {
  --ink: #0b0c14;            /* primary text */
  --paper: #f5f3ee;          /* warm page background */
  --surface: #ffffff;        /* cards */
  --accent: #007cb5;         /* primary action, highlights */
  --accent-ink: #ffffff;     /* text on accent (4.6:1 contrast) */
  --accent-soft: #dff1fa;    /* tinted backgrounds, chips */
  --positive: #0e9f6e;       /* money in, success: fills and dark surfaces */
  --positive-ink: #0a7a54;   /* positive text on light surfaces (5.3:1 on white) */
  --danger: #e5484d;         /* errors, money out alerts */
  --muted: rgba(11,12,20,.62);
  --line: rgba(11,12,20,.10);
  --glass: rgba(255,255,255,.55);
  --radius-btn: 14px;
  --radius-card: 28px;
  --shadow-card: 0 1px 2px rgba(11,12,20,.06), 0 12px 32px rgba(11,12,20,.08);
}
```
- Accent is for one primary action per view and key highlights only.
- Avoid purple or indigo glows and neon gradients by default. They read as generic.
- `--positive` is only about 3.4:1 on white, so never use it for small text on light surfaces. Use `--positive-ink` there, and keep `--positive` for fills and for text on `--ink`.

## 2. Typography
- Display: Bricolage Grotesque 800, `line-height: .92`, `letter-spacing: -0.03em`, size `clamp(48px, 9vw, 120px)`. Short, punchy headlines.
- Body: DM Sans 400-500, 16-20px, `line-height: 1.5`. Fallback `system-ui`. Do not default to Inter. A serif only if the chosen direction justifies it.
- Numbers (money, rates, dates): `font-variant-numeric: tabular-nums`, large and bold, with the currency or unit smaller beside it.
- One bold headline per section plus one quiet supporting line. Bold type is the attention grabber, so keep everything else calm.

## 3. Shape and components
- Buttons: 52px high, `--radius-btn`, bold label. Primary = `--accent` background. Secondary = transparent with 1px `--line` border. Labels never wrap on desktop. One primary button per intent.
- Cards: `--radius-card`, `--surface`, 1px `--line` border, `--shadow-card`.
- Glass panels: at most 1-2 per page, for the nav or one floating card, never for body content. If liquid-glass-js is too heavy or janky, use this approximation and label it as one in a code comment:
```css
.glass {
  background: var(--glass);
  backdrop-filter: blur(16px) saturate(1.4);
  border: 1px solid rgba(255,255,255,.5);
}
@media (prefers-reduced-transparency: reduce) {
  .glass { background: var(--surface); backdrop-filter: none; }
}
```
- 8px spacing grid. Section padding 96-160px desktop, 64px mobile. White space is part of the look.
- Press feedback: buttons and tappable cards scale to about .98 on `:active`.

## 4. One-per-page rules
- One accent color, one theme (light or dark), one radius system, one icon family (Phosphor or Tabler, never hand-drawn icon paths), at most one marquee.
- Section rhythm comes from surface tints, spacing and layout changes, not from flipping the whole page between light and dark.
- Avoid pure black and pure white. Ink and paper are already tinted.

### Hero and section limits
- The hero fits the first viewport. Headline: at most 2 lines and 8 words. Subtext: at most 20 words. At most 4 text elements. One primary button.
- Other sections: subtext at most 25 words.
- Each section uses a different layout family. No more than 2 consecutive image-and-text zigzags. No row of three equal feature cards, vary the sizes (one large, two small).
- Eyebrow labels sparingly, about one per three sections.
- Text-only pages feel unfinished: show the real UI, a chart, a 3D object or a shader as the visual.

## 5. Scroll and transition patterns
Sections expand in and out as the user scrolls, with no jumps. Pick patterns from this list:
1. **Expand-on-scroll card**: a card starts small with a large radius and grows to full width as it enters, then eases back as it leaves.
2. **Pinned story**: a section pins while 3-4 steps change inside it (text, numbers, a 3D or gradient background), scrubbed by scroll.
3. **Sticky stack**: cards use `position: sticky` so each new card slides over the previous one, which scales down slightly.
4. **Headline line reveal**: lines rise and fade in, staggered 60-80ms.
5. **Number count-up** when a stat enters view, once only.
6. **Background shift**: the page or shader color changes between sections as you scroll.

Rules:
- Every animation needs a reason: hierarchy, storytelling, feedback or a state change. "It looks cool" is not a reason.
- Animate only `transform`, `opacity` and `border-radius`. Never animate `height`, `top` or `left`.
- Scrubbed by scroll position, or ease out over 400-700ms. No bouncing and no looping decoration on content.
- Money values must never animate while the user is trying to read them. Count-up runs once and ends on the exact value.
- Never use `window.addEventListener('scroll')` or store scroll position in React state. Use ScrollTrigger, IntersectionObserver or CSS scroll-driven animations.
- One animation library per component tree: use GSAP. Simple reveals can be plain CSS or IntersectionObserver.
- Respect `prefers-reduced-motion`: content must be fully usable with motion off.

### Default wiring (GSAP + Lenis)
```js
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
const mm = gsap.matchMedia();

mm.add('(prefers-reduced-motion: no-preference)', () => {
  const lenis = new Lenis({ lerp: 0.1 });
  lenis.on('scroll', ScrollTrigger.update);
  const tick = (t) => lenis.raf(t * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  gsap.fromTo('.expand-card',
    { scale: 0.9, borderRadius: 64 },
    { scale: 1, borderRadius: 28, ease: 'none',
      scrollTrigger: { trigger: '.expand-card', start: 'top 90%', end: 'top 30%', scrub: true } });

  return () => { gsap.ticker.remove(tick); lenis.destroy(); };
});
```
In React, create triggers inside a context and clean up on unmount:
```js
useLayoutEffect(() => {
  const ctx = gsap.context(() => { /* triggers here */ }, rootRef);
  return () => ctx.revert();
}, []);
```
Zero-dependency fallback (modern browsers): CSS `animation-timeline: view()` with `animation-range: entry 0% cover 40%`, or an `IntersectionObserver` toggling an `.in-view` class with a 600ms `cubic-bezier(.2,.8,.2,1)` transition.

## 6. Resource stack
| Resource | Use it for | Notes |
|---|---|---|
| GSAP + ScrollTrigger | All scroll choreography: pin, scrub, stagger, expand | Default choice for every pattern in section 5 |
| Lenis | Smooth, inertial scrolling | Always wire to GSAP as above. Disable under reduced motion |
| react-three-fiber (+ drei) | One 3D hero object or scene driven by scroll | React only. One canvas per page, lazy-load it, cap `dpr` at 1.5, keep a static image fallback |
| ShaderGradient | Animated gradient background that shifts per section | React. Design values in its web editor, then copy the props. One per page |
| Vanta | Fastest animated background (waves, net, fog) | Works without React. Use the three.js version its docs require |
| liquid-glass-js | Glass refraction on the nav, one card or one button | 1-2 elements max. Test in the browser you will demo on, effects can differ between browsers |

- At most one heavy visual per page (react-three-fiber, ShaderGradient or Vanta). Liquid glass can be added on top.
- Check each library's README for the current API before using it.

## 7. Layout and copy
- Mobile-first: one column up to 768px, 12-column grid above. Max content width 1200px, 16-24px side gutters.
- One idea per screen-height section. Full-bleed colored sections alternate with contained cards.
- Navigation: simple top bar, logo left, one primary button right. Sticky, gets a `--line` border after scroll.
- Copy: plain, friendly, direct. Say what it does, not how clever it is. Short sentences, active verbs, no jargon.
- Always show the real number or outcome (fee, time, amount) next to the claim.
- Read all copy once before shipping and cut filler.

## 8. States and accessibility
- Always include loading, empty and error states. Loading skeletons match the shape of the real content.
- Visible focus ring: 2px `--ink` outline with 2px offset. Text contrast at least 4.5:1, buttons and form fields included.
- No dead links or placeholder text on the demo path.

## 9. Performance guardrails
- Targets: LCP under 2.5s, INP under 200ms, CLS under 0.1. 60fps while scrolling on a laptop.
- Lazy-load anything 3D or shader-based. Show the static layout first, then enhance.
- Compress images, set explicit sizes, preload the display font.
- If an effect janks on the demo machine, cut the effect, not the content.

## 10. Avoid the generic AI look
- Purple or indigo glow gradients, neon glows, gradient text overuse.
- Three equal feature cards, everything centered, glass on everything.
- Custom mouse cursors, scroll cues, decorative status dots, version labels, section-number eyebrows.
- Generic labels ("Step 1", "Feature One"), placeholder names ("Jane Doe"), startup-sounding filler brand names.
- Em-dashes in copy. Use a hyphen or rewrite the sentence.
- Fake screenshots built from divs when the real UI can be shown instead.
- Hand-drawn decorative SVGs and broken stock-image links.

## Pre-flight checklist (every screen)
- [ ] Design Read stated, dials set
- [ ] One bold headline, one primary button, hero fits the first viewport
- [ ] Colors, radii and shadows come from tokens, no hard-coded values
- [ ] One accent, one theme, one radius system, one icon family
- [ ] Every animation has a reason, uses transform/opacity only and has a reduced-motion path
- [ ] At most one heavy visual and 1-2 glass elements
- [ ] Money values readable and exact at rest
- [ ] Loading, empty and error states exist
- [ ] None of the section 10 items appear
- [ ] Works at 375px width and on the demo machine

## Versioning
- v1.1: added Design Read and dials, one-per-page rules, hero and section limits, stricter motion rules, the generic-AI-look list and a pre-flight checklist (ideas adapted from the open-source taste-skill). Default accent is #007cb5 (set by the team) and the fonts are Bricolage Grotesque and DM Sans.
- v1.2: added the `--positive-ink` token and the rule for positive text on light surfaces, found while building the test page.
- Next (v2): dark mode tokens, form inputs, charts, iconography.
