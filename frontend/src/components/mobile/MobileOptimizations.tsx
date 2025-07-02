'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Box, 
  Stack, 
  Group, 
  Button, 
  Text, 
  ActionIcon,
  Modal,
  Drawer,
  Tooltip,
  Badge,
  Card,
  ScrollArea,
  Affix,
  Transition
} from '@mantine/core';
import { useMediaQuery, useViewportSize, useDisclosure } from '@mantine/hooks';
import { 
  IconMenu2, 
  IconX, 
  IconChevronUp,
  IconTouch,
  IconDeviceMobile,
  IconGesture,
  IconZoomIn,
  IconZoomOut
} from '@tabler/icons-react';

// Touch gesture handler for mobile interactions
export const useTouchGestures = () => {
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.targetTouches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.targetTouches[0];
    setTouchEnd({ x: touch.clientX, y: touch.clientY });
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd) return;

    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const isLeftSwipe = distanceX > 50;
    const isRightSwipe = distanceX < -50;
    const isUpSwipe = distanceY > 50;
    const isDownSwipe = distanceY < -50;

    return {
      isLeftSwipe,
      isRightSwipe,
      isUpSwipe,
      isDownSwipe,
      distanceX,
      distanceY
    };
  }, [touchStart, touchEnd]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    touchStart,
    touchEnd
  };
};

// Mobile-optimized virtual keyboard handler
export const useVirtualKeyboard = () => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    const handleViewportChange = () => {
      if (typeof window === 'undefined') return;

      const viewport = window.visualViewport;
      if (viewport) {
        const keyboardHeight = window.innerHeight - viewport.height;
        setKeyboardHeight(Math.max(0, keyboardHeight));
        setIsKeyboardOpen(keyboardHeight > 100);
      }
    };

    if (typeof window !== 'undefined' && window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      return () => {
        window.visualViewport?.removeEventListener('resize', handleViewportChange);
      };
    }
  }, []);

  return { keyboardHeight, isKeyboardOpen };
};

// Responsive breakpoint hook
export const useResponsiveBreakpoints = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');
  const isDesktop = useMediaQuery('(min-width: 1025px)');
  const { width, height } = useViewportSize();

  return {
    isMobile,
    isTablet,
    isDesktop,
    width,
    height,
    isLandscape: width > height,
    isPortrait: height > width
  };
};

// Mobile navigation component
export const MobileNavigation: React.FC<{
  opened: boolean;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ opened, onClose, children }) => {
  const { isMobile } = useResponsiveBreakpoints();
  const { onTouchStart, onTouchMove, onTouchEnd } = useTouchGestures();

  const handleSwipeClose = useCallback(() => {
    const gesture = onTouchEnd();
    if (gesture?.isLeftSwipe && Math.abs(gesture.distanceX) > 100) {
      onClose();
    }
  }, [onTouchEnd, onClose]);

  if (!isMobile) return null;

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      size="80%"
      position="left"
      withCloseButton={false}
      styles={{
        drawer: {
          padding: 0,
        },
      }}
    >
      <Box
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={handleSwipeClose}
        style={{ height: '100%' }}
      >
        <Group justify="space-between" p="md" style={{ borderBottom: '1px solid #eee' }}>
          <Text fw={600}>Menu</Text>
          <ActionIcon variant="subtle" onClick={onClose}>
            <IconX size={18} />
          </ActionIcon>
        </Group>
        <ScrollArea style={{ height: 'calc(100% - 60px)' }}>
          {children}
        </ScrollArea>
      </Box>
    </Drawer>
  );
};

// Mobile-optimized list component with pull-to-refresh
export const MobileList: React.FC<{
  children: React.ReactNode;
  onRefresh?: () => Promise<void>;
  isRefreshing?: boolean;
}> = ({ children, onRefresh, isRefreshing = false }) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const startY = useRef(0);
  const { isMobile } = useResponsiveBreakpoints();

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile || !onRefresh) return;
    startY.current = e.touches[0].clientY;
    setIsActive(true);
  }, [isMobile, onRefresh]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isActive || !onRefresh) return;
    
    const currentY = e.touches[0].clientY;
    const distance = Math.max(0, currentY - startY.current);
    
    if (distance > 0 && window.scrollY === 0) {
      e.preventDefault();
      setPullDistance(Math.min(distance, 120));
    }
  }, [isActive, onRefresh]);

  const handleTouchEnd = useCallback(async () => {
    if (!isActive || !onRefresh) return;
    
    setIsActive(false);
    
    if (pullDistance > 80) {
      try {
        await onRefresh();
      } catch (error) {
        console.error('Refresh failed:', error);
      }
    }
    
    setPullDistance(0);
  }, [isActive, onRefresh, pullDistance]);

  return (
    <Box
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ position: 'relative' }}
    >
      {/* Pull to refresh indicator */}
      {pullDistance > 0 && (
        <Box
          style={{
            position: 'absolute',
            top: -50,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            opacity: pullDistance / 80,
          }}
        >
          <Group gap="xs">
            <IconChevronUp 
              size={16} 
              style={{ 
                transform: `rotate(${pullDistance > 80 ? 180 : 0}deg)`,
                transition: 'transform 0.2s'
              }} 
            />
            <Text size="sm" c="dimmed">
              {pullDistance > 80 ? 'Release to refresh' : 'Pull to refresh'}
            </Text>
          </Group>
        </Box>
      )}
      
      {/* Loading indicator */}
      {isRefreshing && (
        <Box p="md" ta="center">
          <Text size="sm" c="dimmed">Refreshing...</Text>
        </Box>
      )}
      
      <Box style={{ transform: `translateY(${pullDistance * 0.3}px)` }}>
        {children}
      </Box>
    </Box>
  );
};

// Touch-friendly button component
export const TouchButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'filled' | 'outline' | 'subtle';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  disabled?: boolean;
  fullWidth?: boolean;
}> = ({ children, onClick, variant = 'filled', size = 'md', disabled, fullWidth }) => {
  const { isMobile } = useResponsiveBreakpoints();
  const [isPressed, setIsPressed] = useState(false);

  const buttonSize = isMobile ? (size === 'sm' ? 'md' : size === 'md' ? 'lg' : size) : size;

  return (
    <Button
      variant={variant}
      size={buttonSize}
      disabled={disabled}
      fullWidth={fullWidth}
      onClick={onClick}
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      style={{
        transform: isPressed ? 'scale(0.98)' : 'scale(1)',
        transition: 'transform 0.1s ease',
        minHeight: isMobile ? 48 : undefined, // Touch target size
        minWidth: isMobile ? 48 : undefined,
      }}
    >
      {children}
    </Button>
  );
};

// Floating action button for mobile
export const FloatingActionButton: React.FC<{
  icon: React.ReactNode;
  onClick: () => void;
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
  color?: string;
  tooltip?: string;
}> = ({ 
  icon, 
  onClick, 
  position = 'bottom-right', 
  color = 'blue',
  tooltip 
}) => {
  const { isMobile } = useResponsiveBreakpoints();
  const [scrolled, { open, close }] = useDisclosure(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 200) {
        open();
      } else {
        close();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [open, close]);

  if (!isMobile) return null;

  const getPosition = () => {
    switch (position) {
      case 'bottom-left':
        return { bottom: 20, left: 20 };
      case 'bottom-center':
        return { bottom: 20, left: '50%', transform: 'translateX(-50%)' };
      default:
        return { bottom: 20, right: 20 };
    }
  };

  const fab = (
    <ActionIcon
      size="xl"
      radius="xl"
      color={color}
      onClick={onClick}
      style={{
        position: 'fixed',
        zIndex: 1000,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        ...getPosition(),
      }}
    >
      {icon}
    </ActionIcon>
  );

  return tooltip ? (
    <Tooltip label={tooltip} position="top">
      {fab}
    </Tooltip>
  ) : fab;
};

// Scroll to top component
export const ScrollToTop: React.FC = () => {
  const [scrolled, { open, close }] = useDisclosure(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        open();
      } else {
        close();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [open, close]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Affix position={{ bottom: 80, right: 20 }}>
      <Transition transition="slide-up" mounted={scrolled}>
        {(transitionStyles) => (
          <ActionIcon
            size="lg"
            variant="filled"
            color="blue"
            onClick={scrollToTop}
            style={transitionStyles}
          >
            <IconChevronUp size={18} />
          </ActionIcon>
        )}
      </Transition>
    </Affix>
  );
};

// Mobile performance indicators
export const MobilePerformanceIndicator: React.FC = () => {
  const [performanceData, setPerformanceData] = useState({
    loading: true,
    score: 0,
    metrics: {}
  });

  useEffect(() => {
    // Simulate performance data collection
    const timer = setTimeout(() => {
      setPerformanceData({
        loading: false,
        score: 85 + Math.random() * 15, // Random score between 85-100
        metrics: {
          lcp: 2000 + Math.random() * 1000,
          fcp: 1200 + Math.random() * 800,
          cls: Math.random() * 0.1,
        }
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const { isMobile } = useResponsiveBreakpoints();

  if (!isMobile || performanceData.loading) return null;

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'green';
    if (score >= 70) return 'yellow';
    return 'red';
  };

  return (
    <Card
      withBorder
      p="xs"
      style={{
        position: 'fixed',
        top: 10,
        left: 10,
        width: 120,
        zIndex: 999,
        opacity: 0.9,
      }}
    >
      <Group gap="xs" align="center">
        <IconDeviceMobile size={14} />
        <Badge 
          size="xs" 
          color={getScoreColor(performanceData.score)}
        >
          {Math.round(performanceData.score)}
        </Badge>
      </Group>
    </Card>
  );
};

// Accessibility improvements for mobile
export const MobileAccessibilityEnhancements: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { isMobile } = useResponsiveBreakpoints();
  const [fontSize, setFontSize] = useState(16);
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    if (isMobile) {
      // Apply mobile accessibility enhancements
      document.documentElement.style.setProperty('--mobile-font-size', `${fontSize}px`);
      
      if (highContrast) {
        document.documentElement.classList.add('high-contrast');
      } else {
        document.documentElement.classList.remove('high-contrast');
      }
    }
  }, [isMobile, fontSize, highContrast]);

  const increaseFontSize = () => setFontSize(prev => Math.min(prev + 2, 24));
  const decreaseFontSize = () => setFontSize(prev => Math.max(prev - 2, 12));

  if (!isMobile) return <>{children}</>;

  return (
    <Box>
      {/* Accessibility controls */}
      <Box
        style={{
          position: 'fixed',
          top: 10,
          right: 10,
          zIndex: 1000,
        }}
      >
        <Group gap="xs">
          <ActionIcon size="sm" variant="subtle" onClick={decreaseFontSize}>
            <IconZoomOut size={12} />
          </ActionIcon>
          <ActionIcon size="sm" variant="subtle" onClick={increaseFontSize}>
            <IconZoomIn size={12} />
          </ActionIcon>
        </Group>
      </Box>
      
      <Box style={{ fontSize: `${fontSize}px` }}>
        {children}
      </Box>
    </Box>
  );
};

export default {
  useTouchGestures,
  useVirtualKeyboard,
  useResponsiveBreakpoints,
  MobileNavigation,
  MobileList,
  TouchButton,
  FloatingActionButton,
  ScrollToTop,
  MobilePerformanceIndicator,
  MobileAccessibilityEnhancements,
};