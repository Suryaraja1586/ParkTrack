"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { account, databases } from "@/lib/appwrite"
import { APPWRITE_CONFIG } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import TopbarAuth from "@/components/topbar-auth"
import { Label } from "@radix-ui/react-label"

export default function SignupPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "patient" })
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // 1. Create user in Appwrite Auth
      const user = await account.create(
        "unique()", 
        form.email, 
        form.password,
        form.name
      )

      // 2. Store in Users Collection with user.$id as document ID
      await databases.createDocument(
        APPWRITE_CONFIG.DATABASE_ID,
        APPWRITE_CONFIG.USERS_COLLECTION_ID,
        user.$id, // 👈 this must match
        {
          userId: user.$id,
          name: form.name,
          email: form.email,
          role: form.role,
          createdAt: new Date().toISOString()
        }
      )

      toast.success("Signup successful! Please login.")
      router.push("/auth/login")
    } catch (error: any) {
      toast.error(error.message || "Signup failed.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <TopbarAuth />
      <div className="min-h-screen bg-gradient-to-br from-teal-100 to-gray-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-8 transform transition-all duration-300 hover:shadow-3xl">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-teal-700 mb-2">Join Us</h2>
            <p className="text-gray-600">Create your healthcare account today</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="name" className="text-teal-800 font-semibold block mb-2">
                Name
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="Enter your name"
                value={form.name}
                onChange={handleChange}
                required
                className="w-full p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <Label htmlFor="email" className="text-teal-800 font-semibold block mb-2">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Enter your email"
                value={form.email}
                onChange={handleChange}
                required
                className="w-full p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-teal-800 font-semibold block mb-2">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Enter your password"
                value={form.password}
                onChange={handleChange}
                required
                className="w-full p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <Label htmlFor="role" className="text-teal-800 font-semibold block mb-2">
                Role
              </Label>
              <select
                id="role"
                name="role"
                value={form.role}
                onChange={handleChange}
                className="w-full p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all bg-white"
              >
                <option value="patient">Patient</option>
                <option value="doctor">Doctor</option>
              </select>
            </div>
            <Button
              type="submit"
              className="w-full bg-teal-600 text-white p-3 rounded-lg hover:bg-teal-700 transition-all duration-300 transform hover:scale-105"
              disabled={loading}
            >
              {loading ? "Signing up..." : "Sign up"}
            </Button>
          </form>
          <p className="text-center mt-4 text-gray-600">
            Already have an account?{" "}
            <a href="/auth/login" className="text-teal-600 hover:underline font-semibold">
              Log in
            </a>
          </p>
        </div>
      </div>
    </>
  )
}