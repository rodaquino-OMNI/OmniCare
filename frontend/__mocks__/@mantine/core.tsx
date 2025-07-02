import React, { ReactNode, ReactElement, CSSProperties, MouseEvent, ChangeEvent } from 'react';

// Mock matchMedia before anything else
if (typeof window !== 'undefined') {
  window.matchMedia = window.matchMedia || jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
}

// Type definitions for all Mantine mock components
interface GroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  justify?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
  align?: 'flex-start' | 'flex-end' | 'center' | 'baseline' | 'stretch';
  gap?: string | number;
  grow?: boolean;
}

// Mock components used in PatientHeader - return actual components, not mock functions
export const Group: React.FC<GroupProps> = ({ children, justify, align, gap, grow, ...props }) => (
  <div 
    data-testid="mantine-group"
    data-justify={justify}
    data-align={align} 
    data-gap={gap}
    data-grow={grow}
    {...props}
  >
    {children}
  </div>
);

interface TextProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: ReactNode;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | string;
  fw?: number | string;
  c?: string;
  truncate?: boolean | 'start' | 'end';
  className?: string;
  ta?: 'left' | 'center' | 'right' | 'justify' | 'start' | 'end';
}

export const Text: React.FC<TextProps> = ({ children, size, fw, c, truncate, className, ta, ...props }) => (
  <span 
    data-testid="mantine-text" 
    data-size={size}
    data-fw={fw}
    data-color={c}
    data-truncate={truncate}
    data-ta={ta}
    className={className}
    {...props}
  >
    {children}
  </span>
);

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: ReactNode;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | string;
  variant?: 'filled' | 'light' | 'outline' | 'dot' | 'gradient';
}

export const Badge: React.FC<BadgeProps> = ({ children, color, size, variant, ...props }) => (
  <span 
    data-testid="mantine-badge"
    data-color={color}
    data-size={size}
    data-variant={variant}
    {...props}
  >
    {children}
  </span>
);

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  color?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ children, size, color, ...props }) => (
  <div 
    data-testid="mantine-avatar"
    data-size={size}
    data-color={color}
    {...props}
  >
    {children || 'Avatar'}
  </div>
);

interface PaperProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  p?: string | number;
  shadow?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | string;
  withBorder?: boolean;
  className?: string;
}

export const Paper: React.FC<PaperProps> = ({ children, p, shadow, withBorder, className, ...props }) => (
  <div 
    data-testid="mantine-paper"
    data-padding={p}
    data-shadow={shadow}
    data-border={withBorder}
    className={className}
    {...props}
  >
    {children}
  </div>
);

interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  gap?: string | number;
  align?: 'flex-start' | 'flex-end' | 'center' | 'baseline' | 'stretch';
  justify?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
  grow?: boolean;
}

export const Stack: React.FC<StackProps> = ({ children, gap, align, justify, grow, ...props }) => (
  <div
    data-testid="mantine-stack"
    data-gap={gap}
    data-align={align}
    data-justify={justify}
    data-grow={grow}
    {...props}
  >
    {children}
  </div>
);

interface SimpleGridProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  cols?: number | Record<string, number>;
  spacing?: string | number;
}

export const SimpleGrid: React.FC<SimpleGridProps> = ({ children, cols, spacing, ...props }) => (
  <div 
    data-testid="mantine-simple-grid"
    data-cols={JSON.stringify(cols)}
    data-spacing={spacing}
    {...props}
  >
    {children}
  </div>
);

interface ActionIconProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  variant?: 'filled' | 'light' | 'outline' | 'default' | 'transparent' | 'subtle' | 'gradient';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  visibleFrom?: string;
  hiddenFrom?: string;
}

export const ActionIcon: React.FC<ActionIconProps> = ({ children, variant, size, onClick, visibleFrom, hiddenFrom, ...props }) => (
  <button 
    data-testid="mantine-action-icon"
    data-variant={variant}
    data-size={size}
    onClick={onClick}
    {...props}
  >
    {children}
  </button>
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  leftSection?: ReactNode;
  variant?: 'filled' | 'light' | 'outline' | 'transparent' | 'subtle' | 'gradient' | 'default' | 'white';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'compact-xs' | 'compact-sm' | 'compact-md' | 'compact-lg' | 'compact-xl';
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  fullWidth?: boolean;
  loading?: boolean;
  visibleFrom?: string;
  hiddenFrom?: string;
}

export const Button: React.FC<ButtonProps> = ({ children, leftSection, variant, size, onClick, fullWidth, loading, visibleFrom, hiddenFrom, ...props }) => {
  const { style, className, disabled, ...domProps } = props;
  
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (onClick) {
      onClick(event);
    }
  };
  
  return (
    <button 
      data-testid="mantine-button"
      data-variant={variant}
      data-size={size}
      data-loading={loading ? 'true' : 'false'}
      data-full-width={fullWidth}
      onClick={handleClick}
      style={{
        ...style,
        width: fullWidth ? '100%' : undefined
      }}
      className={className}
      disabled={disabled || loading}
      {...domProps}
    >
      {leftSection}
      {children}
    </button>
  );
};

interface TooltipProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  label?: ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ children, label, ...props }) => (
  <div 
    data-testid="mantine-tooltip"
    aria-label={typeof label === 'string' ? label : undefined}
    role="tooltip"
    {...props}
  >
    {children}
  </div>
);

interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  children?: ReactNode;
  icon?: ReactNode;
  color?: string;
  variant?: 'filled' | 'light' | 'outline';
  title?: ReactNode;
}

export const Alert: React.FC<AlertProps> = ({ children, icon, color, variant, title, ...props }) => (
  <div 
    data-testid="mantine-alert"
    data-color={color}
    data-variant={variant}
    role="alert"
    {...props}
  >
    {icon}
    {title && <div>{title}</div>}
    {children}
  </div>
);

interface DividerProps extends React.HTMLAttributes<HTMLHRElement> {
  labelPosition?: 'left' | 'center' | 'right';
}

export const Divider: React.FC<DividerProps> = ({ labelPosition, ...props }) => {
  const { style, className, ...domProps } = props;
  return (
    <hr 
      data-testid="mantine-divider" 
      data-label-position={labelPosition}
      style={style}
      className={className}
      {...domProps} 
    />
  );
};

interface TextInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'size'> {
  label?: ReactNode;
  placeholder?: string;
  value?: string | number;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  error?: ReactNode;
  id?: string;
  leftSection?: ReactNode;
  rightSection?: ReactNode;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export const TextInput: React.FC<TextInputProps> = ({ 
  label, 
  placeholder, 
  value, 
  onChange, 
  required, 
  error, 
  id, 
  leftSection, 
  rightSection, 
  size,
  ...props 
}) => {
  const inputId = id || `text-input-${Math.random().toString(36).substr(2, 9)}`;
  const { style, className, disabled, ...domProps } = props;
  
  // Handle controlled component behavior properly
  const [internalValue, setInternalValue] = React.useState(value || '');
  
  React.useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
    }
  }, [value]);
  
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    
    // Update internal state for uncontrolled components
    if (value === undefined) {
      setInternalValue(newValue);
    }
    
    // Call external onChange handler
    if (onChange) {
      onChange(event);
    }
  };
  
  const currentValue = value !== undefined ? value : internalValue;
  
  return (
    <div data-testid="mantine-text-input" style={style} className={className} {...domProps}>
      {label && <label htmlFor={inputId}>{label}</label>}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {leftSection && <div style={{ position: 'absolute', left: '8px', zIndex: 1 }}>{leftSection}</div>}
        <input
          id={inputId}
          type="text"
          placeholder={placeholder}
          value={currentValue}
          onChange={handleChange}
          required={required}
          disabled={disabled}
          aria-invalid={!!error}
          data-size={size}
          style={{
            width: '100%',
            padding: '8px 12px',
            paddingLeft: leftSection ? '32px' : '12px',
            paddingRight: rightSection ? '32px' : '12px',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            fontFamily: 'inherit',
            fontSize: 'inherit'
          }}
        />
        {rightSection && <div style={{ position: 'absolute', right: '8px', zIndex: 1 }}>{rightSection}</div>}
      </div>
      {error && <div data-testid="input-error" style={{ color: 'red', fontSize: '0.875rem', marginTop: '4px' }}>{error}</div>}
    </div>
  );
};

interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: ReactNode;
  placeholder?: string;
  value?: string | number;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  error?: ReactNode;
  id?: string;
  leftSection?: ReactNode;
  rightSection?: ReactNode;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({ label, placeholder, value, onChange, required, error, id, leftSection, rightSection, ...props }) => {
  const inputId = id || `password-input-${Math.random().toString(36).substr(2, 9)}`;
  const { style, className, disabled, ...domProps } = props;
  return (
    <div data-testid="mantine-password-input" style={style} className={className} {...domProps}>
      {label && <label htmlFor={inputId}>{label}</label>}
      <input
        id={inputId}
        type="password"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        aria-invalid={!!error}
      />
      {error && <div data-testid="input-error">{error}</div>}
    </div>
  );
};

interface TitleProps {
  children?: ReactNode;
  order?: 1 | 2 | 3 | 4 | 5 | 6;
  size?: string;
  fw?: number | string;
  c?: string;
  style?: CSSProperties;
  className?: string;
  id?: string;
}

export const Title: React.FC<TitleProps> = ({ children, order = 1, size, fw, c, style, className, id }) => {
  const tagName = `h${order}`;
  return React.createElement(
    tagName,
    {
      'data-testid': 'mantine-title',
      'data-order': order,
      'data-size': size,
      'data-fw': fw,
      'data-color': c,
      style,
      className,
      id
    },
    children
  );
};

interface LoadingOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  visible?: boolean;
  loaderProps?: Record<string, any>;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ visible, loaderProps, ...props }) => {
  if (!visible) return null;
  // Filter out non-standard HTML props
  const { overlayProps, ...htmlProps } = props as any;
  return (
    <div
      data-testid="mantine-loading-overlay"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      {...htmlProps}
    >
      <div>Loading...</div>
    </div>
  );
};

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> {
  label?: ReactNode;
  checked?: boolean;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  id?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ label, checked, onChange, disabled, id, ...props }) => {
  const inputId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;
  return (
    <div data-testid="mantine-checkbox" {...props}>
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      {label && <label htmlFor={inputId}>{label}</label>}
    </div>
  );
};

interface AnchorProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  children?: ReactNode;
  href?: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

export const Anchor: React.FC<AnchorProps> = ({ children, href, onClick, ...props }) => (
  <a
    data-testid="mantine-anchor"
    href={href}
    onClick={onClick}
    {...props}
  >
    {children}
  </a>
);

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  shadow?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | string;
  padding?: string | number;
  radius?: string | number;
  withBorder?: boolean;
  grow?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, shadow, padding, radius, withBorder, grow, ...props }) => (
  <div
    data-testid="mantine-card"
    data-shadow={shadow}
    data-padding={padding}
    data-radius={radius}
    data-with-border={withBorder}
    data-grow={grow}
    {...props}
  >
    {children}
  </div>
);

// Menu components
interface MenuContextValue {
  opened: boolean;
  setOpened: (value: boolean | ((prev: boolean) => boolean)) => void;
}

const MenuContext = React.createContext<MenuContextValue>({ opened: false, setOpened: () => {} });

interface MenuProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

export const Menu: React.FC<MenuProps> & {
  Target: React.FC<MenuTargetProps>;
  Dropdown: React.FC<MenuDropdownProps>;
  Item: React.FC<MenuItemProps>;
  Divider: React.FC<MenuDividerProps>;
} = ({ children, ...props }) => {
  const [opened, setOpened] = React.useState(false);
  
  return (
    <MenuContext.Provider value={{ opened, setOpened }}>
      <div data-testid="mantine-menu" {...props}>
        {children}
      </div>
    </MenuContext.Provider>
  );
};

interface MenuTargetProps {
  children: ReactElement;
}

Menu.Target = ({ children }: MenuTargetProps) => {
  const { setOpened } = React.useContext(MenuContext);
  
  const additionalProps: any = {};
  if (React.isValidElement(children)) {
    additionalProps.onClick = (e: React.MouseEvent) => {
      (children as any).props?.onClick?.(e);
      setOpened((prev: boolean) => !prev);
    };
  }
  
  return React.cloneElement(children as React.ReactElement, additionalProps);
};

interface MenuDropdownProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

Menu.Dropdown = ({ children, ...props }: MenuDropdownProps) => {
  const { opened } = React.useContext(MenuContext);
  
  if (!opened) return null;
  
  return (
    <div data-testid="mantine-menu-dropdown" {...props}>
      {children}
    </div>
  );
};

interface MenuItemProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  leftSection?: ReactNode;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
  color?: string;
}

Menu.Item = ({ children, leftSection, onClick, color, ...props }: MenuItemProps) => {
  const { style, className, ...domProps } = props;
  return (
    <div 
      data-testid="mantine-menu-item"
      onClick={onClick}
      data-color={color}
      style={{ cursor: 'pointer', ...style }}
      className={className}
      {...domProps}
    >
      {leftSection}
      {children}
    </div>
  );
};

interface MenuDividerProps extends React.HTMLAttributes<HTMLHRElement> {}

Menu.Divider = (props: MenuDividerProps) => (
  <hr data-testid="mantine-menu-divider" {...props} />
);

// createTheme function mock
export const createTheme = (themeOverride?: any) => {
  return {
    primaryColor: 'blue',
    fontFamily: 'Inter, sans-serif',
    colorScheme: 'light',
    ...themeOverride
  };
};

// Provider component - must return the actual implementation, not a mock function
interface MantineProviderProps {
  children?: ReactNode;
  theme?: any;
  defaultColorScheme?: 'light' | 'dark' | 'auto';
}

export const MantineProvider: React.FC<MantineProviderProps> = ({ children, theme, defaultColorScheme }) => {
  // Ensure matchMedia is available
  if (typeof window !== 'undefined' && !window.matchMedia) {
    window.matchMedia = jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
  }
  
  return <div data-testid="mantine-provider" data-theme={JSON.stringify(theme)} data-color-scheme={defaultColorScheme}>{children}</div>;
};

// Drawer component (if needed)
interface DrawerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  children?: ReactNode;
  opened?: boolean;
  onClose?: () => void;
  title?: ReactNode;
}

export const Drawer: React.FC<DrawerProps> & {
  Body: React.FC<DrawerBodyProps>;
  Header: React.FC<DrawerHeaderProps>;
  Title: React.FC<DrawerTitleProps>;
} = ({ children, opened, onClose, title, ...props }) => {
  if (!opened) return null;
  
  return (
    <div data-testid="mantine-drawer" {...props}>
      {title && <div data-testid="mantine-drawer-title">{title}</div>}
      <button onClick={onClose} data-testid="mantine-drawer-close">Close</button>
      {children}
    </div>
  );
};

interface DrawerBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

Drawer.Body = ({ children, ...props }: DrawerBodyProps) => (
  <div data-testid="mantine-drawer-body" {...props}>
    {children}
  </div>
);

interface DrawerHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

Drawer.Header = ({ children, ...props }: DrawerHeaderProps) => (
  <div data-testid="mantine-drawer-header" {...props}>
    {children}
  </div>
);

interface DrawerTitleProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

Drawer.Title = ({ children, ...props }: DrawerTitleProps) => (
  <div data-testid="mantine-drawer-title" {...props}>
    {children}
  </div>
);

// Tabs components
interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  children?: ReactNode;
  value?: string;
  onChange?: (value: string) => void;
}

export const Tabs: React.FC<TabsProps> & {
  List: React.FC<TabsListProps>;
  Tab: React.FC<TabsTabProps>;
  Panel: React.FC<TabsPanelProps>;
} = ({ children, value, onChange, ...props }) => {
  return (
    <div data-testid="mantine-tabs" data-value={value} {...props}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child) && child.type === Tabs.List) {
          return React.cloneElement(child as ReactElement<TabsListProps>, { onChange });
        }
        return child;
      })}
    </div>
  );
};

interface TabsListProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  children?: ReactNode;
  onChange?: (value: string) => void;
}

Tabs.List = ({ children, onChange, ...props }: TabsListProps) => (
  <div data-testid="mantine-tabs-list" {...props}>
    {React.Children.map(children, (child, index) => {
      if (React.isValidElement(child) && child.type === Tabs.Tab) {
        return React.cloneElement(child as ReactElement<TabsTabProps>, {
          onClick: () => onChange?.((child.props as any).value),
          key: index
        });
      }
      return child;
    })}
  </div>
);

interface TabsTabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  value?: string;
  leftSection?: ReactNode;
  onClick?: () => void;
}

Tabs.Tab = ({ children, value, leftSection, onClick, ...props }: TabsTabProps) => {
  const { style, className, disabled, ...domProps } = props;
  return (
    <button
      data-testid="mantine-tabs-tab"
      data-value={value}
      onClick={onClick}
      style={style}
      className={className}
      disabled={disabled}
      {...domProps}
    >
      {leftSection}
      {children}
    </button>
  );
};

interface TabsPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  value?: string;
  pt?: string | number;
}

Tabs.Panel = ({ children, value, pt, ...props }: TabsPanelProps) => (
  <div
    data-testid="mantine-tabs-panel"
    data-value={value}
    style={{ paddingTop: pt }}
    {...props}
  >
    {children}
  </div>
);

// Select component
interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  label?: ReactNode;
  data?: SelectOption[];
  value?: string;
  onChange?: (value: string | null) => void;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  style?: CSSProperties;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  clearable?: boolean;
  searchable?: boolean;
  error?: ReactNode;
}

export const Select: React.FC<SelectProps> = ({ 
  label, 
  data = [], 
  value, 
  onChange, 
  size, 
  style, 
  disabled, 
  className, 
  placeholder,
  clearable,
  searchable,
  error,
  ...props 
}) => {
  const inputId = `select-${Math.random().toString(36).substr(2, 9)}`;
  
  // Handle controlled component behavior properly
  const [internalValue, setInternalValue] = React.useState(value || '');
  
  React.useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value || '');
    }
  }, [value]);
  
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const newValue = event.target.value;
    
    // Update internal state for uncontrolled components
    if (value === undefined) {
      setInternalValue(newValue);
    }
    
    // Call external onChange handler
    if (onChange) {
      onChange(newValue || null);
    }
  };
  
  const currentValue = value !== undefined ? (value || '') : internalValue;
  
  return (
    <div data-testid="mantine-select" style={style} className={className} {...props}>
      {label && <label htmlFor={inputId}>{label}</label>}
      <select
        id={inputId}
        value={currentValue}
        onChange={handleChange}
        data-size={size}
        disabled={disabled}
        aria-invalid={!!error}
        data-placeholder={placeholder}
        data-clearable={clearable}
        data-searchable={searchable}
        style={{
          width: '100%',
          padding: '8px 12px',
          border: '1px solid #ced4da',
          borderRadius: '4px',
          fontFamily: 'inherit',
          fontSize: 'inherit'
        }}
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {data.map((option, index) => (
          <option key={index} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <div data-testid="select-error" style={{ color: 'red', fontSize: '0.875rem', marginTop: '4px' }}>{error}</div>}
    </div>
  );
};

// Textarea component
interface TextareaProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  label?: ReactNode;
  placeholder?: string;
  value?: string | number;
  onChange?: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  minRows?: number;
  maxRows?: number;
  disabled?: boolean;
  autosize?: boolean;
  error?: ReactNode;
  id?: string;
  required?: boolean;
}

export const Textarea: React.FC<TextareaProps> = ({ 
  label, 
  placeholder, 
  value, 
  onChange, 
  minRows = 4, 
  maxRows, 
  disabled, 
  autosize, 
  error,
  id,
  required,
  ...props 
}) => {
  const inputId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
  const { style, className, ...restProps } = props;
  
  // Handle controlled component behavior properly
  const [internalValue, setInternalValue] = React.useState(value || '');
  
  React.useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
    }
  }, [value]);
  
  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = event.target.value;
    
    // Update internal state for uncontrolled components
    if (value === undefined) {
      setInternalValue(newValue);
    }
    
    // Call external onChange handler
    if (onChange) {
      onChange(event);
    }
  };
  
  const currentValue = value !== undefined ? value : internalValue;
  
  return (
    <div data-testid="mantine-textarea" data-autosize={autosize} style={style} className={className} {...restProps}>
      {label && <label htmlFor={inputId}>{label}</label>}
      <textarea
        id={inputId}
        placeholder={placeholder}
        value={currentValue}
        onChange={handleChange}
        rows={minRows}
        disabled={disabled}
        required={required}
        aria-invalid={!!error}
        style={{ 
          minHeight: minRows ? `${minRows * 1.5}em` : undefined,
          maxHeight: maxRows ? `${maxRows * 1.5}em` : undefined,
          resize: autosize ? 'vertical' : 'both',
          width: '100%',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          border: '1px solid #ced4da',
          borderRadius: '4px',
          padding: '8px 12px'
        }}
      />
      {error && <div data-testid="textarea-error" style={{ color: 'red', fontSize: '0.875rem', marginTop: '4px' }}>{error}</div>}
    </div>
  );
};

// Modal component
interface ModalProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  children?: ReactNode;
  opened?: boolean;
  onClose?: () => void;
  title?: ReactNode;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full' | number;
}

export const Modal: React.FC<ModalProps> = ({ children, opened, onClose, title, size, ...props }) => {
  if (!opened) return null;
  
  return (
    <div data-testid="mantine-modal" data-size={size} {...props}>
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
      </div>
    </div>
  );
};

// ScrollArea component
interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  mah?: string | number;
  h?: string | number;
  type?: 'hover' | 'scroll' | 'auto' | 'always' | 'never';
}

export const ScrollArea: React.FC<ScrollAreaProps> = ({ children, mah, h, type, ...props }) => (
  <div
    data-testid="mantine-scroll-area"
    data-type={type}
    style={{ 
      maxHeight: mah, 
      height: h,
      overflow: 'auto' 
    }}
    {...props}
  >
    {children}
  </div>
);

// Spotlight component
interface SpotlightProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  searchProps?: any;
  actions?: any[];
  onSpotlightOpen?: () => void;
  onSpotlightClose?: () => void;
}

export const Spotlight: React.FC<SpotlightProps> = ({ children, searchProps, actions, onSpotlightOpen, onSpotlightClose, ...props }) => (
  <div
    data-testid="mantine-spotlight"
    data-actions={JSON.stringify(actions)}
    {...props}
  >
    {children}
  </div>
);

// MultiSelect component
interface MultiSelectProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  label?: ReactNode;
  data?: Array<{ value: string; label: string }>;
  value?: string[];
  onChange?: (value: string[]) => void;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  placeholder?: string;
  searchable?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  className?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({ 
  label, 
  data, 
  value = [], 
  onChange, 
  size, 
  placeholder,
  searchable,
  clearable,
  ...props 
}) => {
  const inputId = `multi-select-${Math.random().toString(36).substr(2, 9)}`;
  return (
    <div data-testid="mantine-multi-select" {...props}>
      {label && <label htmlFor={inputId}>{label}</label>}
      <select
        id={inputId}
        multiple
        value={value}
        onChange={(e) => {
          const selectedValues = Array.from(e.target.selectedOptions, option => option.value);
          onChange?.(selectedValues);
        }}
        data-size={size}
        data-placeholder={placeholder}
        data-searchable={searchable}
        data-clearable={clearable}
      >
        {data?.map((option, index) => (
          <option key={index} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

// DateInput component (Mantine v7)
interface DateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'size' | 'value'> {
  label?: ReactNode;
  placeholder?: string;
  value?: Date;
  onChange?: (value: Date | null) => void;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  error?: ReactNode;
}

export const DateInput: React.FC<DateInputProps> = ({ 
  label, 
  placeholder, 
  value, 
  onChange, 
  size, 
  error,
  ...props 
}) => {
  const inputId = `date-input-${Math.random().toString(36).substr(2, 9)}`;
  return (
    <div data-testid="mantine-date-input" {...props}>
      {label && <label htmlFor={inputId}>{label}</label>}
      <input
        id={inputId}
        type="date"
        placeholder={placeholder}
        value={value ? value.toISOString().split('T')[0] : ''}
        onChange={(e) => {
          const date = e.target.value ? new Date(e.target.value) : null;
          onChange?.(date);
        }}
        data-size={size}
      />
      {error && <div data-testid="input-error">{error}</div>}
    </div>
  );
};

// Progress component
interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  radius?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  color?: string;
  striped?: boolean;
  animated?: boolean;
}

export const Progress: React.FC<ProgressProps> = ({ 
  value = 0, 
  size, 
  radius, 
  color, 
  striped, 
  animated,
  ...props 
}) => (
  <div
    data-testid="mantine-progress"
    data-value={value}
    data-size={size}
    data-radius={radius}
    data-color={color}
    data-striped={striped}
    data-animated={animated}
    {...props}
  >
    <div style={{ width: `${value}%`, height: '100%', backgroundColor: color || 'blue' }} />
  </div>
);

// Popover component
interface PopoverProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  children?: ReactNode;
  target?: ReactNode;
  opened?: boolean;
  onChange?: (opened: boolean) => void;
  position?: string;
  withArrow?: boolean;
}

export const Popover: React.FC<PopoverProps> & {
  Target: React.FC<{ children: ReactNode }>;
  Dropdown: React.FC<{ children: ReactNode }>;
} = ({ children, target, opened, onChange, position, withArrow, ...props }) => (
  <div
    data-testid="mantine-popover"
    data-opened={opened}
    data-position={position}
    data-with-arrow={withArrow}
    {...props}
  >
    {target}
    {opened && children}
  </div>
);

Popover.Target = ({ children }) => (
  <div data-testid="mantine-popover-target">{children}</div>
);

Popover.Dropdown = ({ children }) => (
  <div data-testid="mantine-popover-dropdown">{children}</div>
);

// Ensure subcomponents are attached to their parent components
Object.assign(Menu, { Target: Menu.Target, Dropdown: Menu.Dropdown, Item: Menu.Item, Divider: Menu.Divider });
Object.assign(Drawer, { Body: Drawer.Body, Header: Drawer.Header, Title: Drawer.Title });
Object.assign(Tabs, { List: Tabs.List, Tab: Tabs.Tab, Panel: Tabs.Panel });
Object.assign(Popover, { Target: Popover.Target, Dropdown: Popover.Dropdown });

// Export all components
// Missing components that are imported in ClinicalNoteInput
interface FileButtonProps extends Omit<React.HTMLAttributes<HTMLLabelElement>, 'onChange'> {
  children?: ReactNode;
  onChange?: (file: File | null) => void;
  accept?: string;
  multiple?: boolean;
}

export const FileButton: React.FC<FileButtonProps> = ({ children, onChange, accept, multiple, ...props }) => (
  <label data-testid="mantine-file-button" {...props}>
    <input
      type="file"
      accept={accept}
      multiple={multiple}
      onChange={(e) => onChange?.(e.target.files?.[0] || null)}
      style={{ display: 'none' }}
    />
    {children}
  </label>
);

interface UnstyledButtonProps extends React.HTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}

export const UnstyledButton: React.FC<UnstyledButtonProps> = ({ children, onClick, ...props }) => (
  <button onClick={onClick} data-testid="mantine-unstyled-button" style={{ all: 'unset' }} {...props}>
    {children}
  </button>
);

interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: string | number;
  color?: string;
}

export const Loader: React.FC<LoaderProps> = ({ size, color, ...props }) => (
  <div data-testid="mantine-loader" data-size={size} data-color={color} role="presentation" {...props}>
    Loading...
  </div>
);

interface CenterProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  h?: string | number;
  w?: string | number;
  mah?: string | number;
}

export const Center: React.FC<CenterProps> = ({ children, h, w, mah, ...props }) => (
  <div 
    data-testid="mantine-center" 
    style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      height: h,
      width: w,
      maxHeight: mah
    }} 
    {...props}
  >
    {children}
  </div>
);

interface RingProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  sections?: Array<{ value: number; color: string }>;
  size?: string | number;
  thickness?: number;
  label?: ReactNode;
}

export const RingProgress: React.FC<RingProgressProps> = ({ sections, size, thickness, label, ...props }) => (
  <div 
    data-testid="mantine-ring-progress" 
    data-size={size} 
    data-thickness={thickness}
    data-sections={JSON.stringify(sections)}
    {...props}
  >
    {label && <div data-testid="ring-progress-label">{label}</div>}
  </div>
);

interface ListProps extends React.HTMLAttributes<HTMLUListElement> {
  children?: ReactNode;
  spacing?: string | number;
}

export const List: React.FC<ListProps> & {
  Item: React.FC<{ children?: ReactNode; icon?: ReactNode }>
} = ({ children, spacing, ...props }) => (
  <ul data-testid="mantine-list" data-spacing={spacing} {...props}>
    {children}
  </ul>
);

List.Item = ({ children, icon }) => (
  <li data-testid="mantine-list-item">
    {icon && <span data-testid="list-item-icon">{icon}</span>}
    {children}
  </li>
);

interface ThemeIconProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  size?: string | number;
  color?: string;
  variant?: string;
  radius?: string | number;
}

export const ThemeIcon: React.FC<ThemeIconProps> = ({ children, size, color, variant, radius, ...props }) => (
  <div 
    data-testid="mantine-theme-icon" 
    data-size={size} 
    data-color={color} 
    data-variant={variant} 
    data-radius={radius}
    {...props}
  >
    {children}
  </div>
);

interface NotificationProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  title?: string;
  color?: string;
  icon?: ReactNode;
  onClose?: () => void;
}

export const Notification: React.FC<NotificationProps> = ({ children, title, color, icon, onClose, ...props }) => (
  <div data-testid="mantine-notification" data-color={color} {...props}>
    {icon && <span data-testid="notification-icon">{icon}</span>}
    {title && <div data-testid="notification-title">{title}</div>}
    <div>{children}</div>
    {onClose && <button onClick={onClose} data-testid="notification-close">×</button>}
  </div>
);

// Stepper component
interface StepperProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  active?: number;
  onStepClick?: (step: number) => void;
  completedIcon?: ReactNode;
  progressIcon?: ReactNode;
}

export const Stepper: React.FC<StepperProps> & {
  Step: React.FC<StepperStepProps>;
  Completed: React.FC<{ children?: ReactNode }>;
} = ({ children, active = 0, onStepClick, completedIcon, progressIcon, ...props }) => (
  <div data-testid="mantine-stepper" data-active={active} {...props}>
    {React.Children.map(children, (child, index) => {
      if (React.isValidElement(child) && child.type === Stepper.Step) {
        return React.cloneElement(child as ReactElement<StepperStepProps>, {
          stepIndex: index,
          isActive: index === active,
          isCompleted: index < active,
          onClick: () => onStepClick?.(index)
        });
      }
      return child;
    })}
  </div>
);

interface StepperStepProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  label?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  completedIcon?: ReactNode;
  progressIcon?: ReactNode;
  loading?: boolean;
  allowStepSelect?: boolean;
  stepIndex?: number;
  isActive?: boolean;
  isCompleted?: boolean;
  onClick?: () => void;
}

Stepper.Step = ({ 
  children, 
  label, 
  description, 
  icon, 
  completedIcon, 
  progressIcon, 
  loading, 
  allowStepSelect,
  stepIndex,
  isActive,
  isCompleted,
  onClick,
  ...props 
}) => (
  <div 
    data-testid="mantine-stepper-step" 
    data-index={stepIndex}
    data-active={isActive}
    data-completed={isCompleted}
    data-loading={loading}
    onClick={allowStepSelect ? onClick : undefined}
    style={{ cursor: allowStepSelect ? 'pointer' : 'default' }}
    {...props}
  >
    <div data-testid="stepper-step-icon">
      {isCompleted ? completedIcon : isActive && loading ? progressIcon : icon}
    </div>
    <div data-testid="stepper-step-body">
      {label && <div data-testid="stepper-step-label">{label}</div>}
      {description && <div data-testid="stepper-step-description">{description}</div>}
      {isActive && children}
    </div>
  </div>
);

Stepper.Completed = ({ children }) => (
  <div data-testid="mantine-stepper-completed">
    {children}
  </div>
);

// Grid component
interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  gutter?: string | number;
  justify?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
  align?: 'stretch' | 'center' | 'flex-start' | 'flex-end' | 'baseline';
}

export const Grid: React.FC<GridProps> & {
  Col: React.FC<GridColProps>;
} = ({ children, gutter, justify, align, ...props }) => (
  <div 
    data-testid="mantine-grid" 
    data-gutter={gutter}
    data-justify={justify}
    data-align={align}
    style={{ display: 'flex', flexWrap: 'wrap', gap: gutter }}
    {...props}
  >
    {children}
  </div>
);

interface GridColProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  span?: number | 'auto' | 'content';
  offset?: number;
  order?: number;
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
}

Grid.Col = ({ children, span, offset, order, xs, sm, md, lg, xl, ...props }) => (
  <div 
    data-testid="mantine-grid-col" 
    data-span={span}
    data-offset={offset}
    data-order={order}
    data-xs={xs}
    data-sm={sm}
    data-md={md}
    data-lg={lg}
    data-xl={xl}
    style={{ order }}
    {...props}
  >
    {children}
  </div>
);

interface BoxProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  component?: string | React.ComponentType<any>;
  style?: CSSProperties;
  className?: string;
}

export const Box: React.FC<BoxProps> = ({ children, component: Component = 'div', style, className, ...props }) => {
  const ElementType = Component as any;
  // Filter out non-standard HTML props that could cause React warnings
  const { grow, overlayProps, ...htmlProps } = props as any;
  return (
    <ElementType 
      data-testid="mantine-box" 
      style={style}
      className={className}
      data-grow={grow}
      {...htmlProps}
    >
      {children}
    </ElementType>
  );
};

interface CollapseProps {
  children: ReactNode;
  in: boolean;
  transitionDuration?: number;
  transitionTimingFunction?: string;
  onTransitionEnd?: () => void;
}

export const Collapse: React.FC<CollapseProps> = ({ 
  children, 
  in: isOpen,
  transitionDuration = 200,
  transitionTimingFunction = 'ease',
  onTransitionEnd
}) => {
  return (
    <div 
      data-testid="mantine-collapse" 
      style={{ 
        display: isOpen ? 'block' : 'none',
        transition: `all ${transitionDuration}ms ${transitionTimingFunction}`
      }}
      onTransitionEnd={onTransitionEnd}
    >
      {children}
    </div>
  );
};

export default {
  Group,
  Text,
  Badge,
  Avatar,
  Paper,
  Stack,
  SimpleGrid,
  ActionIcon,
  Button,
  Tooltip,
  Alert,
  Divider,
  TextInput,
  PasswordInput,
  Title,
  LoadingOverlay,
  Checkbox,
  Anchor,
  Card,
  Menu,
  MantineProvider,
  createTheme,
  Drawer,
  Tabs,
  Select,
  Textarea,
  Modal,
  ScrollArea,
  Spotlight,
  MultiSelect,
  DateInput,
  Progress,
  Popover,
  FileButton,
  UnstyledButton,
  Loader,
  Center,
  RingProgress,
  List,
  ThemeIcon,
  Notification,
  Collapse,
  Box
};