"use client"

import { useEffect, useState, useRef } from "react"
import { ID, Query, Models } from "appwrite"
import { databases, storage } from "@/lib/appwrite"
import { toast } from "sonner"
import { APPWRITE_CONFIG } from "@/lib/constants"
import { format } from "date-fns"
import { Bell } from "lucide-react"

interface Message extends Models.Document {
  senderId: string
  receiverId: string
  message: string
  timestamp: string
  fileId?: string
  fileName?: string
}

interface User extends Models.Document {
  userId: string
  name: string
  role: "doctor" | "patient"
  assignedDoctorId?: string | null
}

export default function DoctorChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [message, setMessage] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [patients, setPatients] = useState<User[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>(undefined)
  const [user, setUser] = useState<User | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [newMessageAlert, setNewMessageAlert] = useState<{ [key: string]: boolean }>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastMessageRef = useRef<string | null>(null)

  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (userData) {
      setUser(JSON.parse(userData))
    } else {
      toast.error("User not found. Please log in.")
    }
  }, [])

  useEffect(() => {
    if (!user?.userId) return

    const fetchPatients = async () => {
      try {
        const res = await databases.listDocuments<User>(
          APPWRITE_CONFIG.DATABASE_ID,
          APPWRITE_CONFIG.USERS_COLLECTION_ID,
          [Query.equal("assignedDoctorId", user.userId)]
        )
        setPatients(res.documents)
        if (res.documents.length > 0 && !selectedPatientId) {
          setSelectedPatientId(res.documents[0].$id)
        } else if (res.documents.length === 0) {
          toast.info("No patients assigned yet.")
        }
      } catch (err) {
        toast.error("Failed to fetch patients")
        console.error(err)
      }
    }

    fetchPatients()
  }, [user, selectedPatientId])

  useEffect(() => {
    if (!user?.userId || !selectedPatientId) return

    const fetchMessages = async () => {
      try {
        const res = await databases.listDocuments<Message>(
          APPWRITE_CONFIG.DATABASE_ID,
          APPWRITE_CONFIG.MESSAGE_COLLECTION_ID,
          [
            Query.or([
              Query.and([Query.equal("senderId", user.userId), Query.equal("receiverId", selectedPatientId)]),
              Query.and([Query.equal("senderId", selectedPatientId), Query.equal("receiverId", user.userId)])
            ]),
            Query.orderAsc("timestamp")
          ]
        )
        const newMessages = res.documents
        setMessages(newMessages)
        const lastMessageId = newMessages.length > 0 ? newMessages[newMessages.length - 1].$id : null
        if (lastMessageId && lastMessageId !== lastMessageRef.current) {
          setNewMessageAlert((prev) => ({ ...prev, [selectedPatientId]: true }))
          lastMessageRef.current = lastMessageId
        }
      } catch (err) {
        toast.error("Failed to fetch messages")
        console.error(err)
      }
    }

    fetchMessages()
  }, [user, selectedPatientId])

  const sendMessage = async () => {
    if (!user?.userId || !selectedPatientId || (!message.trim() && !file) || isSending) return

    setIsSending(true)
    try {
      let fileId: string | undefined
      let fileName: string | undefined

      if (file) {
        const allowedTypes = ["image/jpeg", "image/png", "application/pdf"]
        const maxSize = 5 * 1024 * 1024
        if (!allowedTypes.includes(file.type)) {
          toast.error("Only JPEG, PNG, and PDF files are allowed")
          setIsSending(false)
          return
        }
        if (file.size > maxSize) {
          toast.error("File size must be less than 5MB")
          setIsSending(false)
          return
        }

        const fileRes = await storage.createFile(
          APPWRITE_CONFIG.STORAGE_BUCKET_ID,
          ID.unique(),
          file,
          ["read(\"users\")", "write(\"users\")"]
        )
        fileId = fileRes.$id
        fileName = file.name
      }

      const newMessage: {
        senderId: string
        receiverId: string
        message: string
        timestamp: string
        fileId?: string
        fileName?: string
      } = {
        senderId: user.userId,
        receiverId: selectedPatientId,
        message: message.trim() || (file ? `File shared: ${file.name}` : ""),
        timestamp: new Date().toISOString()
      }

      if (fileId) newMessage.fileId = fileId
      if (fileName) newMessage.fileName = fileName

      const res = await databases.createDocument<Message>(
        APPWRITE_CONFIG.DATABASE_ID,
        APPWRITE_CONFIG.MESSAGE_COLLECTION_ID,
        ID.unique(),
        newMessage
      )

      setMessages((prev) => [...prev, res])
      setMessage("")
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
      toast.success("Message sent successfully")
    } catch (err) {
      toast.error("Failed to send message")
      console.error(err)
    } finally {
      setIsSending(false)
    }
  }

  const downloadFile = async (fileId: string, fileName: string, message: Message) => {
    if (!user?.userId || (message.senderId !== user.userId && message.receiverId !== user.userId)) {
      toast.error("You don’t have permission to download this file")
      return
    }

    try {
      const url = storage.getFileDownload(APPWRITE_CONFIG.STORAGE_BUCKET_ID, fileId)
      const link = document.createElement("a")
      link.href = url
      link.download = fileName
      link.click()
      toast.success("File downloaded successfully")
    } catch (err) {
      toast.error("Failed to download file")
      console.error(err)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isSending) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className ="flex h-screen bg-gradient-to-br from-teal-100 to-gray-100">
      {/* Patient List (Sidebar) */}
      <div className="w-1/4 bg-white shadow-md p-4 overflow-y-auto hidden md:block">
        <h2 className="text-xl font-bold text-teal-700 mb-4">Patients</h2>
        {patients.length === 0 ? (
          <p className="text-gray-500">No patients assigned yet.</p>
        ) : (
          patients.map((patient) => (
            <div
              key={patient.$id}
              onClick={() => {
                setSelectedPatientId(patient.$id)
                setNewMessageAlert((prev) => ({ ...prev, [patient.$id]: false }))
              }}
              className={`p-2 rounded-lg cursor-pointer hover:bg-teal-100 transition-all duration-200 ${
                selectedPatientId === patient.$id ? "bg-teal-200" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-teal-800">{patient.name}</p>
                {newMessageAlert[patient.$id] && <Bell className="w-4 h-4 text-red-500 animate-pulse" />}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Chat Area */}
      <div className="w-full md:w-3/4 flex flex-col">
        <div className="bg-white p-4 shadow-md">
          <h2 className="text-xl font-bold text-teal-700">
            {patients.find((p) => p.$id === selectedPatientId)?.name || "Select a Patient"}
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {selectedPatientId ? (
            messages.length === 0 ? (
              <p className="text-gray-500 text-center">No messages yet.</p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.$id}
                  className={`mb-3 p-3 rounded-lg max-w-[70%] ${
                    msg.senderId === user?.userId ? "bg-teal-200 ml-auto text-right" : "bg-white"
                  } transition-all duration-200`}
                  style={{ minHeight: "40px", maxHeight: "200px", overflowY: "auto", whiteSpace: "pre-wrap" }}
                >
                  <p className="text-teal-800">{msg.message}</p>
                  {msg.fileId && msg.fileName && (
                    <div className="mt-2">
                      <a
                        href={storage.getFileDownload(APPWRITE_CONFIG.STORAGE_BUCKET_ID, msg.fileId).toString()}
                        download={msg.fileName || "Unnamed File"}
                        onClick={(e) => {
                          e.preventDefault()
                          downloadFile(msg.fileId as string, msg.fileName || "Unnamed File", msg)
                        }}
                        className="text-teal-600 font-semibold hover:text-teal-800 transition-colors"
                      >
                        Download
                      </a>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">{format(new Date(msg.timestamp), "PPp")}</p>
                </div>
              ))
            )
          ) : (
            <p className="text-gray-500 text-center">Select a patient to start chatting.</p>
          )}
        </div>
        <div className="p-4 bg-white shadow-md">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              disabled={!selectedPatientId || isSending}
              className="flex-1 p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-teal-800"
              onInput={(e) => {
                const target = e.target as HTMLInputElement
                target.style.height = "auto"
                target.style.height = `${target.scrollHeight}px`
              }}
            />
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) setFile(file)
              }}
              accept="image/jpeg,image/png,application/pdf"
              disabled={!selectedPatientId || isSending}
              className="hidden"
            />
            <button
              onClick={(e) => {
                e.stopPropagation()
                fileInputRef.current?.click()
              }}
              disabled={!selectedPatientId || isSending}
              className="p-2 text-teal-700 hover:text-teal-800 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>
            <button
              onClick={sendMessage}
              disabled={!selectedPatientId || isSending}
              className="p-2 bg-teal-700 text-white rounded-full hover:bg-teal-800 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </button>
            <div id="typingIndicator" className="typing-dots hidden">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}