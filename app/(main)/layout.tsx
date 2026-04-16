import { Sidebar } from '@/components/layout/Sidebar'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-dvh flex flex-col lg:flex-row overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0">
        {children}
      </div>
    </div>
  )
}
