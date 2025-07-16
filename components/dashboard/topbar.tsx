"use client"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { Menu } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { account } from "@/lib/appwrite"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/dashboard/doctor", label: "Home", roles: ["doctor"] },
  { href: "/dashboard/doctor/requests", label: "Requests", roles: ["doctor"] },
  { href: "/dashboard/doctor/reports", label: "Reports", roles: ["doctor"] },
  { href: "/dashboard/doctor/chat", label: "Chat", roles: ["doctor"] },
  { href: "/dashboard/patient", label: "Home", roles: ["patient"] },  
  { href: "/dashboard/patient/cdt", label: "Take CDT", roles: ["patient"] }, 
  { href: "/dashboard/patient/find-doctor", label: "Find-Doctor", roles: ["patient"] }, 
   { href: "/dashboard/patient/request-status", label: "Request-Status", roles: ["patient"] },
  { href: "/dashboard/patient/chat", label: "Chat", roles: ["patient"] }
]

export function Topbar() {
  const router = useRouter()
  const pathname = usePathname()
  const isDoctor = pathname.includes("/doctor")

  const filteredItems = navItems.filter(item =>
    item.roles.includes(isDoctor ? "doctor" : "patient")
  )

  const logout = async () => {
    try {
      await account.get()
      await account.deleteSession("current")
      router.push("/auth/login")
    } catch (_) {
      router.push("/auth/login")
    }
  }

  return (
    <header className="w-full border-b bg-gradient-to-br from-teal-100 to-gray-100 shadow-md p-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Menu className="w-6 h-6 text-teal-700 cursor-pointer" />
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-4 bg-white shadow-lg">
              <SheetTitle className="text-xl font-semibold text-teal-700 mb-4">
                {isDoctor ? "Doctor Panel" : "Patient Panel"}
              </SheetTitle>
              <nav className="space-y-2">
                {filteredItems.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "block px-4 py-2 rounded-lg hover:bg-teal-100 text-teal-800 transition-all duration-200",
                      pathname === item.href && "bg-teal-200 font-bold"
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
        <h1 className="text-2xl font-bold text-teal-700">CarePulse</h1>
      </div>
      <Button
        onClick={logout}
        variant="outline"
        className="border-teal-700 text-teal-700 hover:bg-teal-100 hover:text-teal-800 transition-all duration-200"
      >
        Logout
      </Button>
    </header>
  )
}