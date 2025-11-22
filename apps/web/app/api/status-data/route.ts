import { NextResponse } from "next/server";
import { getClienteStatusCounts } from "@repo/database/src/dashboard/queries";

export async function GET() {
  const data = await getClienteStatusCounts();
  return NextResponse.json(data);
}
