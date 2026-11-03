import { redirect } from "next/navigation";

// Old link: this page was a copy of the time-off form under a "Sign timesheet" label.
// Staff sign-off of monthly hours is not built yet; send people to their hours instead.
export default function TimesheetRedirect() {
  redirect("/hours");
}
