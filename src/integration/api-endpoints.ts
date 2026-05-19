// GET /api/users/search?query=joao
// Retorna: { users: [{ id, username, displayName, avatarUrl }] }

// GET /api/users/resolve?username=joao
// Retorna: { userId: "abc123" } ou { userId: null }

// Exemplo com Prisma:
//
// app/api/users/search/route.ts:
// export async function GET(request: NextRequest) {
//   const query = request.nextUrl.searchParams.get('query')?.toLowerCase();
//   const users = await prisma.user.findMany({
//     where: { OR: [
//       { username: { contains: query, mode: 'insensitive' } },
//       { displayName: { contains: query, mode: 'insensitive' } },
//     ]},
//     select: { id: true, username: true, displayName: true, avatarUrl: true },
//     take: 8,
//   });
//   return NextResponse.json({ users });
// }
//
// app/api/users/resolve/route.ts:
// export async function GET(request: NextRequest) {
//   const username = request.nextUrl.searchParams.get('username')?.toLowerCase();
//   const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
//   return NextResponse.json({ userId: user?.id || null });
// }
