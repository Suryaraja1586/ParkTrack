"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { ID, Query, Models } from "appwrite"
import { databases, storage, client } from "@/lib/appwrite"
import { toast } from "sonner"
import { APPWRITE_CONFIG } from "@/lib/constants"
import { format, toZonedTime } from "date-fns-tz"
import { Bell } from "lucide-react"
import { useRouter, usePathname } from "next/navigation"
import { RealtimeResponse } from "@/types/appwrite"

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
  const [isTyping, setIsTyping] = useState(false)
  const [newMessageCount, setNewMessageCount] = useState(0)
  const [offset, setOffset] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const messageIds = useRef<Set<string>>(new Set())
  const pendingSend = useRef(false)
  const isAtBottom = useRef(true)
  const router = useRouter()
  const pathname = usePathname()

  // Request notification permission on load
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission()
      }
    }
  }, [])

  const scrollToBottom = useCallback(() => {
    if (isAtBottom.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
      console.log("Scrolled to bottom, isAtBottom:", isAtBottom.current)
    }
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem("user")
    if (stored) {
      const parsedUser = JSON.parse(stored)
      if (parsedUser.role !== "patient") {
        toast.error("Access restricted to patients")
        router.push("/auth/login")
      } else {
        setUser(parsedUser)
      }
    } else {
      toast.error("Please log in")
      router.push("/auth/login")
    }
  }, [router])

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
          setIsLoading(false)
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
            Query.orderAsc("timestamp"),
            Query.limit(50),
            Query.offset(offset)
          ]
        )
        const newMessages = messagesRes.documents.filter((msg) => !messageIds.current.has(msg.$id))
        newMessages.forEach((msg) => messageIds.current.add(msg.$id))
        setMessages((prev) => {
          const updatedMessages = [...prev, ...newMessages]
          console.log("Fetched messages for doctor", patient.assignedDoctorId, ":", updatedMessages.map((m) => m.$id))
          return updatedMessages
        })
        setNewMessageCount(0)
        if (isAtBottom.current) {
          scrollToBottom()
        }
      } catch (err) {
        toast.error("Failed to load chat data")
        console.error("Fetch data error:", err)
      } finally {
        setIsLoading(false)
      }
    }

    setMessages([])
    messageIds.current.clear()
    setOffset(0)
    fetchData()
  }, [user?.userId, scrollToBottom])

  useEffect(() => {
    if (!user?.userId || !doctor?.$id) return

    const messageChannel = `databases.${APPWRITE_CONFIG.DATABASE_ID}.collections.${APPWRITE_CONFIG.MESSAGE_COLLECTION_ID}.documents` as const
    const unsubscribeMessages = client.subscribe(messageChannel, (response: RealtimeResponse) => {
      try {
        if (response.events?.includes("databases.*.collections.*.documents.*.create")) {
          const newMessage = response.payload as Message
          console.log("New message received:", newMessage.$id, newMessage, "for doctor:", doctor?.$id)
          
          if (messageIds.current.has(newMessage.$id)) {
            console.log("Duplicate message skipped:", newMessage.$id)
            return
          }
          
          if (newMessage.senderId === user.userId && pendingSend.current) {
            console.log("Skipping message from current user during send:", newMessage.$id)
            return
          }
          
          if (
            (newMessage.senderId === doctor.$id && newMessage.receiverId === user.userId) ||
            (newMessage.senderId === user.userId && newMessage.receiverId === doctor.$id)
          ) {
            messageIds.current.add(newMessage.$id)
            setMessages((prev) => {
              const updatedMessages = [...prev, newMessage].filter(
                (msg) =>
                  (msg.senderId === user.userId && msg.receiverId === doctor.$id) ||
                  (msg.senderId === doctor.$id && msg.receiverId === user.userId)
              )
              console.log("Updated messages for doctor", doctor.$id, ":", updatedMessages.map((m) => m.$id))
              return updatedMessages
            })
            
            if (newMessage.senderId !== user.userId) {
              // Increment notification count for messages from doctor
              setNewMessageCount((prev) => prev + 1)
              console.log("Incremented notification count for doctor message")
              
              if (Notification.permission === "granted") {
                new Notification("New Message from Dr. " + doctor.name, {
                  body: newMessage.message,
                  icon: "/icons/icon-192x192.png"
                })
              }
              const audio = new Audio("/notification.mp3")
              audio.play().catch((err) => console.error("Notification audio error:", err))
            }
            
            if (isAtBottom.current) {
              scrollToBottom()
            }
          } else {
            console.log("Message ignored (wrong doctor):", newMessage.$id, newMessage.senderId, newMessage.receiverId)
          }
        }
      } catch (err) {
        toast.error("Error processing message subscription")
        console.error("Message subscription error:", err)
      }
    })

    const typingChannel = `databases.${APPWRITE_CONFIG.DATABASE_ID}.collections.${APPWRITE_CONFIG.TYPING_COLLECTION_ID || "typing_status"}.documents` as const
    const unsubscribeTyping = client.subscribe(typingChannel, (response: RealtimeResponse) => {
      try {
        if (response.events?.includes("databases.*.collections.*.documents.*.create")) {
          const typingStatus = response.payload as { userId: string; chatId: string; isTyping: boolean }
          if (
            typingStatus.chatId === `${user.userId}-${doctor.$id}` &&
            typingStatus.userId === doctor.$id
          ) {
            setIsTyping(typingStatus.isTyping)
            const typingIndicator = document.getElementById("typingIndicator")
            if (typingIndicator) {
              typingIndicator.classList.toggle("hidden", !typingStatus.isTyping)
            }
          }
        }
      } catch (err) {
        toast.error("Error processing typing subscription")
        console.error("Typing subscription error:", err)
      }
    })

    const chatContainer = chatContainerRef.current
    const handleScroll = () => {
      if (chatContainer) {
        const { scrollTop, scrollHeight, clientHeight } = chatContainer
        isAtBottom.current = scrollTop + clientHeight >= scrollHeight - 10
        console.log("Scroll position, isAtBottom:", isAtBottom.current, { scrollTop, scrollHeight, clientHeight })
        if (scrollTop < 100 && !isLoading) {
          setOffset((prev) => prev + 50)
        }
      }
    }
    chatContainer?.addEventListener("scroll", handleScroll)

    return () => {
      unsubscribeMessages()
      unsubscribeTyping()
      chatContainer?.removeEventListener("scroll", handleScroll)
    }
  }, [user?.userId, doctor?.$id, scrollToBottom, isLoading])

  const sendMessage = async () => {
    if (!user?.userId || !doctor?.$id || (!message.trim() && !file) || isSending) return

    setIsSending(true)
    pendingSend.current = true
    try {
      let fileId: string | undefined
      let fileName: string | undefined

      if (file) {
        const allowedTypes = ["image/jpeg", "image/png", "application/pdf"]
        const maxSize = 5 * 1024 * 1024
        if (!allowedTypes.includes(file.type)) {
          toast.error("Only JPEG, PNG, and PDF files are allowed")
          setIsSending(false)
          pendingSend.current = false
          return
        }
        if (file.size > maxSize) {
          toast.error("File size must be less than 5MB")
          setIsSending(false)
          pendingSend.current = false
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
        receiverId: doctor.$id,
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

      messageIds.current.add(res.$id)
      setMessages((prev) => {
        const updatedMessages = [...prev, res].filter(
          (msg) =>
            (msg.senderId === user.userId && msg.receiverId === doctor.$id) ||
            (msg.senderId === doctor.$id && msg.receiverId === user.userId)
        )
        console.log("Added sent message:", res.$id, updatedMessages.map((m) => m.$id))
        return updatedMessages
      })
      setMessage("")
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
      toast.success("Message sent successfully")
      isAtBottom.current = true
      scrollToBottom()
    } catch (err) {
      toast.error("Failed to send message")
      console.error("Send message error:", err)
    } finally {
      setIsSending(false)
      pendingSend.current = false
    }
  }

  const handleTyping = async () => {
    if (!user?.userId || !doctor?.$id) return
    try {
      await databases.createDocument(
        APPWRITE_CONFIG.DATABASE_ID,
        APPWRITE_CONFIG.TYPING_COLLECTION_ID || "typing_status",
        ID.unique(),
        {
          userId: user.userId,
          chatId: `${user.userId}-${doctor.$id}`,
          isTyping: true,
          timestamp: new Date().toISOString()
        }
      )
      setTimeout(() => {
        databases.createDocument(
          APPWRITE_CONFIG.DATABASE_ID,
          APPWRITE_CONFIG.TYPING_COLLECTION_ID || "typing_status",
          ID.unique(),
          {
            userId: user.userId,
            chatId: `${user.userId}-${doctor.$id}`,
            isTyping: false,
            timestamp: new Date().toISOString()
          }
        ).catch((err) => console.error("Typing status reset error:", err))
      }, 3000)
    } catch (err) {
      console.error("Typing status error:", err)
    }
  }

  const downloadFile = async (fileId: string | undefined, fileName: string | undefined, message: Message) => {
    if (!fileId || !fileName) {
      toast.error("Invalid file data")
      return
    }

    if (!user?.userId || (message.senderId !== user.userId && message.receiverId !== user.userId)) {
      toast.error("You don't have permission to download this file")
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
      console.error("Download file error:", err)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isSending) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearNotifications = () => {
    setNewMessageCount(0)
  }

  if (isLoading) {
    return <p className="p-6 text-center text-gray-600">Loading...</p>
  }

  if (!doctor) {
    return <p className="p-6 text-center text-gray-500">You are not assigned to a doctor yet. Please request one.</p>
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-teal-100 to-gray-100">
      <div className="w-full flex flex-col">
        {/* Chat Header */}
        <div className="bg-white p-4 shadow-md">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-teal-700">
              Chat with {doctor.name}
            </h2>
            {newMessageCount > 0 && (
              <div className="flex items-center">
                <button
                  onClick={clearNotifications}
                  className="flex items-center space-x-1 px-3 py-1 bg-red-100 text-red-700 rounded-full hover:bg-red-200 transition-colors"
                >
                  <Bell className="w-4 h-4 animate-pulse" />
                  <span className="text-sm font-medium">{newMessageCount} new</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 chat-container" ref={chatContainerRef}>
          {isLoading ? (
            <p className="text-gray-500 text-center">Loading messages...</p>
          ) : messages.length === 0 ? (
            <p className="text-gray-500 text-center">No messages yet.</p>
          ) : (
            messages.map((msg, index) => (
              <div
                key={`${msg.$id}-${index}`}
                className={`message mb-3 p-3 rounded-lg max-w-[70%] ${
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
                <p className="text-xs text-gray-500 mt-1">
                  {format(toZonedTime(new Date(msg.timestamp), "America/Chicago"), "PPp z")}
                </p>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Typing Indicator */}
        {isTyping && (
          <div className="text-gray-500 text-sm p-4">
            {doctor.name} is typing...
            <div id="typingIndicator" className="typing-dots inline-block ml-2">
              <span className="inline-block w-1 h-1 bg-gray-400 rounded-full animate-bounce mr-1"></span>
              <span className="inline-block w-1 h-1 bg-gray-400 rounded-full animate-bounce mr-1" style={{animationDelay: '0.1s'}}></span>
              <span className="inline-block w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
            </div>
          </div>
        )}

        {/* Message Input */}
        <div className="p-4 bg-white shadow-md">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value)
                handleTyping()
              }}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              disabled={isSending}
              className="flex-1 p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-teal-800"
              style={{ resize: "none" }}
              onInput={(e) => {
                const target = e.target as HTMLInputElement
                target.style.height = "auto"
                target.style.height = `${Math.min(target.scrollHeight, 120)}px`
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            <button
              onClick={sendMessage}
              disabled={isSending || (!message.trim() && !file)}
              className="p-2 bg-teal-700 text-white rounded-full hover:bg-teal-800 transition-colors disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}