import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET — verificar sessão e retornar profile
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ user: null });
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) throw error;
    return NextResponse.json({ user: profile });
  } catch (error) {
    console.error("[GET /api/auth]", error);
    return NextResponse.json(
      { error: "Erro ao verificar sessão" },
      { status: 500 }
    );
  }
}

// POST — login: delegar para Supabase client auth
export async function POST() {
  return NextResponse.json(
    { error: "Use Supabase client auth (signInWithPassword)" },
    { status: 400 }
  );
}

// DELETE — logout
export async function DELETE() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/auth]", error);
    return NextResponse.json({ error: "Erro ao sair" }, { status: 500 });
  }
}
