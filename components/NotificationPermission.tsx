"use client"

import { useEffect } from "react"

export default function NotificationPermission() {
  useEffect(() => {
    console.log("NotificationPermission component mounted, current permission:", Notification.permission);
    if (typeof window !== "undefined" && Notification.permission !== "granted") {
      Notification.requestPermission().then((permission) => {
        console.log("Notification permission result:", permission);
        if (permission !== "granted") {
          console.warn("Notification permission denied, retrying in 5 seconds");
          setTimeout(() => {
            if (Notification.permission !== "granted") {
              Notification.requestPermission().catch((err) => {
                console.error("Retry failed for notification permission:", err);
              });
            }
          }, 5000);
        }
      }).catch((err) => {
        console.error("Failed to request notification permission:", err);
      });
    }
  }, []);

  return null;
}