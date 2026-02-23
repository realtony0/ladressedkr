import { redirect } from "next/navigation";

import { requireRouteRoles } from "@/lib/helpers/server-route-auth";

export default async function ServeurPage() {
  await requireRouteRoles(["cuisine", "admin", "proprio"]);
  redirect("/cuisine");
}
