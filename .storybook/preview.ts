import type { Preview } from '@storybook/react';
import { MantineProvider } from '@mantine/core';
import { omnicareTheme } from '../src/design-system/themes/omnicare-theme';

// Import Mantine styles and our custom styles
import '@mantine/core/styles.css';

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    docs: {
      theme: {
        base: 'light',
        brandTitle: 'OmniCare Design System',
        brandUrl: '#',
        brandImage: undefined,
        brandTarget: '_self',
      },
    },
    backgrounds: {
      default: 'light',
      values: [
        {
          name: 'light',
          value: '#f8fafc',
        },
        {
          name: 'white',
          value: '#ffffff',
        },
        {
          name: 'dark',
          value: '#1e293b',
        },
      ],
    },
    viewport: {
      viewports: {
        mobile: {
          name: 'Mobile',
          styles: {
            width: '375px',
            height: '667px',
          },
        },
        tablet: {
          name: 'Tablet',
          styles: {
            width: '768px',
            height: '1024px',
          },
        },
        desktop: {
          name: 'Desktop',
          styles: {
            width: '1200px',
            height: '800px',
          },
        },
        largeDesktop: {
          name: 'Large Desktop',
          styles: {
            width: '1920px',
            height: '1080px',
          },
        },
      },
    },
  },
  
  decorators: [
    (Story) => (
      <MantineProvider theme={omnicareTheme}>
        <div style={{ padding: '1rem' }}>
          <Story />
        </div>
      </MantineProvider>
    ),
  ],
  
  tags: ['autodocs'],
  
  globalTypes: {
    theme: {
      description: 'Global theme for components',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          { value: 'light', title: 'Light', icon: 'sun' },
          { value: 'dark', title: 'Dark', icon: 'moon' },
          { value: 'high-contrast', title: 'High Contrast', icon: 'contrast' },
        ],
        showName: true,
        dynamicTitle: true,
      },
    },
  },
};

export default preview;