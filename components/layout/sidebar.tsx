'use client'
import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Menu, FileText, Calculator } from "lucide-react"
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function Sidebar({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const menuItems = [
    { name: '作成', href: '/create', icon: FileText },
    { name: 'ツール', href: '/tool', icon: Calculator },
  ]

  return (
    <div className="flex min-h-screen">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="fixed top-4 left-4">
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64">
          <SheetHeader>
            <SheetTitle>メニュー</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-4 mt-8">
            {menuItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-accent ${
                    pathname === item.href ? 'bg-accent' : ''
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>
        </SheetContent>
      </Sheet>
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
} 