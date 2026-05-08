"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { BAIRROS } from "@/lib/constants";
import { toast } from "sonner";
import type { Profile } from "@/lib/types";

interface LoginData {
  email: string;
  password: string;
}

interface RegisterData {
  name: string;
  username: string;
  email: string;
  password: string;
  neighborhood: string;
}

export function AuthForm() {
  const { setProfile } = useStore();
  const supabase = createClient();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);

  const [loginData, setLoginData] = useState<LoginData>({
    email: "",
    password: "",
  });
  const [regData, setRegData] = useState<RegisterData>({
    name: "",
    username: "",
    email: "",
    password: "",
    neighborhood: "",
  });

  const handleLogin = async () => {
    if (!loginData.email || !loginData.password) {
      toast.error("Preencha todos os campos");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      });
      if (error) {
        toast.error(error.message);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();

      if (profile) {
        setProfile(profile as Profile);
        toast.success(`Bem-vindo, ${profile.display_name}!`);
      }
    } catch (err) {
      console.error("[handleLogin]", err);
      toast.error("Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (
      !regData.name ||
      !regData.username ||
      !regData.email ||
      !regData.password
    ) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    if (regData.password.length < 6) {
      toast.error("Senha deve ter ao menos 6 caracteres");
      return;
    }
    if (!/^[a-z0-9_]+$/.test(regData.username)) {
      toast.error("Usuário deve conter apenas letras minúsculas, números e _");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: regData.email,
        password: regData.password,
        options: {
          data: {
            name: regData.name,
            username: regData.username,
            neighborhood: regData.neighborhood,
          },
        },
      });
      if (error) {
        toast.error(error.message);
        return;
      }

      if (data.user) {
        // Atualizar perfil com neighborhood
        await supabase
          .from("profiles")
          .update({
            neighborhood: regData.neighborhood || null,
          })
          .eq("id", data.user.id);

        // Auto-entrar na sala Geral FSA
        const { data: geralRoom } = await supabase
          .from("rooms")
          .select("id")
          .eq("slug", "geral-fsa")
          .single();

          if (geralRoom) {
          try {
            await supabase.from("room_members").insert({
              room_id: geralRoom.id,
              user_id: data.user.id,
            });
          } catch {
            // Ignora erro de duplicata (já é membro)
          }
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .single();

        if (profile) {
          setProfile(profile as Profile);
          toast.success("Conta criada com sucesso!");
        }
      }
    } catch (err) {
      console.error("[handleRegister]", err);
      toast.error("Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-2 border-primary/20">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground">
            G
          </div>
          <CardTitle className="text-2xl font-bold">GDF Chat</CardTitle>
          <p className="text-sm text-muted-foreground">
            A rede social de Feira de Santana
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tab Switcher */}
          <div className="flex rounded-lg bg-muted p-1">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                mode === "login"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => setMode("register")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                mode === "register"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              Criar conta
            </button>
          </div>

          {mode === "login" ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={loginData.email}
                  onChange={(e) =>
                    setLoginData({ ...loginData, email: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-pass">Senha</Label>
                <Input
                  id="login-pass"
                  type="password"
                  placeholder="••••••"
                  value={loginData.password}
                  onChange={(e) =>
                    setLoginData({ ...loginData, password: e.target.value })
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                />
              </div>
              <Button
                onClick={handleLogin}
                disabled={loading}
                className="w-full"
              >
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="reg-name">Nome</Label>
                <Input
                  id="reg-name"
                  placeholder="Seu nome completo"
                  value={regData.name}
                  onChange={(e) =>
                    setRegData({ ...regData, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-username">Usuário</Label>
                <Input
                  id="reg-username"
                  placeholder="seu_usuario"
                  value={regData.username}
                  onChange={(e) =>
                    setRegData({
                      ...regData,
                      username: e.target.value.toLowerCase().replace(/\s/g, ""),
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-email">Email</Label>
                <Input
                  id="reg-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={regData.email}
                  onChange={(e) =>
                    setRegData({ ...regData, email: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-pass">Senha</Label>
                <Input
                  id="reg-pass"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={regData.password}
                  onChange={(e) =>
                    setRegData({ ...regData, password: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-neighborhood">Bairro</Label>
                <select
                  id="reg-neighborhood"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={regData.neighborhood}
                  onChange={(e) =>
                    setRegData({ ...regData, neighborhood: e.target.value })
                  }
                >
                  <option value="">Selecione seu bairro</option>
                  {BAIRROS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                onClick={handleRegister}
                disabled={loading}
                className="w-full"
              >
                {loading ? "Criando conta..." : "Criar conta"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
