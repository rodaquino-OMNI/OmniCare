import React, { ReactNode, createContext, useContext } from 'react';

// Mock modals context
interface ModalsContextValue {
  modals: any[];
  openModal: (modal: any) => string;
  closeModal: (id: string) => void;
  closeAllModals: () => void;
  openConfirmModal: (modal: any) => string;
  openContextModal: (modal: any) => string;
}

const ModalsContext = createContext<ModalsContextValue>({
  modals: [],
  openModal: jest.fn().mockReturnValue('mock-modal-id'),
  closeModal: jest.fn(),
  closeAllModals: jest.fn(),
  openConfirmModal: jest.fn().mockReturnValue('mock-confirm-modal-id'),
  openContextModal: jest.fn().mockReturnValue('mock-context-modal-id'),
});

// ModalsProvider component interface moved to exports section

export const ModalsProvider: React.FC<ModalsProviderProps> = ({ 
  children, 
  modalProps, 
  labels 
}) => {
  const [modals, setModals] = React.useState<any[]>([]);
  
  const openModal = jest.fn((modal: any) => {
    const id = `modal-${Date.now()}`;
    setModals(prev => [...prev, { ...modal, id }]);
    return id;
  });
  
  const closeModal = jest.fn((id: string) => {
    setModals(prev => prev.filter(modal => modal.id !== id));
  });
  
  const closeAllModals = jest.fn(() => {
    setModals([]);
  });
  
  const openConfirmModal = jest.fn((modal: any) => {
    const id = `confirm-modal-${Date.now()}`;
    setModals(prev => [...prev, { 
      ...modal, 
      id, 
      type: 'confirm',
      labels: { confirm: 'Confirm', cancel: 'Cancel', ...labels, ...modal.labels }
    }]);
    return id;
  });
  
  const openContextModal = jest.fn((modal: any) => {
    const id = `context-modal-${Date.now()}`;
    setModals(prev => [...prev, { ...modal, id, type: 'context' }]);
    return id;
  });
  
  const contextValue: ModalsContextValue = {
    modals,
    openModal,
    closeModal,
    closeAllModals,
    openConfirmModal,
    openContextModal,
  };
  
  return (
    <ModalsContext.Provider value={contextValue}>
      <div data-testid="mantine-modals-provider">
        {children}
        {modals.map(modal => (
          <div 
            key={modal.id}
            data-testid={`mantine-modal-${modal.id}`}
            data-modal-type={modal.type}
          >
            <div data-testid="mantine-modal-overlay" onClick={() => closeModal(modal.id)} />
            <div data-testid="mantine-modal-content">
              {modal.title && (
                <div data-testid="mantine-modal-header">
                  <h3>{modal.title}</h3>
                  <button onClick={() => closeModal(modal.id)}>×</button>
                </div>
              )}
              <div data-testid="mantine-modal-body">
                {modal.children || modal.innerProps?.children}
              </div>
              {modal.type === 'confirm' && (
                <div data-testid="mantine-modal-actions">
                  <button 
                    onClick={() => {
                      modal.onCancel?.();
                      closeModal(modal.id);
                    }}
                  >
                    {modal.labels?.cancel || 'Cancel'}
                  </button>
                  <button 
                    onClick={() => {
                      modal.onConfirm?.();
                      closeModal(modal.id);
                    }}
                  >
                    {modal.labels?.confirm || 'Confirm'}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </ModalsContext.Provider>
  );
};

// useModals hook
export const useModals = () => {
  const context = useContext(ModalsContext);
  if (!context) {
    throw new Error('useModals must be used within a ModalsProvider');
  }
  return context;
};

// modals object (for imperative API)
export const modals = {
  open: jest.fn(),
  close: jest.fn(),
  closeAll: jest.fn(),
  openConfirmModal: jest.fn(),
  openContextModal: jest.fn(),
};

// ContextModalProps type
export interface ContextModalProps<T = Record<string, any>> {
  context: ModalsContextValue;
  id: string;
  innerProps: T;
}

// ModalsProvider props interface
export interface ModalsProviderProps {
  children: ReactNode;
  modalProps?: any;
  labels?: {
    confirm?: string;
    cancel?: string;
  };
}

// Mock ConfirmModal component
interface ConfirmModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onCancel?: () => void;
  title?: ReactNode;
  children?: ReactNode;
  labels?: {
    confirm?: string;
    cancel?: string;
  };
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  opened,
  onClose,
  onConfirm,
  onCancel,
  title,
  children,
  labels
}) => {
  if (!opened) return null;
  
  return (
    <div data-testid="mantine-confirm-modal">
      <div data-testid="mantine-modal-overlay" onClick={onClose} />
      <div data-testid="mantine-modal-content">
        {title && (
          <div data-testid="mantine-modal-header">
            <h3>{title}</h3>
            <button onClick={onClose}>×</button>
          </div>
        )}
        <div data-testid="mantine-modal-body">
          {children}
        </div>
        <div data-testid="mantine-modal-actions">
          <button 
            onClick={() => {
              onCancel?.();
              onClose();
            }}
          >
            {labels?.cancel || 'Cancel'}
          </button>
          <button 
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {labels?.confirm || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Export default
export default {
  ModalsProvider,
  useModals,
  modals,
  ConfirmModal
};