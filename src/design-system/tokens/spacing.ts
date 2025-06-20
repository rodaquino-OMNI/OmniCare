/**
 * OmniCare Design System - Spacing & Layout Tokens
 * 
 * Consistent spacing system based on 4px grid
 * Optimized for healthcare interface density and accessibility
 */

// Base spacing unit (4px)
const BASE_UNIT = 4;

// Spacing scale
export const spacing = {
  0: '0px',
  0.5: `${BASE_UNIT * 0.5}px`,  // 2px
  1: `${BASE_UNIT * 1}px`,      // 4px
  1.5: `${BASE_UNIT * 1.5}px`,  // 6px
  2: `${BASE_UNIT * 2}px`,      // 8px
  2.5: `${BASE_UNIT * 2.5}px`,  // 10px
  3: `${BASE_UNIT * 3}px`,      // 12px
  3.5: `${BASE_UNIT * 3.5}px`,  // 14px
  4: `${BASE_UNIT * 4}px`,      // 16px
  5: `${BASE_UNIT * 5}px`,      // 20px
  6: `${BASE_UNIT * 6}px`,      // 24px
  7: `${BASE_UNIT * 7}px`,      // 28px
  8: `${BASE_UNIT * 8}px`,      // 32px
  9: `${BASE_UNIT * 9}px`,      // 36px
  10: `${BASE_UNIT * 10}px`,    // 40px
  11: `${BASE_UNIT * 11}px`,    // 44px
  12: `${BASE_UNIT * 12}px`,    // 48px
  14: `${BASE_UNIT * 14}px`,    // 56px
  16: `${BASE_UNIT * 16}px`,    // 64px
  20: `${BASE_UNIT * 20}px`,    // 80px
  24: `${BASE_UNIT * 24}px`,    // 96px
  28: `${BASE_UNIT * 28}px`,    // 112px
  32: `${BASE_UNIT * 32}px`,    // 128px
  36: `${BASE_UNIT * 36}px`,    // 144px
  40: `${BASE_UNIT * 40}px`,    // 160px
  44: `${BASE_UNIT * 44}px`,    // 176px
  48: `${BASE_UNIT * 48}px`,    // 192px
  52: `${BASE_UNIT * 52}px`,    // 208px
  56: `${BASE_UNIT * 56}px`,    // 224px
  60: `${BASE_UNIT * 60}px`,    // 240px
  64: `${BASE_UNIT * 64}px`,    // 256px
  72: `${BASE_UNIT * 72}px`,    // 288px
  80: `${BASE_UNIT * 80}px`,    // 320px
  96: `${BASE_UNIT * 96}px`,    // 384px
} as const;

// Border radius scale
export const borderRadius = {
  none: '0px',
  xs: '2px',
  sm: '4px',
  base: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  '3xl': '32px',
  full: '9999px',
} as const;

// Border width scale
export const borderWidth = {
  0: '0px',
  1: '1px',
  2: '2px',
  4: '4px',
  8: '8px',
} as const;

// Breakpoints for responsive design (mobile-first)
export const breakpoints = {
  xs: '36em',    // 576px - Small phones
  sm: '48em',    // 768px - Large phones / small tablets
  md: '62em',    // 992px - Tablets / small laptops
  lg: '75em',    // 1200px - Laptops / desktops
  xl: '88em',    // 1408px - Large desktops
} as const;

// Container max widths
export const containers = {
  xs: '100%',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// Grid system
export const grid = {
  columns: 12,
  gutter: spacing[6],    // 24px
  marginX: spacing[4],   // 16px on mobile
  marginXLg: spacing[8], // 32px on desktop
} as const;

// Component-specific spacing
export const componentSpacing = {
  // Form components
  form: {
    fieldGap: spacing[4],          // 16px - between form fields
    labelGap: spacing[1.5],        // 6px - between label and input
    groupGap: spacing[6],          // 24px - between form groups
    sectionGap: spacing[8],        // 32px - between form sections
  },
  
  // Card components
  card: {
    padding: spacing[6],           // 24px - internal padding
    gap: spacing[4],               // 16px - between card elements
    margin: spacing[4],            // 16px - between cards
  },
  
  // Navigation components
  nav: {
    itemPadding: spacing[3],       // 12px - nav item padding
    itemGap: spacing[2],           // 8px - between nav items
    sectionGap: spacing[6],        // 24px - between nav sections
  },
  
  // List components
  list: {
    itemPadding: spacing[3],       // 12px - list item padding
    itemGap: spacing[1],           // 4px - between list items
    groupGap: spacing[4],          // 16px - between list groups
  },
  
  // Healthcare-specific spacing
  medical: {
    // Patient chart sections
    chartSection: spacing[8],      // 32px - between chart sections
    timelineGap: spacing[4],       // 16px - timeline entries
    
    // Vital signs display
    vitalsGap: spacing[6],         // 24px - between vital sign groups
    
    // Medication list
    medGap: spacing[3],            // 12px - between medications
    
    // Lab results
    labGroupGap: spacing[6],       // 24px - between lab groups
    labItemGap: spacing[2],        // 8px - between lab items
  },
} as const;

// Layout utilities
export const layout = {
  // Common heights
  height: {
    header: spacing[16],           // 64px - header height
    footer: spacing[12],           // 48px - footer height
    navbar: spacing[14],           // 56px - navigation bar
    toolbar: spacing[10],          // 40px - toolbar height
    input: spacing[10],            // 40px - input field height
    button: spacing[10],           // 40px - button height
    buttonSm: spacing[8],          // 32px - small button
    buttonLg: spacing[12],         // 48px - large button
  },
  
  // Common widths
  width: {
    sidebar: '280px',              // Sidebar width
    sidebarCollapsed: '72px',      // Collapsed sidebar
    drawer: '400px',               // Drawer panel width
    modal: {
      sm: '400px',
      md: '600px',
      lg: '800px',
      xl: '1200px',
    },
  },
  
  // Z-index scale
  zIndex: {
    hide: -1,
    auto: 'auto',
    base: 0,
    docked: 10,
    dropdown: 1000,
    sticky: 1100,
    banner: 1200,
    overlay: 1300,
    modal: 1400,
    popover: 1500,
    skipLink: 1600,
    toast: 1700,
    tooltip: 1800,
  },
} as const;

// Shadow system
export const shadows = {
  none: 'none',
  xs: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  sm: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  base: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  md: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  lg: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  xl: '0 35px 60px -12px rgba(0, 0, 0, 0.35)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
  outline: '0 0 0 3px rgba(59, 130, 246, 0.5)', // Focus outline
} as const;

// Animation timing
export const transitions = {
  duration: {
    fast: '150ms',
    base: '200ms',
    slow: '300ms',
    slower: '500ms',
  },
  easing: {
    ease: 'ease',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
    spring: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
} as const;

// Utility types
export type Spacing = keyof typeof spacing;
export type BorderRadius = keyof typeof borderRadius;
export type BorderWidth = keyof typeof borderWidth;
export type Breakpoint = keyof typeof breakpoints;
export type Container = keyof typeof containers;
export type Shadow = keyof typeof shadows;