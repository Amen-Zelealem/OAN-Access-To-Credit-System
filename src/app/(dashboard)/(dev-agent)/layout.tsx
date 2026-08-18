'use client';

import { DashboardHeader } from '@/components/header/DashboardHeader';
import Sidebar, { NavSection } from '@/components/Sidebar';
import { selectAuthStatus } from '@/features/auth/store/authSlice';
import { useAppSelector } from '@/store/hooks';
import { LayoutDashboard, ListChecks, Users, FileText } from 'lucide-react';
import { usePathname } from 'next/navigation';
import React, { useEffect, useState } from 'react';

import '@/styles/main-layout.scss';

const navigationSections: NavSection[] = [
  {
    title: 'DASHBOARDS',
    items: [
      {
        path: '/leads',
        activePaths: ['/leads', '/leads/new'],
        label: 'Leads Dashboard',
        icon: Users,
      },
      {
        path: '/loan-application-dashboard',
        activePaths: ['/loan-application-dashboard'],
        label: 'Loans Dashboard',
        icon: LayoutDashboard,
      },
      {
        path: '/agent-application-lists',
        activePaths: ['/agent-application-lists'],
        label: 'Applications Lists',
        icon: FileText,
      },
    ],
  },
  {
    title: 'WORKFLOW',
    items: [
      {
        path: '#',
        label: 'New Loan Application',
        icon: ListChecks,
      },
    ],
  },
];

const PAGE_TITLES: Record<string, string> = {
  '/leads': 'Leads Pipeline',
  '/leads/new': 'Create New Lead',
};

export default function DevAgentLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();
  const authStatus = useAppSelector(selectAuthStatus);
  // getMeThunk (dispatched on app mount) hasn't resolved yet — mounting
  // DashboardHeader before then risks it hydrating after the session resolves
  // client-side but before the server-rendered (unresolved) HTML is compared,
  // which mismatches and forces a client rebuild that flashes the generic role
  // name. Matches the same gate BankAdminLayout uses for the same reason.
  const authResolved = authStatus === 'succeeded' || authStatus === 'failed';

  const filteredSections = navigationSections.map(section => {
    if (section.title === 'WORKFLOW') {
      return {
        ...section,
        items: section.items.map(item => ({
          ...item,
          path: pathname.endsWith('/new-loan-application') ? pathname : item.path,
        })),
      };
    }
    return section;
  }).filter(section => {
    if (section.title === 'WORKFLOW') return pathname.endsWith('/new-loan-application');
    return true;
  });

  const activeItem = filteredSections
    .flatMap(s => s.items)
    .find(item =>
      item.path === pathname ||
      item.activePaths?.includes(pathname) ||
      (item.label === 'New Loan Application' && pathname.endsWith('/new-loan-application'))
    );

  const pageTitle = activeItem?.label ?? PAGE_TITLES[pathname] ?? 'Dashboard';

  useEffect(() => {
    document.title = `${pageTitle} | Open AgriNet`;
  }, [pageTitle]);

  useEffect(() => {
    // Closes the mobile nav on route change — can't be computed during render
    // since it has to react to navigation, not just the current render's props.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobileOpen(false);
  }, [pathname]);

  function handleToggleSidebar() {
    if (window.innerWidth <= 900) {
      setIsMobileOpen(prev => !prev);
    } else {
      setIsSidebarCollapsed(prev => !prev);
    }
  }

  if (!authResolved) {
    return null;
  }

  return (
    <div
      id="dashboard-shell"
      className={`dashboard-shell ${isSidebarCollapsed ? 'dashboard-shell--collapsed' : ''}`}
    >
      {isMobileOpen && (
        <div
          className="dashboard-sidebar-overlay"
          aria-hidden="true"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        isMobileOpen={isMobileOpen}
        sections={filteredSections}
      />
      <main id="dashboard-main" className="dashboard-main">
        <DashboardHeader
          onMenuClick={handleToggleSidebar}
          title={pageTitle}
        />
        <div id="dashboard-content" className="dashboard-content">
          {children}
        </div>
      </main>
    </div>
  );
}
