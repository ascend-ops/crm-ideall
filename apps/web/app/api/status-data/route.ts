import { NextResponse } from "next/server";
import { getClienteStatusCounts } from "@repo/database/src/dashboard/queries";
import { createServerClient } from "../../../lib/supabase/server";
import { db } from "@repo/database";

export async function GET() {
  const supabase = await createServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get profile from database
  const profile = await db.profile.findFirst({
    where: { id: session.user.id },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const data = await getClienteStatusCounts(profile.id, profile.tenantId, profile.role);
  return NextResponse.json(data);
}
