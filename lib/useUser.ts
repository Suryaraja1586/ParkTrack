// ✅ FILE: lib/useUser.ts

import { useEffect, useState } from "react"
import { account } from "@/lib/appwrite"
import { Models } from "appwrite"

export type AppwriteUser = {
  $id: string
  email: string
  name: string
  role: "doctor" | "patient"
  createdAt?: string
}

export const useUser = () => {
  const [user, setUser] = useState<AppwriteUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getData = async () => {
      try {
        const session = await account.get()
        const userId = session.$id

        // fetch user details from your Appwrite Database
        const res = await fetch("/api/get-user", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId }),
        })

        const userData = await res.json()
        setUser(userData)
      } catch (err) {
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    getData()
  }, [])

  return { user, loading }
}
