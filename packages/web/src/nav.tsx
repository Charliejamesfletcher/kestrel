import { createContext, useContext, type AnchorHTMLAttributes, type MouseEvent } from 'react';

// Real <a href>s so new-tab and copy-link still work; we only intercept plain clicks.

export type Navigate = (to: string, opts?: { replace?: boolean; keepScroll?: boolean }) => void;

export const NavContext = createContext<Navigate>((to) => {
  window.location.assign(to);
});

export function useNavigate(): Navigate {
  return useContext(NavContext);
}

export function Link({ href, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const navigate = useNavigate();
  function handle(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(href);
  }
  return <a href={href} onClick={handle} {...rest} />;
}
