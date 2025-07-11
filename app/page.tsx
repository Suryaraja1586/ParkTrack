import { redirect } from "next/navigation";

// Define the role type as a union of valid roles
type Role = "doctor" | "patient";

export default function HomePage() {
  const role: Role = "patient"; // Type assertion to ensure it’s one of the valid roles
  if (role === "patient") {
    redirect("/dashboard/patient");
  } else if (role === "doctor") {
    redirect("/dashboard/doctor");
  } else {
    redirect("/auth/login");
  }
}