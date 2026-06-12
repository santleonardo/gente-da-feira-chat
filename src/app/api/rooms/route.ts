import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import bcrypt from "bcryptjs";

// ── GET /api/rooms ──────────────────────────────────────────────
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: rooms, error } = await supabase
      .from("rooms")
      .select(`*, room_members(count)`)
      .eq("is_active", true)
      .order("type", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;

    const formatted = (rooms || []).map((r: any) => ({
      ...r,
      password_hash: undefined, // nunca expor o hash
      _count: { members: r.room_members?.[0]?.count || 0 },
      memberCount: r.member_count,
      room_members: undefined,
    }));

    return NextResponse.json({ rooms: formatted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── POST /api/rooms ─────────────────────────────────────────────
// Body: { name, description, icon, max_members, rules, password, is_open }
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const body = await req.json();
    const name        = (body.name || "").trim();
    const description = (body.description || "").trim();
    const icon        = body.icon || "💬";
    const rules       = (body.rules || "").trim() || null;
    const maxMembers  = Math.min(50, Math.max(10, parseInt(body.max_members) || 50));
    const isOpen      = body.is_open !== false; // default true
    const rawPassword = (body.password || "").trim();

    if (!name) return NextResponse.json({ error: "Nome da sala é obrigatório" }, { status: 400 });
    if (name.length > 50) return NextResponse.json({ error: "Nome muito longo" }, { status: 400 });

    // Hash da senha, se fornecida
    let passwordHash: string | null = null;
    if (rawPassword) {
      passwordHash = await bcrypt.hash(rawPassword, 10);
    }

    const slug =
      name.toLowerCase().normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") +
      "-" + Date.now().toString(36);

    const { data: room, error } = await supabase
      .from("rooms")
      .insert({
        name,
        slug,
        icon,
        description: description || null,
        rules,
        type: "community",
        is_active: true,
        is_open: isOpen,
        max_members: maxMembers,
        password_hash: passwordHash,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    // Inserir criador como membro com papel 'creator'
    await supabase.from("room_members").insert({
      room_id: room.id,
      user_id: user.id,
      role: "creator",
    });

    return NextResponse.json({
      room: {
        ...room,
        password_hash: undefined,
        has_password: !!passwordHash,
        memberCount: 1,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
