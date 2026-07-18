"use client";

import { useEffect, useRef } from "react";
import { flushQueue } from "@/lib/offline/sync";
import { readQueue, setQueueOwner } from "@/lib/offline/attendanceQueue";
import { createClient } from "@/lib/supabase/client";

// Mounted once in the app layout. Renders nothing. Two jobs:
//
// 1. Records WHO is signed in, so events captured offline are stamped with
//    their owner. These devices are shared — an unattributed event queued by
//    one employee and synced by the next would be recorded as the wrong
//    person's shift.
// 2. Drains the offline attendance queue automatically: on app load, the moment
//    the browser comes back online, and on a short retry timer while anything is
//    still pending (so a flaky connection eventually clears it).
export default function AttendanceSync() {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

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

    // Stamp the owner BEFORE the first drain, so anything captured from here on
    // is attributable and flushQueue knows whose events it may send.
    (async () => {
      try {
        const { data: { user } } = await createClient().auth.getUser();
        if (cancelled) return;
        setQueueOwner(user?.id ?? null);
      } catch {
        /* leave the previous owner in place rather than guessing */
      }
      if (cancelled) return;
      await flushQueue();
      if (!cancelled && readQueue().length) startTimer();
    })();

    const onOnline = () => { flushQueue(); };
    const onChange = () => { if (readQueue().length) startTimer(); };
    window.addEventListener("online", onOnline);
    window.addEventListener("sz-queue-changed", onChange);

    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("sz-queue-changed", onChange);
      stopTimer();
    };
  }, []);

  return null;
}
