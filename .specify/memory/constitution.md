<!--
  SYNC IMPACT REPORT
  ==================
  Version Change: INITIAL → 1.0.0
  Type: MAJOR (Initial Constitution)
  
  Constitution Elements:
  - NEW: I. Speed as Core Value
  - NEW: II. Modern Design Excellence
  - NEW: III. Viral Mechanics
  - NEW: IV. Freemium Conversion Focus
  - NEW: V. Test-Driven Development
  - NEW: Technical Architecture section
  - NEW: Code Quality Standards section
  - NEW: Governance section
  
  Templates Requiring Updates:
  ✅ plan-template.md - Constitution Check section already supports dynamic gates
  ✅ spec-template.md - Requirements section already supports constitution alignment
  ✅ tasks-template.md - Test-first approach and task categorization already supported
  
  Follow-up Actions:
  - None - all placeholders filled with concrete values
  - Ready for immediate use in feature development
-->

# snappd Constitution

## Core Principles

### I. Speed as Core Value

Every user interaction MUST complete in under 3 seconds. The complete capture-to-share workflow MUST be under 10 seconds total. Performance is non-negotiable and must be measured for every feature.

**Rationale**: Speed differentiates snappd from competitors and creates a delightful user experience that drives retention. Slow tools get abandoned; fast tools become habits.

### II. Modern Design Excellence

The UI MUST be beautiful, modern, and showcase-worthy using React 19, Next.js, and shadcn/ui for consistent design excellence. Users should want to show off the product itself.

**Rationale**: Visual quality is marketing. A beautiful product generates organic sharing and positions snappd as premium. Consistent components via shadcn/ui ensure design coherence without reinventing the wheel.

### III. Viral Mechanics

Every shared screenshot is a marketing opportunity. The sharing experience MUST reflect product quality and include subtle branding that drives discovery without being intrusive.

**Rationale**: Organic growth through user sharing is the most cost-effective acquisition channel. Each share must convert viewers into curious prospects.

### IV. Freemium Conversion Focus

Features MUST demonstrate clear value that drives 5-10% free-to-paid conversion. Free tier showcases core capabilities; paid tier unlocks power-user workflows.

**Rationale**: Sustainable business model requires converting free users. Features must be designed with conversion psychology in mind from day one, not bolted on later.

### V. Test-Driven Development (NON-NEGOTIABLE)

Tests MUST be written BEFORE implementation for all API endpoints and core annotation logic. Tests must fail, then implementation makes them pass (Red-Green-Refactor cycle). TDD is mandatory for backend and core features; frontend UI components are excluded.

**Rationale**: TDD catches bugs early, enables confident refactoring, serves as living documentation, and ensures API contracts are honored. Frontend tests are valuable but not required due to rapid iteration needs.

## Technical Architecture

### Stack Requirements

**MUST USE:**
- Next.js App Router with React 19 for both frontend and API routes
- Supabase for authentication, database (PostgreSQL), and storage
- Vercel for deployment (zero infrastructure management)
- TypeScript throughout (no plain JavaScript)
- Tailwind CSS for all styling (no inline styles or CSS files)

**API-First Design:**
All functionality MUST be accessible via REST endpoints in `/api` routes before UI implementation. This ensures:
- Mobile clients can be added later without backend rewrite
- Third-party integrations are possible
- Testing is independent of UI
- Clear separation of concerns

**Rationale**: These technologies maximize developer velocity while minimizing operational overhead. Supabase provides production-grade infrastructure without DevOps complexity. Vercel deployment is zero-config. API-first design ensures flexibility for future platforms.

### Library-First Approach

Reusable functionality MUST be extracted into standalone libraries that can be imported across the application. No duplication of business logic across API routes or components.

**Rationale**: Code reuse prevents drift, reduces bugs, and accelerates feature development. Libraries force clear interfaces and single responsibility.

## Code Quality Standards

### Component & Styling Standards

**MUST:**
- Use shadcn/ui components for all UI elements (buttons, forms, modals, etc.)
- Use Tailwind CSS utility classes exclusively for styling
- Follow early return pattern in functions/components
- Use descriptive variable names and handle-prefixed event handlers (`handleClick`, `handleSubmit`)
- Implement accessibility: `tabindex`, `aria-label`, keyboard event handlers

**MUST NOT:**
- Write custom CSS files or inline styles
- Use tertiary operators in class names when `class:` syntax available
- Create generic or unclear variable names (`data`, `item`, `temp`)

**Rationale**: Consistency accelerates development, shadcn/ui provides battle-tested components, Tailwind ensures design system adherence, accessibility is legally required and ethically correct.

### Performance Monitoring

Every feature MUST include:
- Performance measurements for critical user paths
- Optimization targets based on the 3-second interaction rule
- Error boundaries with graceful degradation
- User-friendly error messages (no stack traces shown to users)

**Rationale**: "If you can't measure it, you can't improve it." Performance targets must be validated, not assumed. Users should never see technical errors.

### Modular Architecture

Code MUST maintain clear separation:
- API routes in `/api` (backend logic)
- React components in `/components` (UI)
- Shared utilities in `/lib` (helpers, types, constants)
- No business logic in components
- No UI rendering in API routes

**Rationale**: Clear boundaries prevent spaghetti code, enable testing, and allow team members to work independently on frontend/backend.

### Documentation Requirements

Every API endpoint MUST include:
- Clear JSDoc comments describing purpose, parameters, return values
- Example request/response in comments or separate docs
- Error scenarios and status codes

Every reusable component MUST include:
- Props interface with descriptions
- Usage example in Storybook or comments

**Rationale**: Code is read 10x more than written. Documentation reduces onboarding time and prevents misuse.

### Version History

This constitution uses semantic versioning (MAJOR.MINOR.PATCH):
- **MAJOR**: Backward-incompatible governance changes
- **MINOR**: New principles or materially expanded guidance  
- **PATCH**: Clarifications, wording, non-semantic refinements

**Version**: 1.0.0 | **Ratified**: 2025-10-17 | **Last Amended**: 2025-10-17
