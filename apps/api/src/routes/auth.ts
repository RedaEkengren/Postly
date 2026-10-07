import crypto from 'node:crypto';
import { Hono } from 'hono';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import bcrypt from 'bcrypt';
import { eq, and, gt, users, tenants, tenantMembers, sessions } from '@postly/db';
import { getDb } from '../lib/db.js';
import { ApiError } from '../lib/errors.js';
import { env } from '../env.js';

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const COOKIE_NAME = 'postly_session';

const auth = new Hono();

auth.post('/signup', async (c) => {
  const { email, password, orgName } = await c.req.json<{
    email: string;
    password: string;
    orgName: string;
  }>();

  if (!email || !password || !orgName) {
    throw new ApiError(400, 'validation_error', 'Validation error', 'email, password, and orgName are required');
  }
  if (password.length < 8) {
    throw new ApiError(400, 'validation_error', 'Validation error', 'Password must be at least 8 characters');
  }

  const db = getDb();

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing.length > 0) {
    throw new ApiError(409, 'conflict', 'Email taken', 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [tenant] = await db.insert(tenants).values({ name: orgName }).returning({ id: tenants.id }) as [{ id: string }];
  const [user] = await db.insert(users).values({ email, passwordHash }).returning({ id: users.id }) as [{ id: string }];
  await db.insert(tenantMembers).values({ tenantId: tenant.id, userId: user.id, role: 'owner' });

  const sessionId = crypto.randomBytes(32).toString('hex');
  await db.insert(sessions).values({
    id: sessionId,
    userId: user.id,
    tenantId: tenant.id,
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
  });

  setCookie(c, COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DURATION_MS / 1000,
  });

  return c.json({ ok: true });
});

auth.post('/login', async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>();

  if (!email || !password) {
    throw new ApiError(400, 'validation_error', 'Validation error', 'email and password are required');
  }

  const db = getDb();

  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user || !user.passwordHash) {
    throw new ApiError(401, 'unauthorized', 'Invalid credentials', 'Wrong email or password');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new ApiError(401, 'unauthorized', 'Invalid credentials', 'Wrong email or password');
  }

  const [membership] = await db.select().from(tenantMembers).where(eq(tenantMembers.userId, user.id));
  if (!membership) {
    throw new ApiError(403, 'forbidden', 'No workspace', 'User is not a member of any workspace');
  }

  const sessionId = crypto.randomBytes(32).toString('hex');
  await db.insert(sessions).values({
    id: sessionId,
    userId: user.id,
    tenantId: membership.tenantId,
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
  });

  setCookie(c, COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DURATION_MS / 1000,
  });

  return c.json({ ok: true });
});

auth.get('/session', async (c) => {
  const sessionId = getCookie(c, COOKIE_NAME);
  if (!sessionId) {
    return c.json({ authenticated: false }, 401);
  }

  const db = getDb();
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())));

  if (!session) {
    deleteCookie(c, COOKIE_NAME, { path: '/' });
    return c.json({ authenticated: false }, 401);
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.userId));
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, session.tenantId));
  const [membership] = await db
    .select()
    .from(tenantMembers)
    .where(and(eq(tenantMembers.userId, session.userId), eq(tenantMembers.tenantId, session.tenantId)));

  if (!user || !tenant) {
    deleteCookie(c, COOKIE_NAME, { path: '/' });
    return c.json({ authenticated: false }, 401);
  }

  return c.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
    },
    tenant: {
      id: tenant.id,
      name: tenant.name,
      plan: tenant.plan,
    },
    role: membership?.role ?? 'member',
  });
});

auth.post('/logout', async (c) => {
  const sessionId = getCookie(c, COOKIE_NAME);
  if (sessionId) {
    const db = getDb();
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    deleteCookie(c, COOKIE_NAME, { path: '/' });
  }
  return c.json({ ok: true });
});

export { auth as authRoutes };
