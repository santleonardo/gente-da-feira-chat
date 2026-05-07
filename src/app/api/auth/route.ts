import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";

// GET — verificar sessão e retornar profile
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ user: null });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    return NextResponse.json({ user: profile });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — login com email/senha (delegate para Supabase Auth via client)
export async function POST() {
  return NextResponse.json({ error: "Use Supabase client auth" }, { status: 400 });
}

// DELETE — logout
export async function DELETE() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
