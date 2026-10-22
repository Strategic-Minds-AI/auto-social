import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { Building2, Megaphone, FileText, CalendarClock, Menu, X, Sparkles, CalendarDays, ListChecks, Share2, LayoutDashboard, Bot, MessageSquare, Inbox, Film, Brain, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import BusinessSwitcher from './BusinessSwitcher';

const BRAND_LOGO =
  'https://media.base44.com/images/public/6ac4dd914af935b8c986b411/854a71ca3_836982562_28635455156118005_3935075842464884998_n.jpg';

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Analytics', path: '/analytics', icon: TrendingUp },
  { label: 'Intelligence', path: '/intelligence', icon: Brain },
  { label: 'Leads', path: '/leads', icon: Inbox },
  { label: 'Businesses', path: '/businesses', icon: Building2 },
  { label: 'Campaigns', path: '/campaigns', icon: Megaphone },
  { label: 'Content Studio', path: '/studio', icon: Sparkles },
  { label: 'Video Studio', path: '/video-studio', icon: Film },
  { label: 'Calendar', path: '/calendar', icon: CalendarDays },
  { label: 'Approval Queue', path: '/approval-queue', icon: ListChecks },
  { label: 'Social Accounts', path: '/social-accounts', icon: Share2 },
  { label: 'Auto Social', path: '/auto-social', icon: CalendarClock },
  { label: 'Content Library', path: '/content', icon: FileText },
  { label: 'Eden Skye', path: '/assistant', icon: Bot },
  { label: 'Text Alerts', path: '/text-alerts', icon: MessageSquare },
];

export default function AppShell() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col transition-transform duration-300",
        "lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center glow-primary-sm">
              <img src={BRAND_LOGO} alt="Strategic Minds AI" className="w-full h-full object-cover" />
            </div>
            <span className="font-space font-bold text-base leading-tight text-gradient">Strategic Minds AI</span>
          </div>
        </div>

        {/* Business Switcher */}
        <div className="px-4 py-4 border-b border-border">
          <BusinessSwitcher />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ label, path, icon: Icon }) => {
            const active = location.pathname.startsWith(path);
            return (
              <Link
                key={path}
                to={path}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-primary/15 text-primary glow-primary-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">AI Marketing Studio</p>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-64 min-h-screen flex flex-col">
        {/* Mobile topbar */}
        <header className="lg:hidden sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={BRAND_LOGO} alt="Strategic Minds AI" className="w-6 h-6 rounded-md object-cover" />
            <span className="font-space font-bold text-gradient">Strategic Minds AI</span>
          </div>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="text-muted-foreground">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}