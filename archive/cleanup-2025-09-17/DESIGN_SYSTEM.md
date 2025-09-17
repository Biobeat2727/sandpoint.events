# Sandpoint Events Design System

## Overview

This document outlines the modern design system implemented for the Sandpoint Events website. The system prioritizes accessibility, consistency, and modern web design principles.

## 🎨 Design Principles

### 1. **Clean & Contemporary**
- Minimal, uncluttered layouts
- Generous white space
- Focus on content hierarchy

### 2. **Accessible & Inclusive**
- High contrast ratios (WCAG AA compliant)
- Clear focus states
- Semantic HTML structure
- Screen reader friendly

### 3. **Mobile-First & Responsive**
- Progressive enhancement approach
- Touch-friendly interactions
- Flexible layouts across all devices

### 4. **Performance-Oriented**
- Optimized animations
- Efficient CSS architecture
- Fast loading times

## 🎨 Color Palette

### Brand Colors
```css
--brand-50: #f0fdf4    /* Light background tints */
--brand-100: #dcfce7   /* Subtle backgrounds */
--brand-200: #bbf7d0   /* Hover states */
--brand-300: #86efac   /* Disabled states */
--brand-400: #4ade80   /* Secondary elements */
--brand-500: #22c55e   /* Primary brand color */
--brand-600: #16a34a   /* Primary hover states */
--brand-700: #15803d   /* Active states */
--brand-800: #166534   /* Text on light backgrounds */
--brand-900: #14532d   /* High contrast text */
```

### Neutral Colors
```css
--neutral-50: #f8fafc   /* Page backgrounds */
--neutral-100: #f1f5f9  /* Card backgrounds */
--neutral-200: #e2e8f0  /* Borders, dividers */
--neutral-300: #cbd5e1  /* Input borders */
--neutral-400: #94a3b8  /* Placeholder text */
--neutral-500: #64748b  /* Secondary text */
--neutral-600: #475569  /* Body text */
--neutral-700: #334155  /* Headings */
--neutral-800: #1e293b  /* High contrast text */
--neutral-900: #0f172a  /* Maximum contrast */
```

### Semantic Colors
```css
--success: #22c55e    /* Success states */
--warning: #f59e0b    /* Warning states */
--error: #ef4444      /* Error states */
```

## 📝 Typography

### Font Stack
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

### Type Scale
```css
--text-xs: 0.75rem     /* 12px - Small labels */
--text-sm: 0.875rem    /* 14px - Body text small */
--text-base: 1rem      /* 16px - Body text */
--text-lg: 1.125rem    /* 18px - Large body text */
--text-xl: 1.25rem     /* 20px - Small headings */
--text-2xl: 1.5rem     /* 24px - Section headings */
--text-3xl: 1.875rem   /* 30px - Page headings */
--text-4xl: 2.25rem    /* 36px - Hero headings */
--text-5xl: 3rem       /* 48px - Large hero */
--text-6xl: 3.75rem    /* 60px - Display headings */
```

### Font Weights
- **300**: Light (rare usage)
- **400**: Regular (body text)
- **500**: Medium (emphasis)
- **600**: Semibold (headings)
- **700**: Bold (strong emphasis)
- **800**: Extra bold (display headings)

## 🔗 Component System

### Buttons

#### Primary Button
```css
.btn-primary {
  @apply bg-brand-600 text-white shadow-soft hover:bg-brand-700 hover:shadow-medium focus:ring-brand-500 transform hover:scale-105;
}
```

#### Secondary Button
```css
.btn-secondary {
  @apply bg-white text-brand-600 border border-brand-600 shadow-soft hover:bg-brand-50 hover:shadow-medium focus:ring-brand-500;
}
```

#### Outline Button
```css
.btn-outline {
  @apply bg-transparent text-neutral-700 border border-neutral-300 shadow-soft hover:bg-neutral-50 hover:shadow-medium focus:ring-neutral-500;
}
```

### Cards

#### Basic Card
```css
.card {
  @apply bg-white rounded-xl shadow-soft border border-neutral-200 overflow-hidden transition-all duration-300 hover:shadow-medium;
}
```

#### Interactive Card
```css
.card-interactive {
  @apply card hover:shadow-strong hover:-translate-y-1 cursor-pointer;
}
```

### Form Elements

#### Input Field
```css
.form-input {
  @apply w-full px-4 py-3 text-sm border border-neutral-300 rounded-lg bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors;
}
```

#### Label
```css
.form-label {
  @apply block text-sm font-medium text-neutral-700 mb-2;
}
```

### Tags

#### Primary Tag
```css
.tag-primary {
  @apply inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-brand-100 text-brand-800 hover:bg-brand-200;
}
```

#### Secondary Tag
```css
.tag-secondary {
  @apply inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-neutral-100 text-neutral-700 hover:bg-neutral-200;
}
```

## 📏 Spacing System

### Base Unit: 4px (0.25rem)

```css
--space-xs: 0.5rem    /* 8px */
--space-sm: 0.75rem   /* 12px */
--space-md: 1rem      /* 16px */
--space-lg: 1.5rem    /* 24px */
--space-xl: 2rem      /* 32px */
--space-2xl: 3rem     /* 48px */
--space-3xl: 4rem     /* 64px */
--space-4xl: 6rem     /* 96px */
```

### Layout Helpers

#### Section Padding
```css
.section-padding {
  @apply py-16 px-4 sm:px-6 lg:px-8;
}
```

#### Container
```css
.container-responsive {
  @apply mx-auto max-w-7xl px-4 sm:px-6 lg:px-8;
}
```

## 🎭 Shadows

### Shadow Scale
```css
--shadow-soft: 0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04);
--shadow-medium: 0 4px 25px -3px rgba(0, 0, 0, 0.1), 0 6px 16px -4px rgba(0, 0, 0, 0.1);
--shadow-strong: 0 10px 40px -3px rgba(0, 0, 0, 0.1), 0 12px 32px -4px rgba(0, 0, 0, 0.1);
```

## 🎬 Animation System

### Keyframes
```css
@keyframes fadeIn {
  0% { opacity: 0; }
  100% { opacity: 1; }
}

@keyframes slideUp {
  0% { transform: translateY(20px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}

@keyframes scaleIn {
  0% { transform: scale(0.95); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
```

### Animation Classes
```css
.animate-fade-in { animation: fadeIn 0.5s ease-in-out; }
.animate-slide-up { animation: slideUp 0.4s ease-out; }
.animate-scale-in { animation: scaleIn 0.3s ease-out; }
```

## 🎯 Event-Specific Components

### Event Card
```css
.event-card {
  @apply card-interactive h-full;
}

.event-image {
  @apply w-full h-48 object-cover transition-transform duration-300 group-hover:scale-105;
}

.event-title {
  @apply text-lg font-semibold text-neutral-900 line-clamp-2 group-hover:text-brand-600 transition-colors;
}

.event-meta {
  @apply flex items-center text-sm text-neutral-600;
}

.event-description {
  @apply text-sm text-neutral-600 line-clamp-3;
}
```

## 📱 Responsive Breakpoints

```css
/* Tailwind default breakpoints */
sm: 640px   /* Small tablets */
md: 768px   /* Tablets */
lg: 1024px  /* Small desktops */
xl: 1280px  /* Large desktops */
2xl: 1536px /* Extra large screens */
```

## ♿ Accessibility Guidelines

### Focus States
- All interactive elements have visible focus rings
- Focus rings use brand colors for consistency
- Tab navigation flows logically through the page

### Color Contrast
- All text meets WCAG AA standards (4.5:1 minimum)
- Important elements meet AAA standards (7:1 minimum)
- Color is never the only way to convey information

### Screen Readers
- Semantic HTML structure
- Proper heading hierarchy (h1 → h2 → h3)
- Descriptive alt text for images
- ARIA labels for complex interactions

## 🚀 Performance Considerations

### CSS Architecture
- Uses Tailwind's utility-first approach
- Custom components defined in `@layer components`
- Efficient specificity management

### Animation Performance
- Uses `transform` and `opacity` for animations
- Hardware acceleration with `will-change` when appropriate
- Respects `prefers-reduced-motion` user preferences

## 📋 Implementation Checklist

### ✅ Completed Components
- [x] Design system foundation (colors, typography, spacing)
- [x] Button system (primary, secondary, outline)
- [x] Card system (basic, interactive)
- [x] Form elements (inputs, labels)
- [x] Tag system (primary, secondary)
- [x] EventCard component modernization
- [x] Navbar redesign
- [x] Footer enhancement
- [x] Home page layout improvements
- [x] Events listing page with filtering UI

### 🔄 In Progress
- [ ] HeroCarousel modernization
- [ ] Event detail page enhancements
- [ ] Venue page improvements

### 🎯 Future Enhancements
- [ ] Dark mode support
- [ ] Advanced animation micro-interactions
- [ ] Loading states and skeletons
- [ ] Toast notifications system
- [ ] Modal and overlay components

## 📝 Usage Examples

### Creating a New Card Component
```jsx
function CustomCard({ children }) {
  return (
    <div className="card group">
      <div className="card-body">
        {children}
      </div>
    </div>
  );
}
```

### Using the Button System
```jsx
// Primary action
<button className="btn btn-primary">Submit</button>

// Secondary action
<button className="btn btn-secondary">Cancel</button>

// Subtle action
<button className="btn btn-outline">Learn More</button>
```

### Implementing Consistent Spacing
```jsx
function EventSection() {
  return (
    <section className="section-padding">
      <div className="container-responsive">
        <h2 className="text-3xl font-bold mb-8">Events</h2>
        {/* Content */}
      </div>
    </section>
  );
}
```

---

This design system provides a solid foundation for building consistent, accessible, and modern user interfaces across the Sandpoint Events platform. Regular updates and refinements should be made based on user feedback and evolving design trends.