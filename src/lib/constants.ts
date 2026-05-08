// ─── Constantes do GDF Chat ───

export const BAIRROS = [
  "Mangabeira", "Campo Limpo", "Cidade Nova", "George Américo", "SIM",
  "Tomba", "Muchila", "Kalilândia", "Centro", "Queimadinha",
  "Gabriela", "Caseb", "Capuchinhos", "Limoeiro", "Papagaio",
] as const;

export function timeAgo(date: Date | string): string {
  const now = Date.now();
  const d = new Date(date).getTime();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  if (hours < 24) return `há ${hours}h`;
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days}d`;
  return new Date(date).toLocaleDateString("pt-BR");
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const COLORS = [
  "bg-rose-500", "bg-amber-500", "bg-emerald-500", "bg-sky-500",
  "bg-violet-500", "bg-pink-500", "bg-teal-500", "bg-orange-500",
  "bg-indigo-500", "bg-lime-500", "bg-cyan-500", "bg-fuchsia-500",
] as const;

export function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}
