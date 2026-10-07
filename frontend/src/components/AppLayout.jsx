/* Hallmark · designed-as-app · design-system: DESIGN.md */
import DesktopSidebar from './DesktopSidebar'
import BottomNav from './BottomNav'
import HalloweenDecorations from './HalloweenDecorations'

export default function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-background text-on-background lg:flex relative">
      {/* Atmospheric Halloween ambient layer */}
      <HalloweenDecorations />

      {/* Desktop Navigation Sidebar (hidden on mobile) */}
      <DesktopSidebar />

      {/* Main Page Content Area */}
      <div className="flex-1 min-w-0 min-h-screen flex flex-col pt-safe-top lg:pt-0">
        {children}
      </div>

      {/* Mobile Floating Bottom Navigation (hidden on desktop) */}
      <BottomNav />
    </div>
  )
}
