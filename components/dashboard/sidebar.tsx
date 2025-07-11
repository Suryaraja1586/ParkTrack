"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/dashboard/doctor", label: "Home", roles: ["doctor"] },
  { href: "/dashboard/patient", label: "Home", roles: ["patient"] },
  { href: "/dashboard/patient/cdt", label: "Take CDT", roles: ["patient"] },
  { href: "/dashboard/patient/find-doctor", label: "Find Doctor", roles: ["patient"] },
  { href: "/dashboard/doctor/requests", label: "Requests", roles: ["doctor"] },
  { href: "/dashboard/patient/request-status", label: "Request Status", roles: ["patient"] },
  { href: "/dashboard/doctor/reports", label: "Reports", roles: ["doctor"] },
  { href: "/dashboard/patient/chat", label: "Chat", roles: ["patient"] },
  { href: "/dashboard/doctor/chat", label: "Chat", roles: ["doctor"] }
]
export function Sidebar() {
  const path = usePathname()
  const isDoctor = path.includes("/doctor")

  const filteredItems = navItems.filter(item =>
    item.roles.includes(isDoctor ? "doctor" : "patient")
  )

  return (
    <aside className="w-64 bg-white shadow-md p-4 hidden md:block border-r border-teal-200">
      <h2 className="text-xl font-semibold text-teal-700 mb-4">
        {isDoctor ? "Doctor Panel" : "Patient Panel"}
      </h2>
      <nav className="space-y-2">
        {filteredItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "block px-4 py-2 rounded-lg hover:bg-teal-100 text-teal-800 transition-all duration-200",
              path === item.href && "bg-teal-200 font-bold"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}