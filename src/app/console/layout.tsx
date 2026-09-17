import { ReactNode } from 'react'
import { AdminSidebar } from '@/components/console/AdminSidebar'

// 后台页面全部依赖实时数据：静态预渲染会在构建期连库，导致镜像构建必须挂数据库，
// 且预渲染结果会把数据冻结进镜像。整个 /console 段统一按运行时渲染。
export const dynamic = 'force-dynamic'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background-cream">
      <AdminSidebar />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  )
}
