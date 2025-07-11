"use client"

import { useEffect, useState } from "react"
import { databases, account } from "@/lib/appwrite"
import { APPWRITE_CONFIG } from "@/lib/constants"
import { Query } from "appwrite"

export default function RequestStatusPage() {
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [requestId, setRequestId] = useState<string | null>(null)

  useEffect(() => {
    const fetchRequestStatus = async () => {
      try {
        const session = await account.get()
        const patientId = session.$id
        const response = await databases.listDocuments(
          APPWRITE_CONFIG.DATABASE_ID,
          APPWRITE_CONFIG.REQUESTS_COLLECTION_ID,
          [
            Query.equal("patientId", patientId),
            Query.orderDesc("$createdAt"),
            Query.limit(1),
          ]
        )

        const latestRequest = response.documents[0]
        if (!latestRequest) {
          setStatus(null)
        } else {
          setRequestId(latestRequest.$id)
          setStatus(latestRequest.status)
        }
      } catch (error) {
        console.error("Failed to fetch request status:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchRequestStatus()
  }, [])

  if (loading) return <p className="p-6 text-center text-gray-600">Loading...</p>

  if (status === "accepted") {
    return (
      <div className="p-6 bg-gradient-to-br from-teal-50 to-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center bg-white p-6 rounded-lg shadow-md">
          <p className="text-2xl text-green-600 font-semibold">
            🎉 Your doctor has accepted your request!
          </p>
          <p className="text-gray-600 mt-2">You may now start chatting or wait for consultation.</p>
        </div>
      </div>
    )
  }

  if (status === "rejected") {
    return (
      <div className="p-6 bg-gradient-to-br from-teal-50 to-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center bg-white p-6 rounded-lg shadow-md">
          <p className="text-2xl text-red-500 font-medium">
            ❌ Your request was rejected.
          </p>
          <p className="text-gray-600 mt-2">Please find and request another doctor.</p>
        </div>
      </div>
    )
  }

  if (status === "pending") {
    return (
      <div className="p-6 bg-gradient-to-br from-teal-50 to-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center bg-white p-6 rounded-lg shadow-md">
          <p className="text-2xl text-yellow-600 font-medium">
            ⏳ Your request is still pending.
          </p>
          <p className="text-gray-600 mt-2">Please wait for the doctor to respond.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 bg-gradient-to-br from-teal-50 to-gray-50 min-h-screen flex items-center justify-center">
      <div className="text-center bg-white p-6 rounded-lg shadow-md">
        <p className="text-gray-600">No request found. You can go to the "Find Doctor" page to send one.</p>
      </div>
    </div>
  )
}