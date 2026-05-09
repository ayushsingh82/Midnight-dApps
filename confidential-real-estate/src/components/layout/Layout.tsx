import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { ConnectButton } from '../ui/ConnectButton';
import { AccountModal } from '../ui/AccountModal';

interface LayoutProps {
  children: ReactNode;
  className?: string;
}

export function Layout({ children, className }: LayoutProps) {
  return (
    <div className={cn('min-h-screen bg-bg', className)}>
      <header className="sticky top-0 z-40 w-full bg-bg/80 backdrop-blur-xl">
        <div className="relative max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-border-hover to-transparent" />
          <Link to="/" className="flex items-center gap-2.5 group">
            <span className="text-[15px] font-semibold tracking-tight text-white">
              Confidential <span className="text-text-muted">Real Estate</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-[13px]">
            <NavLink to="/deploy">Deploy</NavLink>
            <NavLink to="/issue">Issue</NavLink>
            <NavLink to="/claim">Claim</NavLink>
          </nav>
          <ConnectButton />
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-12">{children}</main>
      <AccountModal />
    </div>
  );
}

function NavLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="px-3 py-1.5 rounded-lg text-text-secondary hover:text-white hover:bg-bg-tertiary transition-colors">
      {children}
    </Link>
  );
}
