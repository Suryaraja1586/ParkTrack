"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { account, databases } from "@/lib/appwrite"
import { APPWRITE_CONFIG } from "@/lib/constants"
import { Query } from "appwrite"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import TopbarAuth from "@/components/topbar-auth"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleLogin = async () => {
    try {
      // Remove existing session
      try {
        await account.deleteSession("current")
      } catch (_) {}

      // Login with email/password session
      await account.createEmailPasswordSession(email, password)

      // Get userId
      const currentUser = await account.get()

      const docs = await databases.listDocuments(
        APPWRITE_CONFIG.DATABASE_ID,
        APPWRITE_CONFIG.USERS_COLLECTION_ID,
        [Query.equal("userId", currentUser.$id)]
      )

      const user = docs.documents[0]
      if (!user?.role) throw new Error("User role not found.")

      localStorage.setItem(
        "user",
        JSON.stringify({ userId: user.userId, role: user.role })
      )

      toast.success("Login successful!")

      // Role-based redirect
      router.push(user.role === "doctor" ? "/dashboard/doctor" : "/dashboard/patient")
    } catch (err: any) {
      toast.error(err.message || "Login failed")
    }
  }

  return (
    <>
      <TopbarAuth />
      <div className="min-h-screen bg-gradient-to-br from-teal-100 to-gray-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-8 transform transition-all duration-300 hover:shadow-3xl">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-teal-700 mb-2">Welcome To Parktrack</h2>
            <p className="text-gray-600">Access your healthcare account securely</p>
          </div>
          <div className="space-y-6">
            <div>
              <Label htmlFor="email" className="text-teal-800 font-semibold block mb-2">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-teal-800 font-semibold block mb-2">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
              />
            </div>
            <Button
              onClick={handleLogin}
              className="w-full bg-teal-600 text-white p-3 rounded-lg hover:bg-teal-700 transition-all duration-300 transform hover:scale-105"
            >
              Log In
            </Button>
          </div>
          <p className="text-center mt-4 text-gray-600">
            Don’t have an account?{" "}
            <a href="/auth/signup" className="text-teal-600 hover:underline font-semibold">
              Sign up
            </a>
          </p>
        </div>
      </div>
    </>
  )
}