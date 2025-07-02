import React, { ReactNode } from 'react';

// Mock notifications object
export const notifications = {
  show: jest.fn((options) => {
    console.log('[Mock] Notification shown:', options);
  }),
  clean: jest.fn(() => {
    console.log('[Mock] Notifications cleaned');
  }),
  cleanQueue: jest.fn(() => {
    console.log('[Mock] Notification queue cleaned');
  }),
  update: jest.fn((options) => {
    console.log('[Mock] Notification updated:', options);
  }),
  hide: jest.fn((id) => {
    console.log('[Mock] Notification hidden:', id);
  }),
};

// Legacy showNotification function (if needed for backward compatibility)
export const showNotification = jest.fn((options) => {
  console.log('[Mock] showNotification called:', options);
  notifications.show(options);
});

// Mock Notifications component
interface NotificationsProps {
  children?: ReactNode;
  position?: 'top-left' | 'top-right' | 'top-center' | 'bottom-left' | 'bottom-right' | 'bottom-center';
  zIndex?: number;
  limit?: number;
  containerWidth?: number;
  autoClose?: number | false;
}

export const Notifications: React.FC<NotificationsProps> = ({ children, position, zIndex, limit, containerWidth, autoClose }) => (
  <div 
    data-testid="mantine-notifications"
    data-position={position}
    data-z-index={zIndex}
    data-limit={limit}
    data-container-width={containerWidth}
    data-auto-close={autoClose}
  >
    {children}
  </div>
);