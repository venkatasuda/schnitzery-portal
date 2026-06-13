"use client";

import { useEffect, useRef } from "react";
import { flushQueue } from "@/lib/offline/sync";
import { readQueue } from "@/lib/offline/attendanceQueue";

// Mounted once in the app layout. Renders nothing. Drains the offline
// attendance queue automatically: on app load, the moment the browser comes
// back online, and on a short retry timer while anything is still pending
// (so a flaky connection eventually clears it). Never gives up — attendance
// is never dropped.
export default function AttendanceSync() {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function startTimer() {
      if (timer.current) return;
      timer.current = setInterval(() => {
        if (readQueue().length === 0) { stopTimer(); return; }
        flushQueue();
      }, 15000);
    }
    function stopTimer() {
      if (timer.current) { clearInterval(timer.current); timer.current = null; }
    }

    // initial drain
    flushQueue().then(() => { if (readQueue().length) startTimer(); });

    const onOnline = () => { flushQueue(); };
    const onChange = () => { if (readQueue().length) startTimer(); };
    window.addEventListener("online", onOnline);
    window.addEventListener("sz-queue-changed", onChange);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("sz-queue-changed", onChange);
      stopTimer();
    };
  }, []);

  return null;
}