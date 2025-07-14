
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

export default function PatientChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [message, setMessage] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [user, setUser] = useState<{ userId: string; role: string } | null>(null)
  const [doctor, setDoctor] = useState<User | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [newMessageAlert, setNewMessageAlert] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastMessageRef = useRef<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem("user")
    if (stored) {
      setUser(JSON.parse(stored))
    } else {
      toast.error("User not found. Please log in.")
    }
  }, [])

  useEffect(() => {
    if (!user?.userId) return

    const fetchData = async () => {
      try {
        setIsLoading(true)
        const patientRes = await databases.listDocuments<User>(
          APPWRITE_CONFIG.DATABASE_ID,
          APPWRITE_CONFIG.USERS_COLLECTION_ID,
          [Query.equal("userId", user.userId)]
        )
        const patient = patientRes.documents[0]
        if (!patient.assignedDoctorId) {
          toast.info("You are not assigned to a doctor yet.")
          return
        }

        const doctorRes = await databases.listDocuments<User>(
          APPWRITE_CONFIG.DATABASE_ID,
          APPWRITE_CONFIG.USERS_COLLECTION_ID,
          [Query.equal("userId", patient.assignedDoctorId)]
        )
        setDoctor(doctorRes.documents[0])

        const messagesRes = await databases.listDocuments<Message>(
          APPWRITE_CONFIG.DATABASE_ID,
          APPWRITE_CONFIG.MESSAGE_COLLECTION_ID,
          [
            Query.or([
              Query.and([Query.equal("senderId", user.userId), Query.equal("receiverId", patient.assignedDoctorId)]),
              Query.and([Query.equal("senderId", patient.assignedDoctorId), Query.equal("receiverId", user.userId)])
            ]),
            Query.orderAsc("timestamp")
          ]
        )
        const newMessages = messagesRes.documents
        setMessages(newMessages)
        const lastMessageId = newMessages.length > 0 ? newMessages[newMessages.length - 1].$id : null
        if (lastMessageId && lastMessageId !== lastMessageRef.current) {
          setNewMessageAlert(true)
          lastMessageRef.current = lastMessageId
        }
      } catch (err) {
        toast.error("Failed to load chat data")
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [user])

  const sendMessage = async () => {
    if (!user?.userId || !doctor?.$id || (!message.trim() && !file) || isSending) return

    setIsSending(true)
    let tempMessage: Message | null = null // Declare tempMessage outside try block

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

      tempMessage = {
        $id: ID.unique(),
        senderId: user.userId,
        receiverId: doctor.$id,
        message: message.trim() || (file ? `File shared` : ""),
        timestamp: new Date().toISOString(),
        fileId,
        fileName
      } as Message

      setMessages((prev) => [...prev, tempMessage as Message])

      const newMessage: {
        senderId: string
        receiverId: string
        message: string
        timestamp: string
        fileId?: string
        fileName?: string
      } = {
        senderId: user.userId,
        receiverId: doctor.$id,
        message: message.trim() || (file ? `File shared` : ""),
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

      setMessages((prev) => prev.map((msg) => (msg.$id === tempMessage!.$id ? res : msg)))
      setMessage("")
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
      toast.success("Message sent successfully")
    } catch (err) {
      toast.error("Failed to send message")
      console.error(err)
      if (tempMessage) {
        setMessages((prev) => prev.filter((msg) => msg.$id !== tempMessage!.$id))
      }
    } finally {
      setIsSending(false)
    }
  }

  const downloadFile = async (fileId: string | undefined, fileName: string | undefined, message: Message) => {
    if (!fileId || !fileName) {
      toast.error("Invalid file data")
      return
    }

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

  if (isLoading) {
    return <p className="p-6 text-center text-gray-600">Loading...</p>
  }

  if (!doctor) {
    return <p className="p-6 text-center text-gray-500">You are not assigned to a doctor yet. Please request one.</p>
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-teal-100 to-gray-100">
      {/* Chat Area */}
      <div className="w-full flex flex-col">
        <div className="bg-white p-4 shadow-md">
          <div className="flex items-center">
            <h2 className="text-xl font-bold text-teal-700">
              Chat with {doctor.name}
            </h2>
            {newMessageAlert}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {messages.length === 0 ? (
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
                        downloadFile(msg.fileId, msg.fileName, msg)
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
              disabled={isSending}
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
              disabled={isSending}
              className="hidden"
            />
            <button
              onClick={(e) => {
                e.stopPropagation()
                fileInputRef.current?.click()
              }}
              disabled={isSending}
              className="p-2 text-teal-700 hover:text-teal-800 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>
            <button
              onClick={sendMessage}
              disabled={isSending}
              className="p-2 bg-teal-700 text-white rounded-full hover:bg-teal-800 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
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
