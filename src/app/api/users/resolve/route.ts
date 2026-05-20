import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username");

    if (!username) {
      return NextResponse.json({ userId: null });
    }

    const sanitized = username.replace(/[^\w]/g, "").slice(0, 50);

    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", sanitized)
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ userId: data?.id || null });
  } catch (error: any) {
    return NextResponse.json({ userId: null });
  }
}
