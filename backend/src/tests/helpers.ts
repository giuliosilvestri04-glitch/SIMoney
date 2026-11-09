import type { FastifyInstance } from 'fastify';
import { buildApp, API_PREFIX } from '../app.js';
import { prisma } from '../lib/prisma.js';

/** Utilità condivise dai test: avvio dell'app in-process e login rapidi. */

export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo1234!';

let app: FastifyInstance | null = null;

export async function getApp(): Promise<FastifyInstance> {
  if (!app) {
    app = await buildApp();
    await app.ready();
  }
  return app;
}

export async function closeApp(): Promise<void> {
  if (app) {
    await app.close();
    app = null;
  }
  await prisma.$disconnect();
}

export function url(path: string): string {
  return `${API_PREFIX}${path}`;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  userId: string;
  role: string;
  headers: { authorization: string };
}

export async function loginAs(email: string, password = DEMO_PASSWORD): Promise<Session> {
  const instance = await getApp();
  const response = await instance.inject({
    method: 'POST',
    url: url('/auth/login'),
    payload: { email, password },
  });

  if (response.statusCode !== 200) {
    throw new Error(`Login fallito per ${email}: ${response.statusCode} ${response.body}`);
  }

  const body = response.json().data;
  return {
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
    userId: body.user.id,
    role: body.user.role,
    headers: { authorization: `Bearer ${body.accessToken}` },
  };
}

/** Email degli account demo generati dal seed (primo cliente, primo consulente, boss). */
export async function demoEmails() {
  const [client, advisor, admin] = await Promise.all([
    prisma.user.findFirstOrThrow({ where: { role: 'CLIENT' }, orderBy: { id: 'asc' } }),
    prisma.user.findFirstOrThrow({ where: { role: 'ADVISOR' }, orderBy: { id: 'asc' } }),
    prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } }),
  ]);
  return { client: client.email, advisor: advisor.email, admin: admin.email };
}

export async function get(path: string, session?: Session) {
  const instance = await getApp();
  return instance.inject({
    method: 'GET',
    url: url(path),
    headers: session?.headers,
  });
}

export async function post(path: string, payload: unknown, session?: Session) {
  const instance = await getApp();
  return instance.inject({
    method: 'POST',
    url: url(path),
    headers: session?.headers,
    payload: payload as never,
  });
}
