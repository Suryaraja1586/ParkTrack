"use client"

import { useEffect, useState } from "react"
import { databases, ID, Query } from "@/lib/appwrite"
import { APPWRITE_CONFIG } from "@/lib/constants"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

export default function FindDoctorPage() {
  const [doctors, setDoctors] = useState<any[]>([])
  const [sentRequests, setSentRequests] = useState<{ [key: string]: string }>({})
  const [assignedDoctorId, setAssignedDoctorId] = useState<string | null>(null)
  const [patientId, setPatientId] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const storedUser = localStorage.getItem("user")
        const parsedUser = storedUser ? JSON.parse(storedUser) : null
        const id = parsedUser?.userId
        if (!id) {
          toast.error("User not found. Please log in.")
          return
        }
        setPatientId(id)

        const doctorRes = await databases.listDocuments(APPWRITE_CONFIG.DATABASE_ID, APPWRITE_CONFIG.USERS_COLLECTION_ID, [
          Query.equal("role", "doctor")
        ])
        setDoctors(doctorRes.documents)

        const patientRes = await databases.listDocuments(APPWRITE_CONFIG.DATABASE_ID, APPWRITE_CONFIG.USERS_COLLECTION_ID, [
          Query.equal("userId", id)
        ])
        const patient = patientRes.documents[0]
        if (patient?.assignedDoctorId) {
          setAssignedDoctorId(patient.assignedDoctorId)
        }

        const requestRes = await databases.listDocuments(APPWRITE_CONFIG.DATABASE_ID, APPWRITE_CONFIG.REQUESTS_COLLECTION_ID, [
          Query.equal("patientId", id)
        ])
        const map: { [key: string]: string } = {}
        requestRes.documents.forEach((req) => {
          map[req.doctorId] = req.status
        })
        setSentRequests(map)
      } catch (err) {
        console.error(err)
        toast.error("Failed to load doctors or requests")
      }
    }

    fetchData()
  }, [])

  const handleSendRequest = async (doctorId: string) => {
    if (!patientId) {
      toast.error("Patient ID not available")
      return
    }
    try {
      await databases.createDocument(APPWRITE_CONFIG.DATABASE_ID, APPWRITE_CONFIG.REQUESTS_COLLECTION_ID, ID.unique(), {
        doctorId,
        patientId,
        status: "pending",
        createdAt: new Date().toISOString()
      })
      setSentRequests(prev => ({ ...prev, [doctorId]: "pending" }))
      toast.success("Request sent!")
    } catch (err) {
      console.error(err)
      toast.error("Failed to send request")
    }
  }

  if (!patientId) return <div className="text-center text-gray-600">Loading...</div>

  return (
    <div className="p-6 bg-gradient-to-br from-teal-50 to-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-teal-700 mb-6">Find a Doctor</h1>
      {doctors.map((doc) => {
        const status = sentRequests[doc.userId]
        const isAssigned = assignedDoctorId === doc.userId
        const disableButton = status === "pending" || isAssigned

        return (
          <div
            key={doc.$id}
            className="border border-teal-200 p-4 rounded-lg bg-white shadow-md hover:shadow-lg transition-all duration-300 mb-4"
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="text-teal-800 font-semibold">{doc.name}</p>
                <p className="text-sm text-gray-600">{doc.email}</p>
              </div>
              <Button
                onClick={() => handleSendRequest(doc.userId)}
                disabled={disableButton}
                className={`${disableButton
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-teal-600 text-white hover:bg-teal-700 hover:scale-105"
                  } transition-all duration-300`}
              >
                {isAssigned ? "Assigned" : status === "pending" ? "Sent" : "Request"}
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}