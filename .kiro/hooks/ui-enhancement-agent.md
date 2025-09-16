# UI Enhancement Agent Hook

## Overview
This hook triggers automatically when there is UI workload in the DubAI project, specializing in modern, trending UI component libraries like Aceternity UI, with a focus on glassmorphism, advanced animations, and cutting-edge design patterns.

## Trigger Conditions
- Any file changes in `apps/frontend/src/components/`
- New UI component requests
- Design system updates
- User interface enhancement tasks
- Frontend styling modifications

## Agent Specialization
- **Primary Focus**: Aceternity UI-inspired components
- **Design Philosophy**: Glassmorphism, micro-interactions, advanced animations
- **Technologies**: Framer Motion, Tailwind CSS, Radix UI, React
- **Standards**: Accessibility, Performance, Mobile-first, TypeScript

## Memory Refresh Protocol
When completed, the agent refreshes its memory with:
1. Latest design trends and patterns
2. Component library updates
3. Performance optimization techniques
4. Accessibility best practices
5. Animation and interaction patterns

## Design Standards

### Visual Hierarchy
- Use of depth through glassmorphism and shadows
- Consistent spacing using 8px grid system
- Typography scale with proper contrast ratios
- Color palette with semantic meaning

### Animation Principles
- Meaningful motion that guides user attention
- Smooth transitions with proper easing curves
- Performance-optimized animations (60fps)
- Reduced motion support for accessibility

### Component Architecture
- Composable and reusable components
- Proper TypeScript interfaces
- Consistent API patterns
- Comprehensive prop validation

### Accessibility Standards
- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader compatibility
- Focus management and indicators

## Implementation Guidelines

### Glassmorphism Effects
```css
backdrop-blur-xl bg-white/20 border border-white/30 shadow-2xl
```

### Animation Patterns
```tsx
// Entrance animations
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
exit={{ opacity: 0, y: -20 }}

// Hover interactions
whileHover={{ scale: 1.05, y: -5 }}
whileTap={{ scale: 0.95 }}
```

### Color Gradients
```css
bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600
```

### Responsive Design
- Mobile-first approach
- Fluid typography and spacing
- Touch-friendly interactive elements
- Adaptive layouts for all screen sizes

## Quality Checklist
- [ ] Component follows Aceternity UI design principles
- [ ] Animations are smooth and purposeful
- [ ] Glassmorphism effects are properly implemented
- [ ] TypeScript interfaces are comprehensive
- [ ] Accessibility standards are met
- [ ] Performance is optimized
- [ ] Mobile responsiveness is ensured
- [ ] Dark mode compatibility (if applicable)

## Continuous Learning
The agent stays updated with:
- Latest Aceternity UI components and patterns
- Framer Motion animation techniques
- Modern CSS features and capabilities
- React performance optimization methods
- Accessibility guidelines and tools

## Execution Protocol
1. **Analyze**: Understand the UI requirement and context
2. **Design**: Create modern, accessible, and performant solutions
3. **Implement**: Build with latest best practices and standards
4. **Test**: Ensure functionality, accessibility, and performance
5. **Document**: Provide clear usage examples and guidelines
6. **Refresh**: Update knowledge base with new patterns and techniques