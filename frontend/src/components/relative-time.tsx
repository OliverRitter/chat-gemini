"use client";

import { useEffect, useState } from "react";

export function RelativeTime({ timestamp }: { timestamp: string }) {
  // 1. Maintain the relative text string in a dynamic local state slot
  const [displayText, setDisplayText] = useState("");

  useEffect(() => {
    function calculateRelativeTime() {
      if (!timestamp) return;

      const messageDate = new Date(timestamp);
      const messageTime = messageDate.getTime();
      const now = new Date().getTime();
      const differenceInSeconds = Math.floor((now - messageTime) / 1000);

      // 1. Less than 5 seconds ago
      if (differenceInSeconds < 5) {
        setDisplayText("Just now");
        return;
      }

      // 2. Less than a minute ago
      if (differenceInSeconds < 60) {
        setDisplayText(`${differenceInSeconds} seconds ago`);
      }
      // 3. Less than an hour ago
      else if (differenceInSeconds < 3600) {
        const minutes = Math.floor(differenceInSeconds / 60);
        setDisplayText(
          `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`,
        );
      }
      // 4. Less than a day ago
      else if (differenceInSeconds < 86400) {
        const hours = Math.floor(differenceInSeconds / 3600);
        setDisplayText(`${hours} ${hours === 1 ? "hour" : "hours"} ago`);
      }
      // 5. Less than a week ago (Up to 6 days)
      else if (differenceInSeconds < 604800) {
        const days = Math.floor(differenceInSeconds / 86400);
        setDisplayText(`${days} ${days === 1 ? "day" : "days"} ago`);
      }
      // 🟩 6. THE CALENDAR SWITCH SWITCH HANDLER!
      // If the message is older than 7 days, drop relative calculations entirely
      // and display a clean, static historical calendar stamp!
      else {
        // Formats to: "Oct 24" or "Jan 5"
        const formattedDate = messageDate.toLocaleDateString([], {
          month: "short",
          day: "numeric",
        });

        // Optional Premium Add-on: If it's a completely different year, add the year number too!
        // Formats to: "Oct 24, 2025"
        const currentYear = new Date().getFullYear();
        if (messageDate.getFullYear() !== currentYear) {
          setDisplayText(`${formattedDate}, ${messageDate.getFullYear()}`);
        } else {
          setDisplayText(formattedDate);
        }
      }
    }

    // 2. Run the calculation instantly when the component mounts
    calculateRelativeTime();

    // 3. 🚀 THE TIME ENGINE: Set up a background heartbeat timer interval
    // to recalculate the string text every 10 seconds automatically!
    const heartbeatTimer = setInterval(calculateRelativeTime, 10000);

    // 4. Teardown interval safely if the message unmounts to prevent memory leaks
    return () => clearInterval(heartbeatTimer);
  }, [timestamp]);

  return <span className="text-[10px]">{displayText}</span>;
}
