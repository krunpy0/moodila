---
name: Serene Pulse
colors:
  surface: '#fbf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fbf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae8e7'
  surface-container-highest: '#e4e2e1'
  on-surface: '#1b1c1c'
  on-surface-variant: '#4d4447'
  inverse-surface: '#303030'
  inverse-on-surface: '#f3f0f0'
  outline: '#7f7478'
  outline-variant: '#d0c3c7'
  surface-tint: '#6b5a60'
  primary: '#6b5a60'
  on-primary: '#ffffff'
  primary-container: '#fce4ec'
  on-primary-container: '#76646b'
  inverse-primary: '#d7c1c8'
  secondary: '#526069'
  on-secondary: '#ffffff'
  secondary-container: '#d3e2ed'
  on-secondary-container: '#56656e'
  tertiary: '#636037'
  on-tertiary: '#ffffff'
  tertiary-container: '#f2ecb8'
  on-tertiary-container: '#6e6b41'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#f4dce4'
  primary-fixed-dim: '#d7c1c8'
  on-primary-fixed: '#25181e'
  on-primary-fixed-variant: '#524249'
  secondary-fixed: '#d6e5ef'
  secondary-fixed-dim: '#bac9d3'
  on-secondary-fixed: '#0f1d25'
  on-secondary-fixed-variant: '#3b4951'
  tertiary-fixed: '#eae4b1'
  tertiary-fixed-dim: '#cdc897'
  on-tertiary-fixed: '#1e1c00'
  on-tertiary-fixed-variant: '#4b4822'
  background: '#fbf9f8'
  on-background: '#1b1c1c'
  surface-variant: '#e4e2e1'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  container-margin: 20px
  gutter: 12px
---

## Brand & Style

The design system is centered on emotional wellness and gentle social connection. It employs a **Soft Minimalist** aesthetic that prioritizes psychological safety and ease of use. By combining generous whitespace with warm, organic forms, the interface creates a digital sanctuary for reflection. 

The brand personality is empathetic and non-judgmental. It avoids the clinical coldness of traditional health apps in favor of a conversational, "lived-in" feel. The emotional response should be one of immediate relief and quiet optimism, achieved through a "squishy" tactile language and a palette that mimics the soft light of golden hour.

## Colors

This design system utilizes a foundation of soft, descriptive pastels. The primary colors are not used for branding alone, but serve as functional indicators of emotional states (e.g., Pink for Joy, Blue for Calm, Yellow for Focus).

- **Light Mode (Default):** Uses a warm off-white for the canvas to reduce eye strain. Surfaces are pure white to create subtle separation.
- **Dark Mode:** Employs a deep charcoal (`#333333`) canvas. Accent pastels (Pink `#fce4ec`, Blue `#e3f2fd`, Yellow `#fff9c4`) are utilized to maintain legibility and a soft character against the dark background without causing glare.
- **Text:** Deep neutrals provide high legibility in the default light mode, maintaining a gentle contrast ratio that avoids eye fatigue.

## Typography

The system uses **Plus Jakarta Sans** across all roles to maintain a cohesive, friendly, and modern character. The rounded terminals of this typeface echo the rounded corners of the UI components.

**Headlines** are set with tight letter-spacing and bold weights to feel impactful yet approachable. The "Greetings" header is the primary focal point of the home screen, using `headline-xl` to establish a personal connection immediately.

**Body text** maintains generous line height to ensure journals and thoughts are easy to read. **Labels** use a slightly heavier weight (`500`-`600`) to remain legible even when placed on soft pastel backgrounds.

## Layout & Spacing

This design system follows a **fluid grid** model optimized for mobile-first interactions. It uses a 4px baseline grid to ensure consistent vertical rhythm.

- **Margins:** Screens utilize a 20px outer margin to provide breathing room.
- **Grid:** A 4-column layout is used for mobile, while tablets transition to a 12-column layout. 
- **Component Spacing:** Elements within cards (like Mood Indicators or Stats) use `12px` (sm) or `16px` (md) gaps to maintain a tight but breathable grouping.
- **Reflow:** On larger devices, cards for "Mood Stability" and "Stress Level" should sit side-by-side (2-column), whereas on mobile they stack vertically for better thumb reach.

## Elevation & Depth

Visual hierarchy is achieved through **Tonal Layering** and **Ambient Shadows** rather than borders. 

- **Level 0 (Background):** The base canvas (warm off-white).
- **Level 1 (Floating Cards):** White surfaces, slightly separated from the background. These use a "Cloud Shadow"—an extremely soft, diffused drop shadow to suggest elevation.
- **Level 2 (Interactive Elements):** Buttons and active chips. These use a slightly more pronounced shadow or subtle outer glow to indicate "pressability."

Avoid harsh 1px borders. If separation is needed between similar colors, use a tonal shift that is only 5% darker/lighter than the surface color.

## Shapes

The shape language is dominated by high-radius curves to evoke comfort. 

- **Standard Elements:** Buttons and input fields use `16px` (`rounded-lg`).
- **Primary Containers:** Floating cards and bottom sheets use `24px` (`rounded-xl`).
- **Interactive Pill:** The bottom navigation and mood chips use a full-pill radius (`999px`) to distinguish them as high-frequency interaction points.
- **Mood Icons:** Always circular to maintain the "emoji" metaphor.

## Components

### Mood Indicators
Circular icons with a diameter of 48px. Each mood color has a 10% opacity background of its specific pastel hex, with a centered emoji or custom expressive icon.

### Navigation
A floating pill-style bar positioned 16px from the bottom. It should have a backdrop blur (20px) and a semi-transparent light surface. Icons should be line-art style, filling in with a soft glow when active.

### Cards
Cards are the primary container for all content. They should have `24px` padding and `24px` corner radii. Content within cards is grouped logically with `12px` spacing.

### Widgets (Stats)
Small, square-ish cards used for "Mood Stability" and "Stress Level". These utilize minimalist sparkline charts with smoothed (bezier) paths. The text inside should follow the `label-sm` and `headline-lg` hierarchy for data visualization.

### Buttons
Primary buttons use the pastel accent colors. Text should remain a dark neutral even on colored buttons to maintain the soft look. Avoid pure black text on buttons.