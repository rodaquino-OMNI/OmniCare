import type { Meta, StoryObj } from '@storybook/react';
import { Box, Grid, Group, Stack, Text, Card, Badge, SimpleGrid } from '@mantine/core';
import { colors } from '../design-system/tokens/colors';
import { typography } from '../design-system/tokens/typography';
import { spacing } from '../design-system/tokens/spacing';

const meta: Meta = {
  title: 'Design System/Design Tokens',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Complete design token system for OmniCare EMR including colors, typography, spacing, and healthcare-specific tokens.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

// Color Palette Story
export const ColorPalette: Story = {
  render: () => (
    <Box p="xl" style={{ backgroundColor: '#f8fafc' }}>
      <Stack spacing="xl">
        <div>
          <Text size="xl" weight={700} mb="md">OmniCare Color Palette</Text>
          <Text size="sm" color="dimmed" mb="xl">
            Bright, accessible color system designed for healthcare applications.
            All colors meet WCAG 2.1 AA contrast requirements.
          </Text>
        </div>

        {/* Primary Colors */}
        <div>
          <Text size="lg" weight={600} mb="md">Primary Brand Colors</Text>
          <SimpleGrid cols={5} spacing="sm" breakpoints={[{ maxWidth: 'sm', cols: 2 }]}>
            {Object.entries(colors.primary).map(([key, value]) => (
              <Card key={key} p="md" style={{ backgroundColor: value, minHeight: '120px' }}>
                <Stack spacing="xs" justify="flex-end" style={{ height: '100%' }}>
                  <Text 
                    size="sm" 
                    weight={600}
                    style={{ 
                      color: parseInt(key) > 500 ? 'white' : colors.neutral[900],
                      textShadow: parseInt(key) > 500 ? '0 1px 2px rgba(0,0,0,0.3)' : 'none'
                    }}
                  >
                    primary.{key}
                  </Text>
                  <Text 
                    size="xs" 
                    style={{ 
                      color: parseInt(key) > 500 ? 'white' : colors.neutral[700],
                      fontFamily: 'monospace',
                      textShadow: parseInt(key) > 500 ? '0 1px 2px rgba(0,0,0,0.3)' : 'none'
                    }}
                  >
                    {value}
                  </Text>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        </div>

        {/* Secondary Colors */}
        <div>
          <Text size="lg" weight={600} mb="md">Secondary Colors (Medical Green)</Text>
          <SimpleGrid cols={5} spacing="sm" breakpoints={[{ maxWidth: 'sm', cols: 2 }]}>
            {Object.entries(colors.secondary).map(([key, value]) => (
              <Card key={key} p="md" style={{ backgroundColor: value, minHeight: '120px' }}>
                <Stack spacing="xs" justify="flex-end" style={{ height: '100%' }}>
                  <Text 
                    size="sm" 
                    weight={600}
                    style={{ 
                      color: parseInt(key) > 500 ? 'white' : colors.neutral[900],
                      textShadow: parseInt(key) > 500 ? '0 1px 2px rgba(0,0,0,0.3)' : 'none'
                    }}
                  >
                    secondary.{key}
                  </Text>
                  <Text 
                    size="xs" 
                    style={{ 
                      color: parseInt(key) > 500 ? 'white' : colors.neutral[700],
                      fontFamily: 'monospace',
                      textShadow: parseInt(key) > 500 ? '0 1px 2px rgba(0,0,0,0.3)' : 'none'
                    }}
                  >
                    {value}
                  </Text>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        </div>

        {/* Semantic Colors */}
        <div>
          <Text size="lg" weight={600} mb="md">Semantic Colors</Text>
          <SimpleGrid cols={5} spacing="md">
            {Object.entries(colors.semantic).map(([key, colorObj]) => (
              <Card key={key} p="md" withBorder>
                <Stack spacing="xs">
                  <Text size="sm" weight={600} tt="capitalize">{key}</Text>
                  <div style={{ backgroundColor: colorObj.main, height: '60px', borderRadius: '4px' }}></div>
                  <Text size="xs" style={{ fontFamily: 'monospace' }}>{colorObj.main}</Text>
                  <Badge size="xs" variant="outline">{key}</Badge>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        </div>

        {/* Medical Colors */}
        <div>
          <Text size="lg" weight={600} mb="md">Medical Status Colors</Text>
          <Grid>
            {Object.entries(colors.medical).map(([category, statusColors]) => (
              <Grid.Col key={category} span={6}>
                <Card p="md" withBorder>
                  <Text size="sm" weight={600} mb="md" tt="capitalize">{category.replace(/([A-Z])/g, ' $1')}</Text>
                  <Stack spacing="xs">
                    {Object.entries(statusColors).map(([status, color]) => (
                      <Group key={status} spacing="sm">
                        <div 
                          style={{ 
                            width: '24px', 
                            height: '24px', 
                            backgroundColor: color, 
                            borderRadius: '4px',
                            border: '1px solid #e2e8f0'
                          }}
                        ></div>
                        <Text size="xs" tt="capitalize">{status}</Text>
                        <Text size="xs" style={{ fontFamily: 'monospace', color: colors.neutral[500] }}>
                          {color}
                        </Text>
                      </Group>
                    ))}
                  </Stack>
                </Card>
              </Grid.Col>
            ))}
          </Grid>
        </div>

        {/* Neutral Grays */}
        <div>
          <Text size="lg" weight={600} mb="md">Neutral Grays</Text>
          <SimpleGrid cols={6} spacing="sm" breakpoints={[{ maxWidth: 'sm', cols: 3 }]}>
            {Object.entries(colors.neutral).map(([key, value]) => (
              <Card key={key} p="md" style={{ backgroundColor: value, minHeight: '100px', border: '1px solid #e2e8f0' }}>
                <Stack spacing="xs" justify="flex-end" style={{ height: '100%' }}>
                  <Text 
                    size="sm" 
                    weight={600}
                    style={{ 
                      color: parseInt(key) > 400 ? 'white' : colors.neutral[900],
                      textShadow: parseInt(key) > 400 ? '0 1px 2px rgba(0,0,0,0.3)' : 'none'
                    }}
                  >
                    {key}
                  </Text>
                  <Text 
                    size="xs" 
                    style={{ 
                      color: parseInt(key) > 400 ? '#e2e8f0' : colors.neutral[600],
                      fontFamily: 'monospace',
                      textShadow: parseInt(key) > 400 ? '0 1px 2px rgba(0,0,0,0.3)' : 'none'
                    }}
                  >
                    {value}
                  </Text>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        </div>
      </Stack>
    </Box>
  ),
};

// Typography Story
export const Typography: Story = {
  render: () => (
    <Box p="xl" style={{ backgroundColor: 'white' }}>
      <Stack spacing="xl">
        <div>
          <Text size="xl" weight={700} mb="md">Typography System</Text>
          <Text size="sm" color="dimmed" mb="xl">
            Healthcare-optimized typography using Inter font family for excellent readability.
          </Text>
        </div>

        {/* Typography Scale */}
        <div>
          <Text size="lg" weight={600} mb="md">Typography Scale</Text>
          <Stack spacing="lg">
            {Object.entries(typography).map(([variant, styles]) => (
              <Card key={variant} p="md" withBorder>
                <Group spacing="xl" align="flex-start">
                  <Box style={{ minWidth: '150px' }}>
                    <Text size="sm" weight={600} color={colors.neutral[700]}>{variant}</Text>
                    <Text size="xs" color={colors.neutral[500]} mt="xs">
                      {styles.fontSize} / {styles.fontWeight} / {styles.lineHeight}
                    </Text>
                  </Box>
                  <Box style={{ flex: 1 }}>
                    <Text style={styles}>
                      {variant === 'display' && 'Healthcare Excellence Through Technology'}
                      {variant === 'h1' && 'Patient Care Management System'}
                      {variant === 'h2' && 'Clinical Documentation Portal'}
                      {variant === 'h3' && 'Vital Signs Monitoring'}
                      {variant === 'h4' && 'Medication Administration'}
                      {variant === 'h5' && 'Lab Results Review'}
                      {variant === 'h6' && 'Treatment Plans'}
                      {variant === 'body' && 'Patient presents with acute onset of chest pain radiating to left arm. Vital signs stable. EKG shows normal sinus rhythm. Troponin levels pending.'}
                      {variant === 'bodyLarge' && 'Comprehensive clinical assessment reveals no immediate concerns. Continue current treatment protocol.'}
                      {variant === 'bodySmall' && 'Last updated 2 hours ago by Dr. Smith, MD'}
                      {variant === 'caption' && 'Reference range: 0.0-0.04 ng/mL'}
                      {variant === 'label' && 'Blood Pressure Reading'}
                      {variant === 'button' && 'Save Patient Data'}
                      {variant === 'code' && 'MRN: 123456789'}
                      {variant === 'patientName' && 'Johnson, Robert M.'}
                      {variant === 'medicalValue' && '120/80 mmHg'}
                      {variant === 'criticalAlert' && 'CRITICAL: Troponin Elevated'}
                      {variant === 'timestamp' && '2024-06-20 14:30:25'}
                    </Text>
                  </Box>
                </Group>
              </Card>
            ))}
          </Stack>
        </div>

        {/* Font Families */}
        <div>
          <Text size="lg" weight={600} mb="md">Font Families</Text>
          <Stack spacing="md">
            <Card p="md" withBorder>
              <Text size="sm" weight={600} mb="sm">Primary Font (Inter)</Text>
              <Text style={{ fontFamily: 'Inter, sans-serif', fontSize: '18px' }}>
                The quick brown fox jumps over the lazy dog. 1234567890
              </Text>
              <Text size="xs" color="dimmed" mt="xs">
                Used for: Body text, headings, UI elements, labels
              </Text>
            </Card>
            <Card p="md" withBorder>
              <Text size="sm" weight={600} mb="sm">Monospace Font (JetBrains Mono)</Text>
              <Text style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '16px' }}>
                MRN: 123456789 | BP: 120/80 | HR: 72 bpm | Temp: 98.6°F
              </Text>
              <Text size="xs" color="dimmed" mt="xs">
                Used for: Medical values, IDs, timestamps, technical data
              </Text>
            </Card>
          </Stack>
        </div>
      </Stack>
    </Box>
  ),
};

// Spacing Story
export const Spacing: Story = {
  render: () => (
    <Box p="xl" style={{ backgroundColor: '#f8fafc' }}>
      <Stack spacing="xl">
        <div>
          <Text size="xl" weight={700} mb="md">Spacing System</Text>
          <Text size="sm" color="dimmed" mb="xl">
            Consistent spacing based on 4px grid system for predictable layouts.
          </Text>
        </div>

        {/* Spacing Scale */}
        <div>
          <Text size="lg" weight={600} mb="md">Spacing Scale</Text>
          <Stack spacing="sm">
            {Object.entries(spacing).slice(0, 15).map(([key, value]) => (
              <Card key={key} p="md" withBorder>
                <Group spacing="xl" align="center">
                  <Box style={{ minWidth: '100px' }}>
                    <Text size="sm" weight={600}>{key}</Text>
                    <Text size="xs" color="dimmed">{value}</Text>
                  </Box>
                  <Box 
                    style={{ 
                      height: '24px', 
                      backgroundColor: colors.primary[500],
                      width: value,
                      borderRadius: '2px'
                    }}
                  ></Box>
                </Group>
              </Card>
            ))}
          </Stack>
        </div>

        {/* Component Spacing Examples */}
        <div>
          <Text size="lg" weight={600} mb="md">Healthcare Component Spacing</Text>
          <SimpleGrid cols={2} spacing="lg">
            <Card p="md" withBorder>
              <Text size="sm" weight={600} mb="md">Patient Card Layout</Text>
              <Box p={spacing[6]} style={{ backgroundColor: colors.neutral[50], borderRadius: '8px' }}>
                <Stack spacing={spacing[4]}>
                  <Text size="lg" weight={600}>Johnson, Robert M.</Text>
                  <Group spacing={spacing[3]}>
                    <Badge variant="light">Room 302A</Badge>
                    <Badge variant="light">Age 65</Badge>
                  </Group>
                  <Box>
                    <Text size="sm" color="dimmed" mb={spacing[1.5]}>Last Vitals</Text>
                    <Text size="sm">BP: 120/80 • HR: 72 • Temp: 98.6°F</Text>
                  </Box>
                </Stack>
              </Box>
            </Card>

            <Card p="md" withBorder>
              <Text size="sm" weight={600} mb="md">Form Field Spacing</Text>
              <Box p={spacing[6]} style={{ backgroundColor: colors.neutral[50], borderRadius: '8px' }}>
                <Stack spacing={spacing[4]}>
                  <Box>
                    <Text size="sm" weight={500} mb={spacing[1.5]}>Blood Pressure</Text>
                    <Box p={spacing[3]} style={{ backgroundColor: 'white', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                      <Text size="sm">120/80 mmHg</Text>
                    </Box>
                  </Box>
                  <Box>
                    <Text size="sm" weight={500} mb={spacing[1.5]}>Heart Rate</Text>
                    <Box p={spacing[3]} style={{ backgroundColor: 'white', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                      <Text size="sm">72 bpm</Text>
                    </Box>
                  </Box>
                </Stack>
              </Box>
            </Card>
          </SimpleGrid>
        </div>
      </Stack>
    </Box>
  ),
};

// Accessibility Features
export const AccessibilityFeatures: Story = {
  render: () => (
    <Box p="xl" style={{ backgroundColor: 'white' }}>
      <Stack spacing="xl">
        <div>
          <Text size="xl" weight={700} mb="md">Accessibility Features</Text>
          <Text size="sm" color="dimmed" mb="xl">
            Design system built with WCAG 2.1 AA compliance and healthcare accessibility requirements.
          </Text>
        </div>

        {/* Contrast Examples */}
        <div>
          <Text size="lg" weight={600} mb="md">Color Contrast Examples</Text>
          <SimpleGrid cols={3} spacing="md">
            <Card p="md" style={{ backgroundColor: colors.primary[500], color: 'white' }}>
              <Text size="sm" weight={600}>Primary on White</Text>
              <Text size="xs">Contrast ratio: 4.8:1 ✓</Text>
            </Card>
            <Card p="md" style={{ backgroundColor: colors.semantic.error.main, color: 'white' }}>
              <Text size="sm" weight={600}>Error on White</Text>
              <Text size="xs">Contrast ratio: 5.2:1 ✓</Text>
            </Card>
            <Card p="md" style={{ backgroundColor: colors.semantic.success.main, color: 'white' }}>
              <Text size="sm" weight={600}>Success on White</Text>
              <Text size="xs">Contrast ratio: 4.9:1 ✓</Text>
            </Card>
          </SimpleGrid>
        </div>

        {/* Focus States */}
        <div>
          <Text size="lg" weight={600} mb="md">Focus States</Text>
          <Card p="md" withBorder>
            <Stack spacing="md">
              <Text size="sm">Focus indicators for keyboard navigation:</Text>
              <Group spacing="md">
                <Box 
                  p="sm" 
                  style={{ 
                    backgroundColor: colors.primary[500], 
                    color: 'white',
                    borderRadius: '4px',
                    outline: `2px solid ${colors.accessibility.focus.ring}`,
                    outlineOffset: '2px'
                  }}
                >
                  <Text size="sm">Focused Button</Text>
                </Box>
                <Box 
                  p="sm" 
                  style={{ 
                    backgroundColor: 'white',
                    border: `1px solid ${colors.neutral[300]}`,
                    borderRadius: '4px',
                    outline: `2px solid ${colors.accessibility.focus.ring}`,
                    outlineOffset: '2px'
                  }}
                >
                  <Text size="sm">Focused Input</Text>
                </Box>
              </Group>
            </Stack>
          </Card>
        </div>

        {/* High Contrast Mode */}
        <div>
          <Text size="lg" weight={600} mb="md">High Contrast Mode</Text>
          <Card p="md" withBorder style={{ backgroundColor: colors.accessibility.highContrast.background }}>
            <Stack spacing="md">
              <Text 
                size="lg" 
                weight={600} 
                style={{ color: colors.accessibility.highContrast.text }}
              >
                High Contrast Example
              </Text>
              <Text 
                size="sm" 
                style={{ color: colors.accessibility.highContrast.text }}
              >
                Enhanced contrast for users with visual impairments or in bright environments.
              </Text>
              <Group spacing="md">
                <Box 
                  p="sm" 
                  style={{ 
                    backgroundColor: colors.accessibility.highContrast.primary,
                    color: colors.accessibility.highContrast.background,
                    borderRadius: '4px',
                    border: `2px solid ${colors.accessibility.highContrast.border}`
                  }}
                >
                  <Text size="sm" weight={600}>Primary Action</Text>
                </Box>
                <Box 
                  p="sm" 
                  style={{ 
                    backgroundColor: colors.accessibility.highContrast.background,
                    color: colors.accessibility.highContrast.text,
                    borderRadius: '4px',
                    border: `2px solid ${colors.accessibility.highContrast.border}`
                  }}
                >
                  <Text size="sm">Secondary Action</Text>
                </Box>
              </Group>
            </Stack>
          </Card>
        </div>
      </Stack>
    </Box>
  ),
};