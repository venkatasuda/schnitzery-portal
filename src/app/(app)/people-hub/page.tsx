import { redirect } from "next/navigation";

// The People hub only linked to Staff, Directory and Notes; those pages now share tabs (Staff | Directory | Notes).
export default function PeopleHub() { redirect("/staff"); }
