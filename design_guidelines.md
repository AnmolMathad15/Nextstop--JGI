# Nextstop JGI - Design Guidelines

## Design Approach
**Reference-Based**: Drawing from the provided HTML files and modern web application patterns (inspired by Google Maps, Uber-style tracking interfaces, and Material Design principles)

## Core Design Principles
- **Transparency & Depth**: Glass-morphism effects with backdrop blur for modern, layered UI
- **Real-time Focus**: Clear visual hierarchy emphasizing live tracking data and notifications
- **Role-Specific UX**: Distinct interfaces for Student (read-only), Driver (update-focused), Admin (full control)
- **Mobile-First**: Optimized for on-the-go bus tracking

---

## Typography

**Font Family**: 
- Primary: 'Manrope' (login/auth screens)
- Secondary: 'Work Sans' (map/tracking screens)
- Tertiary: 'Plus Jakarta Sans' (admin/notifications)
- Fallback: system-ui, sans-serif

**Hierarchy**:
- Hero/Headers: 2xl-3xl, font-extrabold (800), tracking-wide
- Section Titles: xl-2xl, font-bold (700)
- Body Text: base, font-medium (500-600)
- Captions/Metadata: xs-sm, font-normal (400)
- Ribbon Text: 2xl, font-bold (700), uppercase, letter-spacing: 1px

---

## Layout System

**Spacing Scale**: Use Tailwind units of **2, 4, 6, 8, 12, 16, 20** for consistent rhythm
- Component padding: p-4, p-6
- Section spacing: space-y-4, space-y-6, space-y-8
- Card gaps: gap-3, gap-4, gap-6
- Screen padding: px-4, py-6

**Container Widths**:
- Forms/Cards: max-w-sm (384px), max-w-md (448px)
- Content sections: max-w-2xl (672px), max-w-4xl (896px)
- Full-width maps: w-full with absolute positioning

**Grid Patterns**:
- Navigation: flex justify-around (equal distribution)
- Admin dashboard: grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Notification list: Single column with stacked cards

---

## Color Palette

**Brand Colors** (as specified):
- Primary Teal: `#0f766e`
- Primary Blue: `#2563eb`
- Primary Green: `#059669`
- Accent Yellow: `#facc15` (buttons, highlights, CTAs)

**Functional Colors**:
- Success: Green-500
- Warning: Yellow-600
- Error/Alert: Red-500
- Neutral: Gray-50, Gray-100, Gray-200, Gray-500, Gray-800, Gray-900

**Background Treatments**:
- Page background: `url('jcet logo pic.jpg')` no-repeat center/cover, fixed
- Light overlay: rgba(255,255,255,0.65) - for login/light screens
- Dark overlay: rgba(0,0,0,0.55) - for OTP/dark screens
- Glass cards: rgba(255,255,255,0.75) OR rgba(0,0,0,0.5) with backdrop-blur-md/lg

---

## Component Library

### Global Header - Ribbon Bar
- Position: Sticky top-0, z-index: 10
- Background: `linear-gradient(90deg, #0f766e, #2563eb)`
- Contains: JGI logo (circular, 40-50px) + scrolling marquee text
- Text: "JAIN COLLEGE OF ENGINEERING AND TECHNOLOGY, HUBBALLI" (uppercase, bold, 2xl)
- Animation: Horizontal scroll, 15-20s linear infinite
- Height: py-3 to py-4

### App Branding Header
- Logo: "logo.jpg" in yellow circular container (80-110px diameter)
- Circle background: #facc15 with shadow and pulse animation
- Title: "NextStop JGI" or "NEXTSTOP JGI" - gradient text (teal to green)
- Layout: Centered flex column OR horizontal flex with justify-between

### Buttons
**Primary (Yellow)**:
- Background: bg-yellow-400, hover:bg-yellow-500
- Text: text-gray-900, font-semibold/bold
- Padding: py-3 px-6
- Border-radius: rounded-lg (8px)
- Shadow: shadow-md, hover: enhanced glow effect
- Transition: transform scale(1.03) on hover

**Secondary (Outlined)**:
- Border: 2px border-yellow-400 OR border-gray-200
- Background: transparent OR bg-white/10
- Hover: bg-yellow-50 OR subtle background

**Floating Circular Navigation**:
- Fixed position (bottom: 40-80px)
- Size: 50-55px diameter, rounded-full
- Background: Yellow (#facc15) OR Teal/Green gradient
- Icon: Material Symbols (arrow_back, arrow_forward)
- Shadow: 0 6px 16px rgba(0,0,0,0.4)
- Hover: scale(1.1) with enhanced glow

### Form Inputs
**Text Inputs**:
- Style 1 (Underline): Border-bottom-2, transparent background, focus: yellow border
- Style 2 (Standard): bg-white, rounded-lg, border, focus:ring-2 ring-yellow-400
- Padding: py-3 px-4
- Password: Include visibility toggle icon (absolute positioned)

**Dropdowns**:
- Appearance: none (custom arrow)
- Arrow icon: Material Symbols 'expand_more' (absolute right)
- Same styling as text inputs

**OTP Inputs**:
- Size: h-14 w-12 (individual boxes)
- Center-aligned text, text-2xl, font-bold
- Staggered fade-up animation (0.2s delay increments)
- Focus: ring-2 ring-yellow-400

### Cards
**Glass-morphism Cards**:
- Background: rgba(255,255,255,0.75) OR rgba(0,0,0,0.5)
- Backdrop-filter: blur(16px) OR blur(6px)
- Border-radius: 12-20px
- Padding: p-6 to p-8
- Shadow: subtle elevation

**Notification Cards**:
- Layout: Flex gap-4, icon + content
- Icon wrap: 48x48px, rounded-lg, bg-teal, centered Material icon
- Content: Title (font-bold) + description + timestamp (text-xs, gray)
- Background: Dark transparent with blur
- Spacing: mb-3 between cards

### Navigation
**Bottom Tab Navigation**:
- Position: Fixed bottom-0, full-width
- Background: rgba(0,0,0,0.5) with backdrop-blur OR bg-white with shadow
- Layout: Flex justify-around
- Items: Material icon (24px) + label (text-xs)
- Active state: Yellow color, filled icon variant, font-semibold
- Inactive: Gray-500, outlined icon

**Tabs**: Dashboard, Live, Notifications, Reports, History, Settings

### Map Interface
**Map Container**:
- Height: h-[calc(100vh-160px)] (accounts for header/footer)
- Position: relative for overlay controls
- Source: Leaflet + OpenStreetMap OR Google Maps iframe

**Map Overlays**:
- Search bar: Absolute top, full-width, rounded-full, white bg, shadow-lg
- Icon: Material 'search' (absolute left)
- Zoom controls: Absolute bottom-right, vertical flex, white bg cards
- Location button: Circular yellow button with 'navigation' icon

**Route Visualization**:
- Polyline: Teal color, 4-6px width
- Bus stops: Circular markers with icons
- Selected stop: Highlighted with pulse animation
- Live bus: Moving marker with smooth transitions

### Student Route Selection
**Flow**:
1. Route list page: 6 buttons/cards (keshwapur, Pg, siddaroodh math, Gadag/BVB, Dharwad, Navangar)
2. Stop selection: Dropdown or vertical list of sub-stops
3. Map view: Shows route, stop, live bus, ETA

**Route Cards/Buttons**:
- Full-width or grid-cols-2
- Icon: Material 'route' 
- Border: hover effect with yellow accent
- Padding: p-4

### Missed Bus Alert
- Background: bg-red-50 OR bg-yellow-50
- Border: border-l-4 border-red-500 OR border-yellow-500
- Icon: Material 'warning' OR 'schedule'
- Text: Clear message about departure status
- Position: Above map OR as modal overlay

### Admin Dashboard
**Layout**: Grid-based (1/2/3 columns responsive)
- Stat cards: Icon + number + label
- Action buttons: Grid of CRUD operations
- Live map: Full-width section with all buses
- Data tables: Striped rows, hover effects

---

## Animations

**Logo Animations**:
- Zoom-in on page load: 1-1.5s ease
- Pulse/Glow: 3-4s infinite (scale + shadow intensity)
- Float: 4s ease-in-out infinite (translateY -8px to 0)

**OTP Boxes**: Staggered fade-up (0.2s, 0.4s, 0.6s... delays)

**Marquee Text**: Horizontal scroll 15-20s linear infinite

**Button Hovers**: Scale(1.03) + enhanced glow shadow (0.2s transition)

**Loader**: Bus emoji (🚌) with rotation OR Material 'sync' spinning

**Minimize**: Use animations sparingly - only for branding elements and critical feedback

---

## Images

**Background Image**: "jcet logo pic.jpg"
- Usage: Full-screen background on ALL pages
- Treatment: Fixed, cover, center
- Overlay: Light (rgba(255,255,255,0.65)) OR Dark (rgba(0,0,0,0.55)) depending on page

**Logo Images**:
1. "jgilogo.jpg" - Ribbon header (40-50px circular)
2. "logo.jpg" - App branding (60-110px in yellow circle)

**No Hero Section**: This is a utility app - all pages lead with functionality (maps, forms, dashboards)

---

## Accessibility
- Material Symbols icons with aria-labels
- Form labels with proper for attributes
- Focus states with ring-2 ring-yellow-400
- High contrast between text and backgrounds
- Touch targets: minimum 44x44px for mobile