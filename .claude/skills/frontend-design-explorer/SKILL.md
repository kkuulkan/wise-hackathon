---
name: frontend-design-explorer
description: Use at the start of the project, when given a fintech product idea, to propose 5 genuinely different visual directions (palette, type, shape, signature scroll moment, suggested libraries) so one can be chosen before building. Output is for choosing a direction, not for building the whole UI.
---

# Design Explorer

Turn a product idea into 5 distinct style directions for a fintech frontend, with suggested resources for each. The goal is to choose fast and avoid one-shot prompting the UI. After a direction is picked, hand its tokens to the `frontend-style-guideline` skill.

## Workflow
1. **Read the idea.** Extract: who the user is, the core action, the tone (trustworthy, playful, premium, calm) and the one flow that will be demoed. If something critical is missing, ask at most one short question. Otherwise state your assumptions in one line and continue.
2. **Draft 5 directions** that differ on at least 3 of these axes:
   - light vs dark
   - airy vs dense
   - calm vs cinematic motion
   - flat 2D vs 3D or shader depth
   - serious vs playful voice
3. **Show a comparison table first**, then the 5 detailed blocks.
4. **Recommend one** and say why in two sentences, based on the idea, the demo flow and build effort.
5. **Ask the user to pick** (or mix two). On a pick, output a paste-ready CSS token block for `frontend-style-guideline` and list which of its sections are overridden.

## Output format
Table: `Name | Mood | Wow | Build effort | Risk`

Then per direction:
- **Name** and a one-line mood
- **Best when**: the kind of idea it suits
- **Palette**: 5 hex tokens (ink, paper, surface, accent, support)
- **Type**: display font + body font
- **Shape**: radius, borders or shadows, flat or glass
- **Signature moment**: the one scroll transition that defines it, described concretely for this product (what expands, what it turns into)
- **Resources**: libraries from the cheat sheet, with one line on how each is used
- **Effort / Risk**: hours for the main scroll experience, and what could go wrong

### Calibration example (one direction, for a savings app)
**Midnight Ledger**, calm and premium, dark first.
- Best when: the idea is about long-term savings or wealth, where trust and calm matter.
- Palette: ink `#090b12`, paper `#eceae4`, surface `#141826`, accent `#7c9cff`, support `#f2c14e`.
- Type: Sora 700 display, Inter body. Shape: 24px radius, hairline borders, one glass nav.
- Signature moment: a single balance card pins in the center, and as you scroll it splits into three goal cards that drift apart while the background shifts from deep navy to a soft blue gradient.
- Resources: GSAP ScrollTrigger (pin + scrub), Lenis (smooth scroll), ShaderGradient (background shift).
- Effort / Risk: about 4h, low. Main risk is the pinned section on small screens.

## Constraints
- Original directions only. Do not copy or reference an existing brand's identity (logo, palette, signature type, layouts).
- Fintech trust rules: numbers are large, high-contrast and tabular. No motion on a number while it is being read. Errors are calm and clear.
- Each direction uses at most one heavy visual (react-three-fiber, ShaderGradient or Vanta), plus liquid glass on 1-2 elements if wanted.
- Hackathon realism: the main scroll experience must be buildable by 2-4 people in about 6 hours or less. Prefer 2 libraries or fewer per direction.
- Check accent-on-background contrast is at least 4.5:1 for text.
- Make the 5 directions truly different, not five recolors of the same layout.

## Resource cheat sheet
| Resource | Good for | Effort | Watch out for |
|---|---|---|---|
| GSAP + ScrollTrigger | Pin, scrub, stagger, expand-on-scroll, section transitions | Low-medium | Clean up triggers on route change |
| Lenis | Smooth, inertial scroll that makes everything feel seamless | Low | Wire to GSAP's ticker, disable for reduced motion |
| react-three-fiber (+ drei) | A 3D hero object or scene tied to scroll | High | React only, heavy on weak GPUs, lazy-load and keep a static fallback |
| ShaderGradient | Animated gradient backgrounds that shift per section | Low | React. One per page. Design in its web editor |
| Vanta | Quick animated backgrounds (waves, net, fog) without React | Low | Needs the three.js version its docs ask for |
| liquid-glass-js | Glass refraction on nav, a card or a button | Medium | 1-2 elements only. Test in the demo browser, results differ across browsers |

Check each library's README for the current API before using it.

## Optional: previews
If asked, build a single HTML file with 5 small static hero mockups side by side (plain CSS, no libraries) so palettes and type can be compared at a glance. Save it next to the skill outputs and send it to the user.

## Handoff
When a direction is picked, reply with:
1. A `:root { ... }` token block (colors, radii, shadow) for `frontend-style-guideline`.
2. The chosen signature moment as a one-paragraph build brief.
3. The exact libraries to install.
Then stop. Building the UI is a separate step, section by section.
