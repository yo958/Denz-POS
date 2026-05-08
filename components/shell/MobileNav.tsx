'use client';

// ─────────────────────────────────────────────────────────────────
// Bottom tab bar for mobile. Mirrors Sidebar nav but shown <md only.
// ─────────────────────────────────────────────────────────────────

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid, BookOpen, BedDouble, BarChart2, Settings,
  Laptop, ChefHat, History, LogOut,
} from 'lucide-react';
import { setCurrentStaffId, useCurrentStaff } from '@/lib/hooks/useStore';

const NAV = [
  { href: '/',          icon: LayoutGrid, label: 'POS',     managerOnly: false },
  { href: '/coworking', icon: Laptop,     label: 'Desks',   managerOnly: false },
  { href: '/menu',      icon: BookOpen,   label: 'Menu',    managerOnly: false },
  { href: '/rooms',     icon: BedDouble,  label: 'Rooms',   managerOnly: false },
  { href: '/kds',       icon: ChefHat,    label: 'Kitchen', managerOnly: false },
  { href: '/history',   icon: History,    label: 'History', managerOnly: true  },
  { href: '/reports',   icon: BarChart2,  label: 'Reports', managerOnly: true  },
  { href: '/settings',  icon: Settings,   label: 'Settings',managerOnly: true  },
];

export function MobileNav() {
  const pathname = usePathname();
  const me = useCurrentStaff();

  return (
    <nav
      aria-label="Main navigation"
      className="
        md:hidden fixed bottom-0 inset-x-0 z-40
        glass-strong border-t border-border
        flex overflow-x-auto overscroll-contain
      "
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {NAV.filter(({ managerOnly }) => !managerOnly || me?.role === 'manager').map(({ href, icon: Icon, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`
              flex flex-col items-center justify-center gap-0.5
              min-w-[64px] flex-1 py-2 px-2
              text-[10px] font-medium touch-manipulation select-none
              transition-colors
              ${active ? 'text-primary' : 'text-muted-foreground'}
            `}
          >
            <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
            <span>{label}</span>
          </Link>
        );
      })}
      <button
        onClick={() => setCurrentStaffId(null)}
        aria-label="Lock"
        className="flex flex-col items-center justify-center gap-0.5 min-w-[64px] flex-1 py-2 px-2 text-[10px] font-medium text-muted-foreground touch-manipulation select-none"
      >
        <LogOut size={20} strokeWidth={1.8} />
        <span>Lock</span>
      </button>
    </nav>
  );
}
