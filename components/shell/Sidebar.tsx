'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { LayoutGrid, BookOpen, BedDouble, BarChart2, Settings, Laptop, ChefHat, History, LogOut } from 'lucide-react';
import { useCurrentStaff, setCurrentStaffId } from '@/lib/hooks/useStore';

const NAV = [
  { href: '/',           icon: LayoutGrid, label: 'Tabs',      managerOnly: false },
  { href: '/coworking',  icon: Laptop,     label: 'CoWorking', managerOnly: false },
  { href: '/menu',       icon: BookOpen,   label: 'Menu',      managerOnly: false },
  { href: '/rooms',      icon: BedDouble,  label: 'Rooms',     managerOnly: false },
  { href: '/kds',        icon: ChefHat,    label: 'Kitchen',   managerOnly: false },
  { href: '/history',    icon: History,    label: 'History',   managerOnly: true  },
  { href: '/reports',    icon: BarChart2,  label: 'Reports',   managerOnly: true  },
  { href: '/settings',   icon: Settings,   label: 'Settings',  managerOnly: true  },
];

export function Sidebar() {
  const pathname = usePathname();
  const me = useCurrentStaff();

  return (
    <aside className="
      hidden md:flex flex-col
      w-[220px] shrink-0 h-screen sticky top-0
      glass border-r border-border
      z-30
    ">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 px-5 py-5 border-b border-border hover:opacity-80 transition-opacity duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <Image
          src="/logo.png"
          alt="Denz logo"
          width={32}
          height={32}
          className=""
          priority
        />
        <span className="font-semibold text-base tracking-tight">Denz</span>
      </Link>

      {/* Nav */}
      <nav className="flex flex-col gap-1 p-3 flex-1" aria-label="Main navigation">
        {NAV.filter(({ managerOnly }) => !managerOnly || me?.role === 'manager').map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                transition-all duration-150 cursor-pointer
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
                ${active
                  ? 'bg-primary/12 text-foreground dark:bg-primary/15'
                  : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'
                }
              `}
              aria-current={active ? 'page' : undefined}
            >
              <Icon
                size={18}
                strokeWidth={active ? 2.2 : 1.8}
                className={active ? 'text-primary' : ''}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Staff avatar */}
      <div className="flex items-center gap-3 px-5 py-4 border-t border-border">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
          {me?.initials ?? '··'}
        </div>
        <div className="flex flex-col leading-tight flex-1 min-w-0">
          <span className="text-sm font-medium truncate">{me?.name ?? 'Staff'}</span>
          <span className="text-xs text-muted-foreground capitalize">{me?.role ?? 'on shift'}</span>
        </div>
        <button
          onClick={() => setCurrentStaffId(null)}
          aria-label="Lock"
          title="Lock"
          className="flex items-center justify-center w-8 h-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <LogOut size={14} strokeWidth={2} />
        </button>
      </div>
    </aside>
  );
}
