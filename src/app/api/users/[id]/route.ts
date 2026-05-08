import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod/v4";

const updateProfileSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(100).optional(),
  username: z
    .string()
    .min(2, "Usuário precisa de ao menos 2 caracteres")
    .max(50)
    .regex(/^[a-z0-9_]+$/, "Apenas letras minúsculas, números e _")
    .optional(),
  bio: z.string().max(300).nullable().optional(),
  neighborhood: z.string().nullable().optional(),
  theme: z.string().nullable().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createClient();

    const { data: profile, error } = await supabase
      .from("profiles")
      .select(
        `
        *,
        posts(count)
      `
      )
      .eq("id", id)
      .single();

    if (error || !profile) {
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        { status: 404 }
      );
    }

    const formatted = {
      ...profile,
      name: profile.display_name,
      _count: {
        posts: (profile.posts as { count: number }[] | null)?.[0]?.count || 0,
      },
      posts: undefined,
    };

    return NextResponse.json({ user: formatted });
  } catch (error) {
    console.error(`[GET /api/users/${id}]`, error);
    return NextResponse.json(
      { error: "Erro ao buscar perfil" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.id !== id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updateProfileSchema.parse(body);

    const { data: profile, error } = await supabase
      .from("profiles")
      .update({
        display_name: parsed.name,
        bio: parsed.bio ?? undefined,
        neighborhood: parsed.neighborhood ?? undefined,
        theme: parsed.theme ?? undefined,
        username: parsed.username,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({
      user: { ...profile, name: profile.display_name },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    console.error(`[PUT /api/users/${id}]`, error);
    return NextResponse.json(
      { error: "Erro ao atualizar perfil" },
      { status: 500 }
    );
  }
}
