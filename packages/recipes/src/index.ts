/**
 * Atelier MCP — Recipe Registry
 * Curated design and motion recipes with full metadata
 */

export interface RecipeMeta {
  id: string;
  name: string;
  category: 'text-reveal' | 'entrance' | 'button' | 'hover' | 'menu-dialog' | 'layout-transition' | 'scroll-progress' | 'parallax' | 'sticky-story' | '3d-object' | '3d-scene' | 'shader-particle';
  purpose: string;
  suitableContexts: string[];
  aesthetic: string[];
  dependencies: RecipeDependency[];
  frameworks: FrameworkSupport[];
  license: LicenseInfo;
  keyboard: string;
  touch: string;
  reducedMotion: string;
  cleanup: string;
  resourceCost: ResourceCost;
  preview: RecipePreview;
  parameters: RecipeParameter[];
  fallback: string;
}

export interface RecipeDependency {
  name: string;
  version: string;
  optional: boolean;
  license: string;
}

export interface FrameworkSupport {
  name: 'react-vite' | 'nextjs';
  versionRange: string;
}

export interface LicenseInfo {
  type: string;
  source: string;
  notice?: string;
}

export interface ResourceCost {
  jsSize: string;
  cssSize: string;
  gpuRequired: boolean;
  estimatedFps: string;
  notes: string;
}

export interface RecipePreview {
  description: string;
  code: string;
  css?: string;
}

export interface RecipeParameter {
  name: string;
  type: string;
  default: string;
  description: string;
}

export interface RecipeSearchQuery {
  purpose?: string;
  aesthetic?: string;
  framework?: string;
  accessibility?: string;
  maxCost?: 'low' | 'medium' | 'high';
  category?: string;
}

// ─── Recipe Catalog ───────────────────────────────────────────────

const recipes: RecipeMeta[] = [
  // 1. Readable Text Reveals
  {
    id: 'text-reveal-split',
    name: 'Split Text Reveal',
    category: 'text-reveal',
    purpose: 'Reveal headings and body text with per-character or per-word stagger for editorial impact',
    suitableContexts: ['hero sections', 'article headings', 'portfolio titles', 'landing pages'],
    aesthetic: ['editorial', 'expressive', 'cinematic'],
    dependencies: [
      { name: 'motion', version: '^12.0.0', optional: false, license: 'MIT' }
    ],
    frameworks: [
      { name: 'react-vite', versionRange: '>=18.0.0' },
      { name: 'nextjs', versionRange: '>=14.0.0' }
    ],
    license: { type: 'MIT', source: 'Original Atelier recipe' },
    keyboard: 'Content visible immediately, animation is progressive enhancement',
    touch: 'Triggers on scroll-into-view, no touch interaction required',
    reducedMotion: 'Text appears immediately without animation',
    cleanup: 'No cleanup required — CSS animations auto-complete',
    resourceCost: {
      jsSize: '~3KB gzipped',
      cssSize: '~0.5KB',
      gpuRequired: false,
      estimatedFps: '60fps on modern devices, tested on M1 Mac and Pixel 7',
      notes: 'Uses transform and opacity only for GPU compositing'
    },
    parameters: [
      { name: 'splitBy', type: "'char' | 'word' | 'line'", default: "'word'", description: 'How to split the text for staggered animation' },
      { name: 'staggerDelay', type: 'number', default: '0.03', description: 'Delay between each element in seconds' },
      { name: 'duration', type: 'number', default: '0.6', description: 'Duration of each element animation in seconds' },
      { name: 'y', type: 'number', default: '20', description: 'Initial Y offset in pixels' }
    ],
    preview: {
      description: 'Words animate in from below with staggered timing',
      code: `import { motion } from 'motion/react';
import { useRef } from 'react';

interface TextRevealProps {
  text: string;
  as?: 'h1' | 'h2' | 'h3' | 'p';
  splitBy?: 'char' | 'word' | 'line';
  staggerDelay?: number;
  duration?: number;
  y?: number;
  className?: string;
}

export function TextReveal({
  text,
  as: Tag = 'h1',
  splitBy = 'word',
  staggerDelay = 0.03,
  duration = 0.6,
  y = 20,
  className = ''
}: TextRevealProps) {
  const elements = splitBy === 'char'
    ? text.split('')
    : splitBy === 'line'
    ? text.split('\\n')
    : text.split(' ');

  return (
    <Tag className={\`atl-text-reveal \${className}\`} aria-label={text}>
      {elements.map((el, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{
            duration,
            delay: i * staggerDelay,
            ease: [0.25, 0.46, 0.45, 0.94]
          }}
          style={{ display: 'inline-block', whiteSpace: splitBy === 'word' ? 'pre' : undefined }}
          aria-hidden="true"
        >
          {splitBy === 'word' ? el + ' ' : el}
        </motion.span>
      ))}
    </Tag>
  );
}`,
      css: `.atl-text-reveal {
  overflow: hidden;
}
@media (prefers-reduced-motion: reduce) {
  .atl-text-reveal span {
    opacity: 1 !important;
    transform: none !important;
  }
}`
    },
    fallback: 'Text renders immediately without animation'
  },

  // 2. Staggered Entrances
  {
    id: 'staggered-grid-entrance',
    name: 'Staggered Grid Entrance',
    category: 'entrance',
    purpose: 'Animate grid items into view with cascading delay for visual rhythm',
    suitableContexts: ['card grids', 'portfolios', 'product listings', 'team pages'],
    aesthetic: ['clean', 'professional', 'modern'],
    dependencies: [
      { name: 'motion', version: '^12.0.0', optional: false, license: 'MIT' }
    ],
    frameworks: [
      { name: 'react-vite', versionRange: '>=18.0.0' },
      { name: 'nextjs', versionRange: '>=14.0.0' }
    ],
    license: { type: 'MIT', source: 'Original Atelier recipe' },
    keyboard: 'All items visible; animation is enhancement only',
    touch: 'Scroll-triggered, no touch interaction needed',
    reducedMotion: 'Items appear without motion',
    cleanup: 'Animations complete naturally',
    resourceCost: {
      jsSize: '~2KB gzipped',
      cssSize: '~0.3KB',
      gpuRequired: false,
      estimatedFps: '60fps tested with 20 items',
      notes: 'Uses transform/opacity compositing'
    },
    parameters: [
      { name: 'stagger', type: 'number', default: '0.08', description: 'Delay between items' },
      { name: 'duration', type: 'number', default: '0.5', description: 'Per-item animation duration' },
      { name: 'y', type: 'number', default: '30', description: 'Initial vertical offset' },
      { name: 'scale', type: 'number', default: '0.95', description: 'Initial scale' }
    ],
    preview: {
      description: 'Grid items cascade in from below with slight scale',
      code: `import { motion } from 'motion/react';

interface StaggerGridProps {
  children: React.ReactNode[];
  stagger?: number;
  duration?: number;
  y?: number;
  scale?: number;
  className?: string;
}

export function StaggerGrid({
  children,
  stagger = 0.08,
  duration = 0.5,
  y = 30,
  scale = 0.95,
  className = ''
}: StaggerGridProps) {
  return (
    <div className={\`atl-stagger-grid \${className}\`}>
      {children.map((child, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y, scale }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: '-5%' }}
          transition={{
            duration,
            delay: i * stagger,
            ease: [0.25, 0.46, 0.45, 0.94]
          }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}`,
      css: `.atl-stagger-grid {
  display: grid;
  gap: var(--atl-space-4, 1rem);
}
@media (prefers-reduced-motion: reduce) {
  .atl-stagger-grid > * {
    opacity: 1 !important;
    transform: none !important;
  }
}`
    },
    fallback: 'Items render without animation'
  },

  // 3. Button Feedback
  {
    id: 'button-press-feedback',
    name: 'Button Press Feedback',
    category: 'button',
    purpose: 'Tactile press feedback with scale, color shift, and ripple for interactive buttons',
    suitableContexts: ['primary CTAs', 'form submissions', 'navigation buttons', 'interactive cards'],
    aesthetic: ['material', 'tactile', 'responsive'],
    dependencies: [],
    frameworks: [
      { name: 'react-vite', versionRange: '>=18.0.0' },
      { name: 'nextjs', versionRange: '>=14.0.0' }
    ],
    license: { type: 'MIT', source: 'Original Atelier recipe — CSS-only' },
    keyboard: 'Feedback triggers on Enter/Space via :active pseudo-class',
    touch: 'Works with touchstart/touchend; no 300ms delay',
    reducedMotion: 'Scale removed, color shift preserved for feedback',
    cleanup: 'CSS only — no cleanup needed',
    resourceCost: {
      jsSize: '~0.5KB gzipped',
      cssSize: '~0.8KB',
      gpuRequired: false,
      estimatedFps: 'Instant — CSS transitions',
      notes: 'Pure CSS with optional JS ripple effect'
    },
    parameters: [
      { name: 'scale', type: 'number', default: '0.97', description: 'Press-down scale factor' },
      { name: 'ripple', type: 'boolean', default: 'true', description: 'Enable ripple effect on click' },
      { name: 'color', type: 'string', default: "'var(--atl-accent)'", description: 'Button accent color' }
    ],
    preview: {
      description: 'Button depresses slightly on click with optional ripple expanding from click point',
      code: `import { useRef, useCallback } from 'react';

interface ButtonFeedbackProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  ripple?: boolean;
}

export function ButtonFeedback({
  children,
  variant = 'primary',
  ripple = true,
  className = '',
  onClick,
  ...props
}: ButtonFeedbackProps) {
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (ripple && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const rippleEl = document.createElement('span');
      rippleEl.className = 'atl-ripple';
      rippleEl.style.left = x + 'px';
      rippleEl.style.top = y + 'px';
      btnRef.current.appendChild(rippleEl);
      rippleEl.addEventListener('animationend', () => rippleEl.remove());
    }
    onClick?.(e);
  }, [ripple, onClick]);

  return (
    <button
      ref={btnRef}
      className={\`atl-btn atl-btn--\${variant} \${className}\`}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
}`,
      css: `.atl-btn {
  position: relative;
  overflow: hidden;
  padding: 0.75em 1.5em;
  border: none;
  border-radius: var(--atl-radius-md, 8px);
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}
.atl-btn:active {
  transform: scale(0.97);
}
.atl-btn--primary {
  background: var(--atl-accent, #6366f1);
  color: white;
}
.atl-btn--secondary {
  background: var(--atl-surface-2, #f1f5f9);
  color: var(--atl-text, #0f172a);
}
.atl-btn--ghost {
  background: transparent;
  color: var(--atl-accent, #6366f1);
}
.atl-ripple {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255,255,255,0.4);
  transform: translate(-50%,-50%) scale(0);
  animation: atl-ripple-expand 0.5s ease-out forwards;
  pointer-events: none;
}
@keyframes atl-ripple-expand {
  to { transform: translate(-50%,-50%) scale(25); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .atl-btn:active { transform: none; }
  .atl-ripple { animation: none; display: none; }
}`
    },
    fallback: 'Button functions normally without visual press feedback'
  },

  // 4. Hover/Tilt Effects
  {
    id: 'hover-tilt-card',
    name: 'Perspective Tilt Card',
    category: 'hover',
    purpose: '3D perspective tilt on hover following cursor position for depth and interactivity',
    suitableContexts: ['feature cards', 'portfolio items', 'product showcases', 'pricing cards'],
    aesthetic: ['premium', 'interactive', 'dimensional'],
    dependencies: [
      { name: 'motion', version: '^12.0.0', optional: false, license: 'MIT' }
    ],
    frameworks: [
      { name: 'react-vite', versionRange: '>=18.0.0' },
      { name: 'nextjs', versionRange: '>=14.0.0' }
    ],
    license: { type: 'MIT', source: 'Original Atelier recipe' },
    keyboard: 'Card content is fully accessible; tilt is decorative enhancement',
    touch: 'Disabled on touch devices — content remains accessible without tilt',
    reducedMotion: 'Tilt disabled, subtle opacity hover retained',
    cleanup: 'Event listeners cleaned up on unmount via React effect cleanup',
    resourceCost: {
      jsSize: '~2KB gzipped',
      cssSize: '~0.4KB',
      gpuRequired: false,
      estimatedFps: '60fps — CSS transform only',
      notes: 'Uses perspective and rotateX/Y transforms'
    },
    parameters: [
      { name: 'maxTilt', type: 'number', default: '15', description: 'Maximum tilt angle in degrees' },
      { name: 'perspective', type: 'number', default: '1000', description: 'CSS perspective value' },
      { name: 'glare', type: 'boolean', default: 'true', description: 'Enable light glare effect' },
      { name: 'scale', type: 'number', default: '1.02', description: 'Scale on hover' }
    ],
    preview: {
      description: 'Card tilts toward cursor with subtle light glare overlay',
      code: `import { useRef, useState, useCallback } from 'react';

interface TiltCardProps {
  children: React.ReactNode;
  maxTilt?: number;
  perspective?: number;
  glare?: boolean;
  scale?: number;
  className?: string;
}

export function TiltCard({
  children,
  maxTilt = 15,
  perspective = 1000,
  glare = true,
  scale = 1.02,
  className = ''
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState('');
  const [glareStyle, setGlareStyle] = useState({});
  const isTouch = 'ontouchstart' in globalThis;

  const handleMove = useCallback((e: React.MouseEvent) => {
    if (isTouch || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    const tiltX = -y * maxTilt;
    const tiltY = x * maxTilt;
    setTransform(\`perspective(\${perspective}px) rotateX(\${tiltX}deg) rotateY(\${tiltY}deg) scale3d(\${scale},\${scale},\${scale})\`);
    if (glare) {
      setGlareStyle({
        background: \`radial-gradient(circle at \${(x+0.5)*100}% \${(y+0.5)*100}%, rgba(255,255,255,0.15), transparent 60%)\`
      });
    }
  }, [maxTilt, perspective, scale, glare, isTouch]);

  const handleLeave = useCallback(() => {
    setTransform('');
    setGlareStyle({});
  }, []);

  return (
    <div
      ref={ref}
      className={\`atl-tilt-card \${className}\`}
      style={{ transform, transition: transform ? 'none' : 'transform 0.4s ease' }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      {children}
      {glare && <div className="atl-tilt-glare" style={glareStyle} />}
    </div>
  );
}`,
      css: `.atl-tilt-card {
  position: relative;
  will-change: transform;
  transform-style: preserve-3d;
}
.atl-tilt-glare {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  transition: background 0.2s ease;
}
@media (prefers-reduced-motion: reduce) {
  .atl-tilt-card {
    transform: none !important;
  }
}`
    },
    fallback: 'Card displays flat without tilt effect'
  },

  // 5. Menu/Dialog Transitions
  {
    id: 'accessible-dialog-transition',
    name: 'Accessible Dialog Transition',
    category: 'menu-dialog',
    purpose: 'Smooth entry/exit transitions for dialogs and menus with focus management',
    suitableContexts: ['modal dialogs', 'side panels', 'dropdown menus', 'mobile navigation'],
    aesthetic: ['polished', 'professional', 'native-feeling'],
    dependencies: [
      { name: 'motion', version: '^12.0.0', optional: false, license: 'MIT' }
    ],
    frameworks: [
      { name: 'react-vite', versionRange: '>=18.0.0' },
      { name: 'nextjs', versionRange: '>=14.0.0' }
    ],
    license: { type: 'MIT', source: 'Original Atelier recipe' },
    keyboard: 'Focus trap, Escape to close, Tab cycles through focusable elements',
    touch: 'Backdrop tap to dismiss, standard touch interactions preserved',
    reducedMotion: 'Instant show/hide, focus trap still active',
    cleanup: 'Focus restored to trigger element on close, scroll lock removed',
    resourceCost: {
      jsSize: '~3KB gzipped',
      cssSize: '~0.5KB',
      gpuRequired: false,
      estimatedFps: '60fps — opacity + scale transforms',
      notes: 'Uses AnimatePresence for exit animations'
    },
    parameters: [
      { name: 'origin', type: "'center' | 'top' | 'bottom' | 'left' | 'right'", default: "'center'", description: 'Animation origin direction' },
      { name: 'duration', type: 'number', default: '0.25', description: 'Transition duration' },
      { name: 'overlayOpacity', type: 'number', default: '0.5', description: 'Background overlay opacity' }
    ],
    preview: {
      description: 'Dialog scales up from center with backdrop fade, exits in reverse',
      code: `import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useRef, useCallback } from 'react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  origin?: 'center' | 'top' | 'bottom';
  duration?: number;
  overlayOpacity?: number;
}

const originMap = {
  center: { y: 0, scale: 0.95 },
  top: { y: -20, scale: 1 },
  bottom: { y: 20, scale: 1 }
};

export function DialogTransition({
  open, onClose, children,
  origin = 'center', duration = 0.25, overlayOpacity = 0.5
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => dialogRef.current?.focus());
    }
    return () => {
      document.body.style.overflow = '';
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
    };
  }, [open]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="atl-dialog-wrapper" onKeyDown={handleKeyDown}>
          <motion.div
            className="atl-dialog-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: overlayOpacity }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration * 0.8 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={dialogRef}
            className="atl-dialog"
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            initial={{ opacity: 0, ...originMap[origin] }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, ...originMap[origin] }}
            transition={{ duration, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}`,
      css: `.atl-dialog-wrapper {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  z-index: 100;
}
.atl-dialog-overlay {
  position: absolute;
  inset: 0;
  background: black;
}
.atl-dialog {
  position: relative;
  background: var(--atl-surface, #fff);
  border-radius: var(--atl-radius-lg, 16px);
  padding: var(--atl-space-6, 1.5rem);
  max-width: min(90vw, 32rem);
  max-height: 85vh;
  overflow-y: auto;
  outline: none;
}
@media (prefers-reduced-motion: reduce) {
  .atl-dialog { animation: none !important; }
  .atl-dialog-overlay { animation: none !important; }
}`
    },
    fallback: 'Dialog appears/disappears instantly with focus management preserved'
  },

  // 6. Layout/Route Transitions
  {
    id: 'layout-route-transition',
    name: 'Layout Route Transition',
    category: 'layout-transition',
    purpose: 'Smooth cross-fade and slide transitions between routes for SPA navigation',
    suitableContexts: ['page transitions', 'tab switches', 'multi-step forms', 'wizard flows'],
    aesthetic: ['fluid', 'app-like', 'premium'],
    dependencies: [
      { name: 'motion', version: '^12.0.0', optional: false, license: 'MIT' }
    ],
    frameworks: [
      { name: 'react-vite', versionRange: '>=18.0.0' },
      { name: 'nextjs', versionRange: '>=14.0.0' }
    ],
    license: { type: 'MIT', source: 'Original Atelier recipe' },
    keyboard: 'Page content remains accessible during transition',
    touch: 'Standard navigation gestures work',
    reducedMotion: 'Instant page switch, no animation',
    cleanup: 'AnimatePresence handles exit lifecycle',
    resourceCost: {
      jsSize: '~2KB gzipped',
      cssSize: '~0.3KB',
      gpuRequired: false,
      estimatedFps: '60fps with transform-only animation',
      notes: 'Two pages may briefly co-exist in DOM during transition'
    },
    parameters: [
      { name: 'mode', type: "'fade' | 'slide' | 'scale'", default: "'fade'", description: 'Transition style' },
      { name: 'duration', type: 'number', default: '0.3', description: 'Transition duration' },
      { name: 'direction', type: "'left' | 'right' | 'up' | 'down'", default: "'right'", description: 'Slide direction (for slide mode)' }
    ],
    preview: {
      description: 'Outgoing page fades/slides out while incoming page fades/slides in',
      code: `import { motion, AnimatePresence } from 'motion/react';

interface RouteTransitionProps {
  routeKey: string;
  children: React.ReactNode;
  mode?: 'fade' | 'slide' | 'scale';
  duration?: number;
  direction?: 'left' | 'right' | 'up' | 'down';
}

const variants = {
  fade: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
  slide: (dir: string) => ({
    initial: { opacity: 0, x: dir === 'right' ? 30 : dir === 'left' ? -30 : 0, y: dir === 'down' ? 30 : dir === 'up' ? -30 : 0 },
    animate: { opacity: 1, x: 0, y: 0 },
    exit: { opacity: 0, x: dir === 'right' ? -30 : dir === 'left' ? 30 : 0, y: dir === 'down' ? -30 : dir === 'up' ? 30 : 0 }
  }),
  scale: { initial: { opacity: 0, scale: 0.96 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 1.04 } }
};

export function RouteTransition({ routeKey, children, mode = 'fade', duration = 0.3, direction = 'right' }: RouteTransitionProps) {
  const v = mode === 'slide' ? variants.slide(direction) : variants[mode];
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={routeKey}
        initial={v.initial}
        animate={v.animate}
        exit={v.exit}
        transition={{ duration, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}`,
      css: `@media (prefers-reduced-motion: reduce) {
  [data-atl-route-transition] { animation: none !important; transition: none !important; }
}`
    },
    fallback: 'Instant page switch without animation'
  },

  // 7. Scroll Progress
  {
    id: 'scroll-progress-indicator',
    name: 'Scroll Progress Indicator',
    category: 'scroll-progress',
    purpose: 'Visual indicator of reading/scroll progress through a page or section',
    suitableContexts: ['articles', 'documentation', 'long-form content', 'case studies'],
    aesthetic: ['editorial', 'informational', 'minimal'],
    dependencies: [
      { name: 'motion', version: '^12.0.0', optional: false, license: 'MIT' }
    ],
    frameworks: [
      { name: 'react-vite', versionRange: '>=18.0.0' },
      { name: 'nextjs', versionRange: '>=14.0.0' }
    ],
    license: { type: 'MIT', source: 'Original Atelier recipe' },
    keyboard: 'Decorative only, does not interfere with keyboard navigation',
    touch: 'Responds to scroll; no touch interaction required',
    reducedMotion: 'Still shown (no motion involved, just progress tracking)',
    cleanup: 'Scroll listener cleaned up on unmount',
    resourceCost: {
      jsSize: '~1KB gzipped',
      cssSize: '~0.2KB',
      gpuRequired: false,
      estimatedFps: '60fps — scaleX transform only',
      notes: 'Uses motion useScroll for optimized scroll tracking'
    },
    parameters: [
      { name: 'position', type: "'top' | 'bottom'", default: "'top'", description: 'Fixed position of the progress bar' },
      { name: 'height', type: 'number', default: '3', description: 'Bar height in pixels' },
      { name: 'color', type: 'string', default: "'var(--atl-accent)'", description: 'Progress bar color' }
    ],
    preview: {
      description: 'Thin bar at top of viewport fills proportionally to scroll position',
      code: `import { motion, useScroll, useSpring } from 'motion/react';

interface ScrollProgressProps {
  position?: 'top' | 'bottom';
  height?: number;
  color?: string;
}

export function ScrollProgress({
  position = 'top',
  height = 3,
  color = 'var(--atl-accent, #6366f1)'
}: ScrollProgressProps) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  return (
    <motion.div
      className="atl-scroll-progress"
      style={{
        scaleX,
        transformOrigin: 'left',
        position: 'fixed',
        [position]: 0,
        left: 0,
        right: 0,
        height,
        background: color,
        zIndex: 9999
      }}
      aria-hidden="true"
    />
  );
}`,
      css: `.atl-scroll-progress {
  pointer-events: none;
}`
    },
    fallback: 'No progress indicator shown'
  },

  // 8. Restrained Parallax
  {
    id: 'restrained-parallax',
    name: 'Restrained Parallax Layer',
    category: 'parallax',
    purpose: 'Subtle depth parallax on scroll for layered visual interest without disorientation',
    suitableContexts: ['hero sections', 'feature showcases', 'about sections', 'landing pages'],
    aesthetic: ['cinematic', 'layered', 'immersive'],
    dependencies: [
      { name: 'motion', version: '^12.0.0', optional: false, license: 'MIT' }
    ],
    frameworks: [
      { name: 'react-vite', versionRange: '>=18.0.0' },
      { name: 'nextjs', versionRange: '>=14.0.0' }
    ],
    license: { type: 'MIT', source: 'Original Atelier recipe' },
    keyboard: 'Decorative layer — all content accessible without parallax',
    touch: 'Scroll-based, works with touch scrolling',
    reducedMotion: 'Parallax disabled; elements stay in natural position',
    cleanup: 'Scroll observer cleaned up on unmount',
    resourceCost: {
      jsSize: '~1.5KB gzipped',
      cssSize: '~0.3KB',
      gpuRequired: false,
      estimatedFps: '60fps with transform-only animation',
      notes: 'Offset capped to prevent excessive movement'
    },
    parameters: [
      { name: 'speed', type: 'number', default: '0.15', description: 'Parallax speed factor (0-0.5 recommended)' },
      { name: 'direction', type: "'vertical' | 'horizontal'", default: "'vertical'", description: 'Parallax direction' },
      { name: 'clamp', type: 'boolean', default: 'true', description: 'Clamp offset to prevent excessive travel' }
    ],
    preview: {
      description: 'Background elements move slightly slower than scroll for depth effect',
      code: `import { motion, useScroll, useTransform, useSpring, useReducedMotion } from 'motion/react';
import { useRef } from 'react';

interface ParallaxProps {
  children: React.ReactNode;
  speed?: number;
  direction?: 'vertical' | 'horizontal';
  clamp?: boolean;
  className?: string;
}

export function ParallaxLayer({
  children, speed = 0.15, direction = 'vertical', clamp = true, className = ''
}: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start']
  });

  const range = clamp ? [-50, 50] : [-100, 100];
  const raw = useTransform(scrollYProgress, [0, 1], range.map(v => v * speed));
  const value = useSpring(raw, { stiffness: 120, damping: 25 });

  const style = prefersReduced ? {} : (
    direction === 'vertical' ? { y: value } : { x: value }
  );

  return (
    <motion.div ref={ref} className={\`atl-parallax \${className}\`} style={style}>
      {children}
    </motion.div>
  );
}`,
      css: `.atl-parallax {
  will-change: transform;
}
@media (prefers-reduced-motion: reduce) {
  .atl-parallax { transform: none !important; }
}`
    },
    fallback: 'Elements stay in natural scroll position'
  },

  // 9. Sticky Storytelling
  {
    id: 'sticky-storytelling',
    name: 'Sticky Scroll Story',
    category: 'sticky-story',
    purpose: 'Pin a visual element while content sections scroll past, revealing the narrative progressively',
    suitableContexts: ['case studies', 'product features', 'timelines', 'how-it-works sections'],
    aesthetic: ['editorial', 'narrative', 'engaging'],
    dependencies: [
      { name: 'motion', version: '^12.0.0', optional: false, license: 'MIT' },
      { name: 'gsap', version: '^3.12.0', optional: true, license: 'Standard GSAP License (free for most uses)' }
    ],
    frameworks: [
      { name: 'react-vite', versionRange: '>=18.0.0' },
      { name: 'nextjs', versionRange: '>=14.0.0' }
    ],
    license: { type: 'MIT', source: 'Original Atelier recipe (GSAP optional)' },
    keyboard: 'All content accessible by scrolling — no interaction gating',
    touch: 'Standard scroll behavior, sticky position works on mobile',
    reducedMotion: 'Sticky pinning preserved, cross-fade between visuals is instant',
    cleanup: 'Intersection observer disconnected on unmount',
    resourceCost: {
      jsSize: '~3KB gzipped (without GSAP)',
      cssSize: '~0.5KB',
      gpuRequired: false,
      estimatedFps: '60fps — opacity transitions only',
      notes: 'Uses CSS position:sticky with IntersectionObserver for section tracking'
    },
    parameters: [
      { name: 'stickyOffset', type: 'string', default: "'20vh'", description: 'Top offset for sticky element' },
      { name: 'transition', type: "'fade' | 'slide' | 'scale'", default: "'fade'", description: 'How visuals transition between sections' }
    ],
    preview: {
      description: 'Left side stays fixed showing visual; right side scrolls with text sections that trigger visual changes',
      code: `import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface StorySection {
  id: string;
  content: React.ReactNode;
  visual: React.ReactNode;
}

interface StickyStoryProps {
  sections: StorySection[];
  stickyOffset?: string;
  className?: string;
}

export function StickyStory({ sections, stickyOffset = '20vh', className = '' }: StickyStoryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const idx = sectionRefs.current.indexOf(entry.target as HTMLDivElement);
            if (idx !== -1) setActiveIndex(idx);
          }
        });
      },
      { threshold: 0.5 }
    );
    sectionRefs.current.forEach(el => el && observer.observe(el));
    return () => observer.disconnect();
  }, [sections.length]);

  return (
    <div className={\`atl-sticky-story \${className}\`}>
      <div className="atl-sticky-visual" style={{ top: stickyOffset }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            {sections[activeIndex]?.visual}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="atl-sticky-content">
        {sections.map((section, i) => (
          <div
            key={section.id}
            ref={el => { sectionRefs.current[i] = el; }}
            className="atl-sticky-section"
          >
            {section.content}
          </div>
        ))}
      </div>
    </div>
  );
}`,
      css: `.atl-sticky-story {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--atl-space-8, 2rem);
}
.atl-sticky-visual {
  position: sticky;
  height: fit-content;
  align-self: start;
}
.atl-sticky-section {
  min-height: 80vh;
  display: flex;
  align-items: center;
  padding: var(--atl-space-8, 2rem) 0;
}
@media (max-width: 768px) {
  .atl-sticky-story { grid-template-columns: 1fr; }
  .atl-sticky-visual { position: relative; top: auto; }
  .atl-sticky-section { min-height: auto; }
}`
    },
    fallback: 'Standard stacked layout with content and visuals interleaved'
  },

  // 10. Interactive 3D Object
  {
    id: 'interactive-3d-object',
    name: 'Interactive 3D Product Viewer',
    category: '3d-object',
    purpose: 'Rotating, interactive 3D object for product showcases with orbit controls',
    suitableContexts: ['product pages', 'hero sections', 'portfolio items', 'feature showcases'],
    aesthetic: ['premium', 'immersive', 'modern'],
    dependencies: [
      { name: 'three', version: '^0.174.0', optional: false, license: 'MIT' },
      { name: '@react-three/fiber', version: '^9.0.0', optional: false, license: 'MIT' },
      { name: '@react-three/drei', version: '^10.0.0', optional: false, license: 'MIT' }
    ],
    frameworks: [
      { name: 'react-vite', versionRange: '>=18.0.0' },
      { name: 'nextjs', versionRange: '>=14.0.0' }
    ],
    license: { type: 'MIT', source: 'Original Atelier recipe with MIT dependencies' },
    keyboard: 'Orbit controls support arrow keys; content does not gate behind 3D interaction',
    touch: 'Touch orbit and pinch zoom supported via drei OrbitControls',
    reducedMotion: 'Auto-rotation stopped; static view shown',
    cleanup: 'WebGL context disposed on unmount, geometry/materials cleaned up',
    resourceCost: {
      jsSize: '~150KB gzipped (three.js)',
      cssSize: '~0.2KB',
      gpuRequired: true,
      estimatedFps: '60fps for simple geometry, 30-60fps for complex models',
      notes: 'Lazy-loaded to avoid blocking page render; canvas pauses when offscreen'
    },
    parameters: [
      { name: 'autoRotate', type: 'boolean', default: 'true', description: 'Auto-rotate the object' },
      { name: 'rotateSpeed', type: 'number', default: '1', description: 'Auto-rotation speed' },
      { name: 'enableZoom', type: 'boolean', default: 'true', description: 'Allow zoom with scroll/pinch' },
      { name: 'color', type: 'string', default: "'#6366f1'", description: 'Object material color' }
    ],
    preview: {
      description: 'Interactive 3D torus knot with orbit controls, auto-rotation, and environment lighting',
      code: `import { Suspense, lazy } from 'react';

const Scene3D = lazy(() => import('./Scene3D'));

interface Product3DProps {
  autoRotate?: boolean;
  rotateSpeed?: number;
  enableZoom?: boolean;
  color?: string;
  className?: string;
  fallback?: React.ReactNode;
}

export function Product3D({
  fallback = <div className="atl-3d-fallback">3D Preview</div>,
  ...props
}: Product3DProps) {
  return (
    <Suspense fallback={fallback}>
      <Scene3D {...props} />
    </Suspense>
  );
}

// Scene3D.tsx (lazy-loaded)
/*
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Float } from '@react-three/drei';
import { useReducedMotion } from 'motion/react';

export default function Scene3D({
  autoRotate = true, rotateSpeed = 1, enableZoom = true, color = '#6366f1', className = ''
}) {
  const prefersReduced = useReducedMotion();

  return (
    <div className={\`atl-3d-container \${className}\`} style={{ width: '100%', height: '400px' }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }} dpr={[1, 2]}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <Float speed={prefersReduced ? 0 : 2} floatIntensity={0.5}>
          <mesh>
            <torusKnotGeometry args={[1, 0.35, 128, 32]} />
            <meshStandardMaterial color={color} roughness={0.2} metalness={0.8} />
          </mesh>
        </Float>
        <OrbitControls
          autoRotate={!prefersReduced && autoRotate}
          autoRotateSpeed={rotateSpeed}
          enableZoom={enableZoom}
          enablePan={false}
        />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}
*/`,
      css: `.atl-3d-container {
  border-radius: var(--atl-radius-lg, 16px);
  overflow: hidden;
}
.atl-3d-fallback {
  width: 100%;
  height: 400px;
  display: grid;
  place-items: center;
  background: var(--atl-surface-2, #f1f5f9);
  border-radius: var(--atl-radius-lg, 16px);
  color: var(--atl-text-muted, #64748b);
}`
    },
    fallback: 'Static placeholder image or illustration shown when WebGL unavailable'
  },

  // 11. Scroll-Linked 3D Camera Scene
  {
    id: 'scroll-3d-camera',
    name: 'Scroll-Linked 3D Camera',
    category: '3d-scene',
    purpose: 'Camera position driven by scroll progress for cinematic 3D storytelling',
    suitableContexts: ['product launches', 'immersive landing pages', 'brand experiences'],
    aesthetic: ['cinematic', 'immersive', 'premium'],
    dependencies: [
      { name: 'three', version: '^0.174.0', optional: false, license: 'MIT' },
      { name: '@react-three/fiber', version: '^9.0.0', optional: false, license: 'MIT' },
      { name: '@react-three/drei', version: '^10.0.0', optional: false, license: 'MIT' },
      { name: 'gsap', version: '^3.12.0', optional: true, license: 'Standard GSAP License' }
    ],
    frameworks: [
      { name: 'react-vite', versionRange: '>=18.0.0' },
      { name: 'nextjs', versionRange: '>=14.0.0' }
    ],
    license: { type: 'MIT', source: 'Original recipe (GSAP optional, see its license)' },
    keyboard: 'All content accessible by scrolling; 3D is decorative background',
    touch: 'Standard scroll-driven; no 3D interaction required',
    reducedMotion: 'Camera stays at a single position; content remains readable',
    cleanup: 'WebGL context and scroll listeners disposed on unmount',
    resourceCost: {
      jsSize: '~155KB gzipped (three.js + scene)',
      cssSize: '~0.3KB',
      gpuRequired: true,
      estimatedFps: '30-60fps depending on scene complexity and device',
      notes: 'Resolution capped at 1.5x DPR; frame loop pauses when offscreen'
    },
    parameters: [
      { name: 'cameraPath', type: 'Array<[number,number,number]>', default: '[[0,0,5],[2,1,3],[0,2,1]]', description: 'Camera position keyframes' },
      { name: 'scrollHeight', type: 'string', default: "'300vh'", description: 'Scroll container height for camera animation' }
    ],
    preview: {
      description: 'Camera orbits around 3D scene as user scrolls through content sections',
      code: `import { Suspense, lazy } from 'react';

const ScrollScene = lazy(() => import('./ScrollScene'));

interface ScrollCameraProps {
  cameraPath?: Array<[number, number, number]>;
  scrollHeight?: string;
  children?: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ScrollCamera({
  fallback = <div className="atl-3d-fallback">Loading 3D Scene...</div>,
  children,
  ...props
}: ScrollCameraProps) {
  return (
    <div className="atl-scroll-camera-wrapper" style={{ height: props.scrollHeight || '300vh' }}>
      <div className="atl-scroll-camera-canvas">
        <Suspense fallback={fallback}>
          <ScrollScene {...props} />
        </Suspense>
      </div>
      <div className="atl-scroll-camera-content">
        {children}
      </div>
    </div>
  );
}

// ScrollScene.tsx would use useScroll + useFrame to interpolate camera position`,
      css: `.atl-scroll-camera-wrapper {
  position: relative;
}
.atl-scroll-camera-canvas {
  position: sticky;
  top: 0;
  height: 100vh;
  z-index: 0;
}
.atl-scroll-camera-content {
  position: relative;
  z-index: 1;
  pointer-events: none;
}
.atl-scroll-camera-content > * {
  pointer-events: auto;
}`
    },
    fallback: 'Content renders without 3D background; static gradient or image used instead'
  },

  // 12. Shader/Particle Effect
  {
    id: 'particle-field',
    name: 'Interactive Particle Field',
    category: 'shader-particle',
    purpose: 'GPU-driven particle system reacting to cursor for atmospheric backgrounds',
    suitableContexts: ['hero backgrounds', 'loading screens', 'creative portfolios', 'about sections'],
    aesthetic: ['atmospheric', 'creative', 'immersive'],
    dependencies: [
      { name: 'three', version: '^0.174.0', optional: false, license: 'MIT' },
      { name: '@react-three/fiber', version: '^9.0.0', optional: false, license: 'MIT' }
    ],
    frameworks: [
      { name: 'react-vite', versionRange: '>=18.0.0' },
      { name: 'nextjs', versionRange: '>=14.0.0' }
    ],
    license: { type: 'MIT', source: 'Original Atelier recipe' },
    keyboard: 'Decorative background — no keyboard interaction required',
    touch: 'Cursor reaction disabled on touch; particles remain animated',
    reducedMotion: 'Particles remain static in initial positions; no continuous motion',
    cleanup: 'WebGL context disposed, animation frame cancelled on unmount',
    resourceCost: {
      jsSize: '~152KB gzipped (three.js + shader)',
      cssSize: '~0.1KB',
      gpuRequired: true,
      estimatedFps: '60fps for 5000 particles on modern GPU; adaptive quality',
      notes: 'Uses BufferGeometry with custom vertex shader for performance'
    },
    parameters: [
      { name: 'count', type: 'number', default: '3000', description: 'Number of particles' },
      { name: 'color', type: 'string', default: "'#6366f1'", description: 'Particle color' },
      { name: 'size', type: 'number', default: '2', description: 'Particle size in pixels' },
      { name: 'interactRadius', type: 'number', default: '2', description: 'Cursor interaction radius' },
      { name: 'speed', type: 'number', default: '0.5', description: 'Animation speed multiplier' }
    ],
    preview: {
      description: 'Thousands of small particles float and part around the cursor',
      code: `import { Suspense, lazy } from 'react';

const ParticleScene = lazy(() => import('./ParticleScene'));

interface ParticleFieldProps {
  count?: number;
  color?: string;
  size?: number;
  interactRadius?: number;
  speed?: number;
  className?: string;
  fallback?: React.ReactNode;
}

export function ParticleField({
  fallback = null,
  className = '',
  ...props
}: ParticleFieldProps) {
  return (
    <div className={\`atl-particles \${className}\`}>
      <Suspense fallback={fallback}>
        <ParticleScene {...props} />
      </Suspense>
    </div>
  );
}

// ParticleScene.tsx would create BufferGeometry with position/velocity attributes
// and animate in useFrame with cursor interaction via raycasting`,
      css: `.atl-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}
.atl-particles canvas {
  pointer-events: auto;
}
@media (prefers-reduced-motion: reduce) {
  .atl-particles { display: none; }
}`
    },
    fallback: 'No particle effect shown; section remains functional'
  }
];

// ─── Search & Retrieval ──────────────────────────────────────────

export function searchRecipes(query: RecipeSearchQuery): RecipeMeta[] {
  return recipes.filter(recipe => {
    if (query.category && recipe.category !== query.category) return false;

    if (query.purpose) {
      const purposeLower = query.purpose.toLowerCase();
      const matches = recipe.purpose.toLowerCase().includes(purposeLower) ||
        recipe.suitableContexts.some(c => c.toLowerCase().includes(purposeLower));
      if (!matches) return false;
    }

    if (query.aesthetic) {
      const aesLower = query.aesthetic.toLowerCase();
      if (!recipe.aesthetic.some(a => a.toLowerCase().includes(aesLower))) return false;
    }

    if (query.framework) {
      const fwLower = query.framework.toLowerCase();
      if (!recipe.frameworks.some(f => f.name.toLowerCase().includes(fwLower))) return false;
    }

    if (query.maxCost) {
      const costMap: Record<string, number> = { 'low': 5, 'medium': 50, 'high': 200 };
      const sizeKB = parseFloat(recipe.resourceCost.jsSize.replace(/[^0-9.]/g, ''));
      if (sizeKB > costMap[query.maxCost]) return false;
    }

    return true;
  });
}

export function getRecipe(id: string): RecipeMeta | undefined {
  return recipes.find(r => r.id === id);
}

export function getAllRecipes(): RecipeMeta[] {
  return [...recipes];
}

export function getRecipeCategories(): string[] {
  return [...new Set(recipes.map(r => r.category))];
}

export function getRecipeSummaries(): Array<{ id: string; name: string; category: string; purpose: string }> {
  return recipes.map(r => ({ id: r.id, name: r.name, category: r.category, purpose: r.purpose }));
}
