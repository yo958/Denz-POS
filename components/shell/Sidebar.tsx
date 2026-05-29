'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid, BookOpen, BedDouble, BarChart2, Settings, Laptop, ChefHat,
  History, LogOut, Users, LayoutDashboard, Receipt, Globe, CalendarDays,
  Inbox, TrendingUp, LineChart, Search, Layers, Newspaper,
} from 'lucide-react';
import { useCurrentStaff, setCurrentStaffId } from '@/lib/hooks/useStore';
import { signOut } from '@/lib/firebase';

// ── Nav types ─────────────────────────────────────────────────────────────────
type NavChild = { href: string; icon: React.ElementType; label: string };
type NavItem  = {
  href: string; icon: React.ElementType; label: string;
  managerOnly: boolean;
  children?: NavChild[];
};

// ── Nav definition ────────────────────────────────────────────────────────────
const NAV: NavItem[] = [
  { href: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard',     managerOnly: true  },
  { href: '/',             icon: LayoutGrid,      label: 'Tabs',          managerOnly: false },
  { href: '/coworking',    icon: Laptop,          label: 'CoWorking',     managerOnly: false },
  { href: '/menu',         icon: BookOpen,        label: 'Menu',          managerOnly: true  },
  { href: '/rooms',        icon: BedDouble,       label: 'Rooms',         managerOnly: false },
  { href: '/customers',    icon: Users,           label: 'Customers',     managerOnly: false },
  { href: '/kds',          icon: ChefHat,         label: 'Kitchen',       managerOnly: false },
  { href: '/online-orders',icon: Globe,           label: 'Online Orders', managerOnly: true  },
  { href: '/inbox',        icon: Inbox,           label: 'Inbox',         managerOnly: true  },
  { href: '/blog',         icon: Newspaper,       label: 'Blog',          managerOnly: true  },
  {
    href: '/google', icon: Layers, label: 'Google Overview', managerOnly: true,
    children: [
      { href: '/ads',       icon: TrendingUp, label: 'Google Ads'     },
      { href: '/analytics', icon: LineChart,  label: 'Analytics'      },
      { href: '/gsc',       icon: Search,     label: 'Search Console' },
    ],
  },
  { href: '/calendar',     icon: CalendarDays,    label: 'Calendar',      managerOnly: true  },
  { href: '/history',      icon: History,         label: 'History',       managerOnly: true  },
  { href: '/bills',        icon: Receipt,         label: 'Bills',         managerOnly: true  },
  { href: '/reports',      icon: BarChart2,       label: 'Reports',       managerOnly: true  },
  { href: '/settings',     icon: Settings,        label: 'Settings',      managerOnly: true  },
];

// ── Shared link classes ───────────────────────────────────────────────────────
const BASE = `
  flex items-center rounded-xl font-medium transition-all duration-150 cursor-pointer
  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
`;
const ICON_ONLY = `w-10 h-10 justify-center mx-auto`;
const WIDE      = `lg:w-auto lg:h-auto lg:justify-start lg:mx-0 lg:gap-3 lg:px-3`;
const ACTIVE    = `bg-primary/12 text-foreground dark:bg-primary/15`;
const INACTIVE  = `text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5`;

export function Sidebar() {
  const pathname = usePathname();
  const me = useCurrentStaff();

  return (
    <aside className="
      hidden md:flex flex-col
      md:w-14 lg:w-[220px] shrink-0 h-screen sticky top-0
      glass border-r border-border z-30
    ">
      {/* Logo */}
      <Link
        href="/"
        className="flex items-center justify-center lg:justify-start gap-2.5 lg:px-5 py-5 border-b border-border hover:opacity-80 transition-opacity duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Image src="/logo.png" alt="Denz logo" width={32} height={32} priority />
        <span className="hidden lg:block font-semibold text-base tracking-tight">Denz</span>
      </Link>

      {/* Nav */}
      <nav className="flex flex-col gap-1 p-2 lg:p-3 flex-1 overflow-y-auto" aria-label="Main navigation">
        {NAV
          .filter(({ managerOnly }) => !managerOnly || me?.role === 'manager')
          .map(({ href, icon: Icon, label, children }) => {
            const active      = pathname === href;
            const childActive = children?.some(c => pathname === c.href) ?? false;
            const parentHighlight = active || childActive;

            return (
              <div key={href}>
                {/* Parent item */}
                <Link
                  href={href}
                  title={label}
                  aria-current={active ? 'page' : undefined}
                  className={`${BASE} text-sm ${ICON_ONLY} ${WIDE} lg:py-2.5 ${parentHighlight ? ACTIVE : INACTIVE}`}
                >
                  <Icon
                    size={18}
                    strokeWidth={parentHighlight ? 2.2 : 1.8}
                    className={parentHighlight ? 'text-primary' : ''}
                  />
                  <span className="hidden lg:block">{label}</span>
                </Link>

                {/* Sub-items — wide: indented with connector line; compact: icon row */}
                {children && parentHighlight && (
                  <div className="
                    hidden lg:flex flex-col gap-0.5
                    ml-3 pl-3 mt-0.5 mb-0.5
                    border-l border-border
                  ">
                    {children.map(({ href: cHref, icon: CIcon, label: cLabel }) => {
                      const cActive = pathname === cHref;
                      return (
                        <Link
                          key={cHref}
                          href={cHref}
                          title={cLabel}
                          aria-current={cActive ? 'page' : undefined}
                          className={`${BASE} text-xs gap-2.5 px-2.5 py-1.5 ${cActive ? ACTIVE : INACTIVE}`}
                        >
                          <CIcon size={14} strokeWidth={cActive ? 2.2 : 1.8} className={cActive ? 'text-primary' : ''} />
                          {cLabel}
                        </Link>
                      );
                    })}
                  </div>
                )}

                {/* Compact (icon-only) mode: show child icons directly */}
                {children && parentHighlight && (
                  <div className="flex flex-col gap-0.5 lg:hidden">
                    {children.map(({ href: cHref, icon: CIcon, label: cLabel }) => {
                      const cActive = pathname === cHref;
                      return (
                        <Link
                          key={cHref}
                          href={cHref}
                          title={cLabel}
                          aria-current={cActive ? 'page' : undefined}
                          className={`${BASE} text-xs ${ICON_ONLY} ${cActive ? ACTIVE : INACTIVE}`}
                        >
                          <CIcon size={15} strokeWidth={cActive ? 2.2 : 1.8} className={cActive ? 'text-primary' : ''} />
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
      </nav>

      {/* Staff avatar */}
      <div className="flex items-center justify-center lg:justify-start gap-3 lg:px-5 py-4 border-t border-border">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
          {me?.initials ?? '··'}
        </div>
        <div className="hidden lg:flex flex-col leading-tight flex-1 min-w-0">
          <span className="text-sm font-medium truncate">{me?.name ?? 'Staff'}</span>
          <span className="text-xs text-muted-foreground capitalize">{me?.role ?? 'on shift'}</span>
        </div>
        <button
          onClick={() => { setCurrentStaffId(null); void signOut(); }}
          aria-label="Sign out"
          title="Sign out"
          className="flex items-center justify-center w-8 h-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <LogOut size={14} strokeWidth={2} />
        </button>
      </div>
    </aside>
  );
}
