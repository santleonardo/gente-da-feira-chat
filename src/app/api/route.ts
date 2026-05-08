import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    app: "GDF Chat",
    version: "0.3.0",
  });
}
