import React from 'react';

interface LinkProps {
  href: string | { pathname?: string; query?: any; hash?: string };
  as?: string;
  replace?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  prefetch?: boolean;
  locale?: string | false;
  passHref?: boolean;
  legacyBehavior?: boolean;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  onMouseEnter?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  className?: string;
}

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ href, as, children, onClick, legacyBehavior = false, ...props }, ref) => {
    const hrefString = typeof href === 'string' ? href : href.pathname || '/';
    
    // Handle onClick
    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (onClick) {
        onClick(e);
      }
    };

    // For Next.js 13+ behavior (no <a> tag wrapping needed)
    if (!legacyBehavior && React.isValidElement(children) && children.type === 'a') {
      return React.cloneElement(children as any, {
        href: hrefString,
        onClick: handleClick,
        'data-testid': 'next-link',
        ...props,
      });
    }

    // For legacy behavior or when children is not an <a> tag
    if (legacyBehavior) {
      // In legacy mode, we just pass props to the child
      return (
        <a href={hrefString} ref={ref} onClick={handleClick} data-testid="next-link" {...props}>
          {children}
        </a>
      );
    }

    // Default Next.js 13+ behavior
    return (
      <a href={hrefString} ref={ref} onClick={handleClick} data-testid="next-link" {...props}>
        {children}
      </a>
    );
  }
);

Link.displayName = 'NextLink';

export default Link;