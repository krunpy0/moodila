import DesktopSidebar from './DesktopSidebar'
import BottomNav from './BottomNav'

export default function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-background text-on-background lg:flex">
      {/* Desktop Navigation Sidebar (hidden on mobile) */}
      <DesktopSidebar />

      {/* Main Page Content Area */}
      <div className="flex-1 min-w-0 min-h-screen flex flex-col">
        {children}
      </div>

      {/* Mobile Floating Bottom Navigation (hidden on desktop) */}
      <BottomNav />
    </div>
  )
}
