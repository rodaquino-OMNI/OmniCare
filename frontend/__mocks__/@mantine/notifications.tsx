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