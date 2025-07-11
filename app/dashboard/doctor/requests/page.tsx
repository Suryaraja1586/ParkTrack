"use client"

import { useEffect, useState } from "react"
import { databases, Query } from "@/lib/appwrite"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { APPWRITE_CONFIG } from "@/lib/constants"

export default function DoctorRequestsPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [doctorId, setDoctorId] = useState("")

  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (userData) {
      const parsed = JSON.parse(userData)
      setDoctorId(parsed.userId)
    }
  }, [])

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const res = await databases.listDocuments(APPWRITE_CONFIG.DATABASE_ID, APPWRITE_CONFIG.REQUESTS_COLLECTION_ID, [
          Query.equal("doctorId", doctorId),
          Query.equal("status", "pending")
        ])

        const enriched = await Promise.all(
          res.documents.map(async (req) => {
            const patientRes = await databases.listDocuments(APPWRITE_CONFIG.DATABASE_ID, APPWRITE_CONFIG.USERS_COLLECTION_ID, [
              Query.equal("userId", req.patientId)
            ])
            return {
              ...req,
              patientName: patientRes?.documents?.[0]?.name || "Unknown"
            }
          })
        )

        setRequests(enriched)
      } catch (err) {
        toast.error("Failed to fetch requests")
      } finally {
        setLoading(false)
      }
    }

    fetchRequests()
  }, [doctorId])

  const handleUpdate = async (requestId: string, patientId: string, action: "accepted" | "rejected") => {
    try {
      await databases.updateDocument(APPWRITE_CONFIG.DATABASE_ID, APPWRITE_CONFIG.REQUESTS_COLLECTION_ID, requestId, {
        status: action
      })

      if (action === "accepted") {
        const patientRes = await databases.listDocuments(APPWRITE_CONFIG.DATABASE_ID, APPWRITE_CONFIG.USERS_COLLECTION_ID, [
          Query.equal("userId", patientId)
        ])
        const patientDoc = patientRes?.documents?.[0]
        if (patientDoc) {
          await databases.updateDocument(APPWRITE_CONFIG.DATABASE_ID, APPWRITE_CONFIG.USERS_COLLECTION_ID, patientDoc.$id, {
            assignedDoctorId: doctorId
          })
        }
      }

      toast.success(`Request ${action}`)
      setRequests((prev) => prev.filter((r) => r.$id !== requestId))
    } catch (err) {
      toast.error("Failed to update request")
    }
  }

  return (
    <div className="p-6 bg-gradient-to-br from-teal-50 to-gray-50 min-h-screen">
      <h2 className="text-3xl font-bold text-teal-700 mb-6">Patient Requests</h2>
      {loading ? (
        <p className="text-center text-gray-600">Loading...</p>
      ) : requests.length === 0 ? (
        <p className="text-center text-gray-600">No requests.</p>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div
              key={req.$id}
              className="p-4 border border-teal-200 rounded-lg bg-white shadow-md hover:shadow-lg transition-all duration-300"
            >
              <p className="text-teal-800 font-semibold">Patient: {req.patientName}</p>
              <p className="text-gray-600">Status: {req.status}</p>
              <div className="mt-3 flex gap-2">
                <Button
                  onClick={() => handleUpdate(req.$id, req.patientId, "accepted")}
                  className="bg-teal-600 text-white hover:bg-teal-700 transition-all duration-300 hover:scale-105"
                >
                  Accept
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleUpdate(req.$id, req.patientId, "rejected")}
                  className="hover:bg-red-700 transition-all duration-300 hover:scale-105"
                >
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}