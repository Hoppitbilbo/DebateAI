# Design System Documentation

## Overview
This document outlines the unified design system for the educational interview applications. All apps now follow consistent UI patterns, color schemes, and component structures.

## Color Palette

### Primary Colors
- **Education Primary**: `#A5D233` - Main brand color for buttons, accents
- **Education Light**: `#D8FF8F` - Light accent for backgrounds, highlights  
- **Education Dark**: `#0E3542` - Dark text, headers
- **Education Muted**: `#8BAB2A` - Subtle text, borders

### Usage Guidelines
- Use Education Primary for primary actions (buttons, links)
- Use Education Light for subtle backgrounds and highlights
- Use Education Dark for headings and important text
- Use Education Muted for secondary text and borders

## Typography

### Font Families
- **Headings**: Fraunces (serif) - For app titles and main headings
- **Body**: Inter (sans-serif) - For all body text and UI elements

### Scale
- **Text XS**: 0.75rem (12px)
- **Text SM**: 0.875rem (14px) 
- **Text Base**: 1rem (16px)
- **Text LG**: 1.125rem (18px)
- **Text XL**: 1.25rem (20px)
- **Text 2XL**: 1.5rem (24px)

## Spacing System

Consistent spacing scale based on 0.25rem (4px) increments:
- **XS**: 0.25rem (4px)
- **SM**: 0.5rem (8px)
- **MD**: 1rem (16px)
- **LG**: 1.5rem (24px)
- **XL**: 2rem (32px)
- **2XL**: 3rem (48px)

## Component Architecture

### Shared Components

#### AppLayout
- Provides consistent page structure across all apps
- Includes header with title, subtitle, and reset button
- Handles navigation back to apps page
- Applies consistent background gradient

#### ChatInterface
- Unified chat component for all conversation-based apps
- Consistent message styling (user vs AI)
- Built-in loading states and animations
- Configurable input placeholder and end activity button

#### ReflectionInterface
- Standardized reflection form across all apps
- Consistent validation and character count
- Contextual prompts based on app type
- Game result summary when applicable

#### FeedbackInterface
- Unified feedback display with activity summary
- Markdown support for AI evaluations
- Conversation history display
- Consistent action buttons

#### CharacterSelector
- Reusable character search and selection
- Consistent search UI and result display
- Loading states and error handling

### App-Specific Patterns

#### ConvinciTu
- Character selection + topic input
- Single conversation interface
- Persuasion-focused reflection prompts

#### ImpersonaTu
- Character info header showing both AI and user characters
- Role-playing conversation interface
- Character interpretation reflection

#### PersonaggioMisterioso
- Game setup with difficulty selection
- Question-based chat interface
- Final guess submission
- Game result evaluation

#### DoppiaIntervista
- Dual character chat interfaces
- Character selection toggle
- Comparative conversation analysis

## Visual Design Principles

### Cards and Containers
- Semi-transparent white backgrounds (90% opacity)
- Subtle backdrop blur for depth
- Education-themed borders (20% opacity)
- Consistent border radius (0.5rem)
- Subtle shadows for elevation

### Interactive Elements
- Education primary color for primary actions
- Outline variants with education theme borders
- Hover states with subtle transforms
- Focus states for accessibility
- Loading states with education-themed animations

### Responsive Design
- Mobile-first approach
- Flexible grid layouts
- Collapsible navigation on small screens
- Touch-friendly button sizes

## Accessibility Features

### Color and Contrast
- High contrast mode support
- Sufficient color contrast ratios
- Color is not the only way to convey information

### Keyboard Navigation
- Focus indicators on all interactive elements
- Logical tab order
- Keyboard shortcuts where appropriate

### Screen Readers
- Semantic HTML structure
- ARIA labels and descriptions
- Screen reader only content where needed

### Motion and Animation
- Respects prefers-reduced-motion
- Subtle, purposeful animations
- Loading states provide feedback

## Implementation Guidelines

### CSS Architecture
- Tailwind CSS for utility classes
- Custom CSS variables for theme colors
- Component-specific styles when needed
- Global design system CSS file

### Component Props
- Consistent prop naming across similar components
- Optional props with sensible defaults
- TypeScript interfaces for type safety

### State Management
- Consistent activity phase patterns
- Unified loading and error states
- Predictable data flow

## Quality Assurance

### Testing Checklist
- [ ] Visual consistency across all apps
- [ ] Responsive behavior on all screen sizes
- [ ] Keyboard navigation works properly
- [ ] Screen reader compatibility
- [ ] Loading states function correctly
- [ ] Error handling is consistent
- [ ] Color contrast meets WCAG guidelines

### Browser Support
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Progressive enhancement for older browsers

## Maintenance

### Adding New Components
1. Follow existing naming conventions
2. Use design system colors and spacing
3. Include TypeScript interfaces
4. Add accessibility features
5. Test across all supported browsers

### Updating Existing Components
1. Maintain backward compatibility when possible
2. Update all instances consistently
3. Test impact on all apps
4. Update documentation

This design system ensures a cohesive, professional, and accessible user experience across all educational interview applications.
