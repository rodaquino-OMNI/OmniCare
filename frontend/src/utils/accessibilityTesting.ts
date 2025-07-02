/**
 * Accessibility Testing Framework
 * Provides comprehensive testing utilities for WCAG 2.1 AA compliance
 */

export interface AccessibilityTestResult {
  passed: boolean;
  score: number; // 0-10 scale
  violations: AccessibilityViolation[];
  warnings: AccessibilityWarning[];
  recommendations: string[];
  wcagLevel: 'A' | 'AA' | 'AAA' | 'FAIL';
}

export interface AccessibilityViolation {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  wcagCriterion: string;
  elements: Element[];
  fix: string;
}

export interface AccessibilityWarning {
  id: string;
  description: string;
  elements: Element[];
  suggestion: string;
}

// WCAG 2.1 Success Criteria mapping
const WCAG_CRITERIA = {
  '1.1.1': 'Non-text Content',
  '1.2.1': 'Audio-only and Video-only (Prerecorded)',
  '1.2.2': 'Captions (Prerecorded)',
  '1.2.3': 'Audio Description or Media Alternative (Prerecorded)',
  '1.3.1': 'Info and Relationships',
  '1.3.2': 'Meaningful Sequence',
  '1.3.3': 'Sensory Characteristics',
  '1.4.1': 'Use of Color',
  '1.4.2': 'Audio Control',
  '1.4.3': 'Contrast (Minimum)',
  '1.4.4': 'Resize text',
  '1.4.5': 'Images of Text',
  '2.1.1': 'Keyboard',
  '2.1.2': 'No Keyboard Trap',
  '2.1.4': 'Character Key Shortcuts',
  '2.2.1': 'Timing Adjustable',
  '2.2.2': 'Pause, Stop, Hide',
  '2.3.1': 'Three Flashes or Below Threshold',
  '2.4.1': 'Bypass Blocks',
  '2.4.2': 'Page Titled',
  '2.4.3': 'Focus Order',
  '2.4.4': 'Link Purpose (In Context)',
  '2.4.5': 'Multiple Ways',
  '2.4.6': 'Headings and Labels',
  '2.4.7': 'Focus Visible',
  '3.1.1': 'Language of Page',
  '3.1.2': 'Language of Parts',
  '3.2.1': 'On Focus',
  '3.2.2': 'On Input',
  '3.2.3': 'Consistent Navigation',
  '3.2.4': 'Consistent Identification',
  '3.3.1': 'Error Identification',
  '3.3.2': 'Labels or Instructions',
  '3.3.3': 'Error Suggestion',
  '3.3.4': 'Error Prevention (Legal, Financial, Data)',
  '4.1.1': 'Parsing',
  '4.1.2': 'Name, Role, Value',
  '4.1.3': 'Status Messages',
} as const;

export class AccessibilityTester {
  private violations: AccessibilityViolation[] = [];
  private warnings: AccessibilityWarning[] = [];
  private recommendations: string[] = [];

  /**
   * Run comprehensive accessibility tests on a container
   */
  async testContainer(container: Element = document.body): Promise<AccessibilityTestResult> {
    this.violations = [];
    this.warnings = [];
    this.recommendations = [];

    // Core WCAG 2.1 AA tests
    await this.testImages(container);
    await this.testHeadings(container);
    await this.testLinks(container);
    await this.testButtons(container);
    await this.testForms(container);
    await this.testLandmarks(container);
    await this.testColorContrast(container);
    await this.testKeyboardAccess(container);
    await this.testFocusManagement(container);
    await this.testAriaUsage(container);
    await this.testLanguage(container);
    await this.testSkipLinks(container);

    // Healthcare-specific tests
    await this.testEmergencyAlerts(container);
    await this.testClinicalData(container);

    const score = this.calculateScore();
    const wcagLevel = this.determineWCAGLevel();

    return {
      passed: this.violations.filter(v => v.impact === 'critical' || v.impact === 'serious').length === 0,
      score,
      violations: this.violations,
      warnings: this.warnings,
      recommendations: this.recommendations,
      wcagLevel,
    };
  }

  /**
   * Test images for proper alt text (WCAG 1.1.1)
   */
  private async testImages(container: Element): Promise<void> {
    const images = container.querySelectorAll('img, [role="img"]');
    
    images.forEach((img) => {
      const alt = img.getAttribute('alt');
      const ariaLabel = img.getAttribute('aria-label');
      const ariaLabelledby = img.getAttribute('aria-labelledby');
      
      if (!alt && !ariaLabel && !ariaLabelledby) {
        this.violations.push({
          id: 'image-alt',
          impact: 'serious',
          description: 'Image missing alternative text',
          wcagCriterion: '1.1.1',
          elements: [img],
          fix: 'Add alt attribute or aria-label to provide alternative text',
        });
      } else if (alt === '') {
        // Decorative images should have empty alt text
        if (!img.getAttribute('aria-hidden')) {
          this.warnings.push({
            id: 'decorative-image',
            description: 'Decorative image should have aria-hidden="true"',
            elements: [img],
            suggestion: 'Add aria-hidden="true" for decorative images',
          });
        }
      }
    });
  }

  /**
   * Test heading structure (WCAG 1.3.1)
   */
  private async testHeadings(container: Element): Promise<void> {
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]');
    const headingLevels: number[] = [];

    headings.forEach((heading) => {
      let level: number;
      
      if (heading.hasAttribute('aria-level')) {
        level = parseInt(heading.getAttribute('aria-level') || '1', 10);
      } else {
        level = parseInt(heading.tagName.charAt(1) || '1', 10);
      }
      
      headingLevels.push(level);
      
      // Check for empty headings
      if (!heading.textContent?.trim()) {
        this.violations.push({
          id: 'empty-heading',
          impact: 'serious',
          description: 'Heading element is empty',
          wcagCriterion: '2.4.6',
          elements: [heading],
          fix: 'Add descriptive text to the heading',
        });
      }
    });

    // Check heading hierarchy
    if (headingLevels.length > 0) {
      if (headingLevels[0] !== 1) {
        this.violations.push({
          id: 'heading-order',
          impact: 'moderate',
          description: 'Page should start with an h1 heading',
          wcagCriterion: '1.3.1',
          elements: [headings[0]],
          fix: 'Start page with h1 and follow proper heading hierarchy',
        });
      }

      for (let i = 1; i < headingLevels.length; i++) {
        if (headingLevels[i] > headingLevels[i - 1] + 1) {
          this.warnings.push({
            id: 'heading-skip',
            description: 'Heading levels should not skip (e.g., h1 to h3)',
            elements: [headings[i]],
            suggestion: 'Follow sequential heading hierarchy',
          });
        }
      }
    }
  }

  /**
   * Test links for accessibility (WCAG 2.4.4)
   */
  private async testLinks(container: Element): Promise<void> {
    const links = container.querySelectorAll('a, [role="link"]');
    
    links.forEach((link) => {
      const href = link.getAttribute('href');
      const text = link.textContent?.trim();
      const ariaLabel = link.getAttribute('aria-label');
      const ariaLabelledby = link.getAttribute('aria-labelledby');
      
      // Check for empty links
      if (!text && !ariaLabel && !ariaLabelledby) {
        this.violations.push({
          id: 'empty-link',
          impact: 'serious',
          description: 'Link has no accessible text',
          wcagCriterion: '2.4.4',
          elements: [link],
          fix: 'Add descriptive text, aria-label, or aria-labelledby to the link',
        });
      }
      
      // Check for vague link text
      const vagueTerms = ['click here', 'read more', 'more', 'here', 'link'];
      if (text && vagueTerms.some(term => text.toLowerCase().includes(term))) {
        this.warnings.push({
          id: 'vague-link-text',
          description: 'Link text should be descriptive of the destination',
          elements: [link],
          suggestion: 'Use descriptive link text that explains the destination or purpose',
        });
      }
      
      // Check for missing href in links
      if (link.tagName.toLowerCase() === 'a' && !href) {
        this.violations.push({
          id: 'link-no-href',
          impact: 'moderate',
          description: 'Anchor element without href is not keyboard accessible',
          wcagCriterion: '2.1.1',
          elements: [link],
          fix: 'Add href attribute or use button element instead',
        });
      }
    });
  }

  /**
   * Test buttons for accessibility (WCAG 4.1.2)
   */
  private async testButtons(container: Element): Promise<void> {
    const buttons = container.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"], input[type="reset"]');
    
    buttons.forEach((button) => {
      const text = button.textContent?.trim();
      const ariaLabel = button.getAttribute('aria-label');
      const ariaLabelledby = button.getAttribute('aria-labelledby');
      const value = button.getAttribute('value');
      
      // Check for empty buttons
      if (!text && !ariaLabel && !ariaLabelledby && !value) {
        this.violations.push({
          id: 'empty-button',
          impact: 'serious',
          description: 'Button has no accessible text',
          wcagCriterion: '4.1.2',
          elements: [button],
          fix: 'Add descriptive text, aria-label, or aria-labelledby to the button',
        });
      }
      
      // Check for disabled buttons without explanation
      if (button.hasAttribute('disabled') && !button.getAttribute('aria-describedby')) {
        this.warnings.push({
          id: 'disabled-button',
          description: 'Disabled button should explain why it is disabled',
          elements: [button],
          suggestion: 'Add aria-describedby to explain why the button is disabled',
        });
      }
    });
  }

  /**
   * Test form accessibility (WCAG 3.3.2)
   */
  private async testForms(container: Element): Promise<void> {
    const formControls = container.querySelectorAll('input, select, textarea, [role="textbox"], [role="combobox"], [role="listbox"]');
    
    formControls.forEach((control) => {
      const id = control.getAttribute('id');
      const ariaLabel = control.getAttribute('aria-label');
      const ariaLabelledby = control.getAttribute('aria-labelledby');
      const label = id ? container.querySelector(`label[for="${id}"]`) : null;
      
      // Check for missing labels
      if (!label && !ariaLabel && !ariaLabelledby) {
        this.violations.push({
          id: 'form-label',
          impact: 'serious',
          description: 'Form control missing accessible label',
          wcagCriterion: '3.3.2',
          elements: [control],
          fix: 'Add label element, aria-label, or aria-labelledby to the form control',
        });
      }
      
      // Check for required fields
      if (control.hasAttribute('required') && !control.getAttribute('aria-describedby')) {
        this.warnings.push({
          id: 'required-field',
          description: 'Required field should indicate it is required',
          elements: [control],
          suggestion: 'Add aria-describedby to indicate field is required',
        });
      }
    });
  }

  /**
   * Test landmarks and page structure (WCAG 2.4.1)
   */
  private async testLandmarks(container: Element): Promise<void> {
    const mainLandmarks = container.querySelectorAll('main, [role="main"]');
    const navLandmarks = container.querySelectorAll('nav, [role="navigation"]');
    const skipLinks = container.querySelectorAll('a[href^="#"]');
    
    // Check for main landmark
    if (mainLandmarks.length === 0) {
      this.violations.push({
        id: 'no-main-landmark',
        impact: 'moderate',
        description: 'Page should have a main landmark',
        wcagCriterion: '2.4.1',
        elements: [container],
        fix: 'Add main element or role="main" to identify the main content area',
      });
    }
    
    // Check for multiple main landmarks
    if (mainLandmarks.length > 1) {
      this.violations.push({
        id: 'multiple-main-landmarks',
        impact: 'moderate',
        description: 'Page should have only one main landmark',
        wcagCriterion: '2.4.1',
        elements: Array.from(mainLandmarks),
        fix: 'Use only one main element or role="main" per page',
      });
    }
    
    // Check for skip links
    if (skipLinks.length === 0) {
      this.recommendations.push('Consider adding skip links for keyboard navigation');
    }
  }

  /**
   * Test color contrast (WCAG 1.4.3)
   */
  private async testColorContrast(container: Element): Promise<void> {
    // This is a simplified contrast check
    // In a real implementation, you would use a color contrast library
    const textElements = container.querySelectorAll('*');
    
    textElements.forEach((element) => {
      const style = window.getComputedStyle(element);
      const color = style.color;
      const backgroundColor = style.backgroundColor;
      
      // Skip elements without text content
      if (!element.textContent?.trim()) return;
      
      // This is a placeholder - you would implement actual contrast calculation
      if (color === backgroundColor) {
        this.violations.push({
          id: 'color-contrast',
          impact: 'serious',
          description: 'Insufficient color contrast between text and background',
          wcagCriterion: '1.4.3',
          elements: [element],
          fix: 'Ensure text has sufficient contrast ratio (4.5:1 for normal text, 3:1 for large text)',
        });
      }
    });
  }

  /**
   * Test keyboard accessibility (WCAG 2.1.1)
   */
  private async testKeyboardAccess(container: Element): Promise<void> {
    const interactiveElements = container.querySelectorAll(
      'a, button, input, select, textarea, [tabindex], [role="button"], [role="link"], [role="menuitem"]'
    );
    
    interactiveElements.forEach((element) => {
      const tabindex = element.getAttribute('tabindex');
      
      // Check for positive tabindex values (anti-pattern)
      if (tabindex && parseInt(tabindex, 10) > 0) {
        this.warnings.push({
          id: 'positive-tabindex',
          description: 'Avoid positive tabindex values as they disrupt natural tab order',
          elements: [element],
          suggestion: 'Use tabindex="0" or rely on natural document order',
        });
      }
      
      // Check for custom interactive elements without keyboard support
      if (element.getAttribute('role') === 'button' && element.tagName.toLowerCase() !== 'button') {
        if (!element.hasAttribute('tabindex')) {
          this.violations.push({
            id: 'keyboard-access',
            impact: 'serious',
            description: 'Custom interactive element not keyboard accessible',
            wcagCriterion: '2.1.1',
            elements: [element],
            fix: 'Add tabindex="0" and keyboard event handlers',
          });
        }
      }
    });
  }

  /**
   * Test focus management (WCAG 2.4.3, 2.4.7)
   */
  private async testFocusManagement(container: Element): Promise<void> {
    const focusableElements = container.querySelectorAll(
      'a, button, input, select, textarea, [tabindex="0"], [tabindex="-1"]'
    );
    
    // Check for focus indicators
    focusableElements.forEach((element) => {
      const style = window.getComputedStyle(element, ':focus');
      if (style.outline === 'none' && !style.boxShadow && !style.border) {
        this.warnings.push({
          id: 'focus-indicator',
          description: 'Element may lack visible focus indicator',
          elements: [element],
          suggestion: 'Ensure all focusable elements have visible focus indicators',
        });
      }
    });
  }

  /**
   * Test ARIA usage (WCAG 4.1.2)
   */
  private async testAriaUsage(container: Element): Promise<void> {
    const elementsWithAria = container.querySelectorAll('[aria-labelledby], [aria-describedby]');
    
    elementsWithAria.forEach((element) => {
      const labelledby = element.getAttribute('aria-labelledby');
      const describedby = element.getAttribute('aria-describedby');
      
      // Check if referenced elements exist
      if (labelledby) {
        const ids = labelledby.split(' ');
        ids.forEach((id) => {
          if (!container.querySelector(`#${id}`)) {
            this.violations.push({
              id: 'aria-reference',
              impact: 'serious',
              description: `Element references non-existent ID in aria-labelledby: ${id}`,
              wcagCriterion: '4.1.2',
              elements: [element],
              fix: 'Ensure all IDs referenced in aria-labelledby exist',
            });
          }
        });
      }
      
      if (describedby) {
        const ids = describedby.split(' ');
        ids.forEach((id) => {
          if (!container.querySelector(`#${id}`)) {
            this.violations.push({
              id: 'aria-reference',
              impact: 'serious',
              description: `Element references non-existent ID in aria-describedby: ${id}`,
              wcagCriterion: '4.1.2',
              elements: [element],
              fix: 'Ensure all IDs referenced in aria-describedby exist',
            });
          }
        });
      }
    });
  }

  /**
   * Test language attributes (WCAG 3.1.1)
   */
  private async testLanguage(container: Element): Promise<void> {
    const htmlElement = document.documentElement;
    const lang = htmlElement.getAttribute('lang');
    
    if (!lang) {
      this.violations.push({
        id: 'html-lang',
        impact: 'serious',
        description: 'HTML element missing lang attribute',
        wcagCriterion: '3.1.1',
        elements: [htmlElement],
        fix: 'Add lang attribute to html element (e.g., lang="en")',
      });
    }
  }

  /**
   * Test skip links (WCAG 2.4.1)
   */
  private async testSkipLinks(container: Element): Promise<void> {
    const skipLinks = container.querySelectorAll('a[href^="#"]');
    const mainContent = container.querySelector('main, [role="main"], #main-content');
    
    if (skipLinks.length === 0 && mainContent) {
      this.recommendations.push('Consider adding skip navigation links for keyboard users');
    }
    
    skipLinks.forEach((link) => {
      const href = link.getAttribute('href');
      if (href && href !== '#') {
        const target = container.querySelector(href);
        if (!target) {
          this.violations.push({
            id: 'skip-link-target',
            impact: 'moderate',
            description: 'Skip link points to non-existent target',
            wcagCriterion: '2.4.1',
            elements: [link],
            fix: 'Ensure skip link targets exist',
          });
        }
      }
    });
  }

  /**
   * Test emergency alerts (Healthcare-specific)
   */
  private async testEmergencyAlerts(container: Element): Promise<void> {
    const alerts = container.querySelectorAll('[role="alert"], .emergency-alert, .alert-critical');
    
    alerts.forEach((alert) => {
      if (!alert.getAttribute('aria-live')) {
        this.warnings.push({
          id: 'emergency-alert-live',
          description: 'Emergency alert should have aria-live attribute',
          elements: [alert],
          suggestion: 'Add aria-live="assertive" to emergency alerts',
        });
      }
    });
  }

  /**
   * Test clinical data accessibility (Healthcare-specific)
   */
  private async testClinicalData(container: Element): Promise<void> {
    const tables = container.querySelectorAll('table');
    
    tables.forEach((table) => {
      const headers = table.querySelectorAll('th');
      const caption = table.querySelector('caption');
      
      if (headers.length === 0) {
        this.violations.push({
          id: 'table-headers',
          impact: 'serious',
          description: 'Data table missing header cells',
          wcagCriterion: '1.3.1',
          elements: [table],
          fix: 'Add th elements to identify table headers',
        });
      }
      
      if (!caption && !table.getAttribute('aria-label')) {
        this.warnings.push({
          id: 'table-caption',
          description: 'Complex data table should have a caption or aria-label',
          elements: [table],
          suggestion: 'Add caption element or aria-label to describe table purpose',
        });
      }
    });
  }

  /**
   * Calculate overall accessibility score
   */
  private calculateScore(): number {
    let score = 10;
    
    this.violations.forEach((violation) => {
      switch (violation.impact) {
        case 'critical':
          score -= 3;
          break;
        case 'serious':
          score -= 2;
          break;
        case 'moderate':
          score -= 1;
          break;
        case 'minor':
          score -= 0.5;
          break;
      }
    });
    
    this.warnings.forEach(() => {
      score -= 0.1;
    });
    
    return Math.max(0, score);
  }

  /**
   * Determine WCAG conformance level
   */
  private determineWCAGLevel(): 'A' | 'AA' | 'AAA' | 'FAIL' {
    const criticalViolations = this.violations.filter(v => v.impact === 'critical').length;
    const seriousViolations = this.violations.filter(v => v.impact === 'serious').length;
    const moderateViolations = this.violations.filter(v => v.impact === 'moderate').length;
    
    if (criticalViolations > 0 || seriousViolations > 3) {
      return 'FAIL';
    }
    
    if (seriousViolations > 0 || moderateViolations > 5) {
      return 'A';
    }
    
    if (moderateViolations > 2) {
      return 'AA';
    }
    
    return 'AAA';
  }
}

/**
 * Quick accessibility test function
 */
export async function testAccessibility(
  container: Element = document.body
): Promise<AccessibilityTestResult> {
  const tester = new AccessibilityTester();
  return await tester.testContainer(container);
}

/**
 * Generate accessibility report
 */
export function generateAccessibilityReport(result: AccessibilityTestResult): string {
  let report = `# Accessibility Test Report\n\n`;
  report += `**Score:** ${result.score.toFixed(1)}/10\n`;
  report += `**WCAG Level:** ${result.wcagLevel}\n`;
  report += `**Status:** ${result.passed ? 'PASSED' : 'FAILED'}\n\n`;
  
  if (result.violations.length > 0) {
    report += `## Violations (${result.violations.length})\n\n`;
    result.violations.forEach((violation, index) => {
      report += `### ${index + 1}. ${violation.description}\n`;
      report += `- **Impact:** ${violation.impact}\n`;
      report += `- **WCAG:** ${violation.wcagCriterion} - ${WCAG_CRITERIA[violation.wcagCriterion as keyof typeof WCAG_CRITERIA]}\n`;
      report += `- **Fix:** ${violation.fix}\n`;
      report += `- **Elements:** ${violation.elements.length}\n\n`;
    });
  }
  
  if (result.warnings.length > 0) {
    report += `## Warnings (${result.warnings.length})\n\n`;
    result.warnings.forEach((warning, index) => {
      report += `### ${index + 1}. ${warning.description}\n`;
      report += `- **Suggestion:** ${warning.suggestion}\n`;
      report += `- **Elements:** ${warning.elements.length}\n\n`;
    });
  }
  
  if (result.recommendations.length > 0) {
    report += `## Recommendations\n\n`;
    result.recommendations.forEach((rec, index) => {
      report += `${index + 1}. ${rec}\n`;
    });
  }
  
  return report;
}

export default AccessibilityTester;