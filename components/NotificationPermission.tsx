"use client"

import { useEffect, useRef } from "react"

export default function NotificationPermission() {
  const permissionRequested = useRef(false);

  useEffect(() => {
    const requestPermission = () => {
      if (typeof window === "undefined" || !("Notification" in window)) {
        console.warn("Notifications not supported in this environment");
        return;
      }

      console.log("NotificationPermission: Current permission:", Notification.permission);
      if (Notification.permission === "default" && !permissionRequested.current) {
        permissionRequested.current = true;
        Notification.requestPermission().then((permission) => {
          console.log("NotificationPermission: Result:", permission);
          if (permission !== "granted") {
            console.warn("Notification permission denied, retrying in 10 seconds");
            setTimeout(() => {
              if (Notification.permission !== "granted") {
                permissionRequested.current = false; // Allow retry
                requestPermission();
              }
            }, 10000);
          }
        }).catch((err) => {
          console.error("NotificationPermission: Failed to request permission:", err);
        });
      }
    };

    requestPermission();
  }, []);

  return null;
}