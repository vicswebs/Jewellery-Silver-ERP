import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users, roles } from '../db/schema.js';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = loginSchema.parse(req.body);

    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        passwordHash: users.passwordHash,
        fullName: users.fullName,
        roleId: users.roleId,
        status: users.status,
        roleName: roles.name,
        permissions: roles.permissions,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.username, username))
      .limit(1);

    if (!user || user.status !== 'active') {
      throw new AppError('Invalid username or password', 401);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new AppError('Invalid username or password', 401);
    }

    const payload = {
      id: user.id,
      username: user.username,
      roleId: user.roleId,
      roleName: user.roleName || 'User',
      permissions: (user.permissions as string[]) || [],
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'fallback-secret', {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    // Update last login
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          role: user.roleName,
          permissions: payload.permissions,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        email: users.email,
        mobile: users.mobile,
        roleId: users.roleId,
        roleName: roles.name,
        permissions: roles.permissions,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, req.user!.id))
      .limit(1);

    if (!user) throw new AppError('User not found', 404);

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        mobile: user.mobile,
        role: user.roleName,
        permissions: user.permissions,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both passwords required' });
    }
    if (String(newPassword).length < 4) {
      return res.status(400).json({ success: false, message: 'New password too short' });
    }
    const userId = (req as any).user?.id;
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const ok = await bcrypt.compare(String(currentPassword), user.passwordHash || user.password);
    if (!ok) return res.status(400).json({ success: false, message: 'Current password wrong' });

    const hash = await bcrypt.hash(String(newPassword), 10);
    await db.update(users).set({ passwordHash: hash /* or password: hash */ } as any).where(eq(users.id, userId));

    res.json({ success: true, message: 'Password updated' });
  } catch (err) {
    next(err);
  }
});

export default router;
