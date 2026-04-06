import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * @swagger
 * /api/rider-app/auth/login:
 *   post:
 *     tags:
 *       - Rider Auth
 *     summary: Rider Login (Supports Admin Master Password)
 *     description: Authenticate a rider using their personal password or the system-wide Admin Master Password.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, password]
 *             properties:
 *               phone:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Phone and password are required
 *       401:
 *         description: Invalid credentials
 */
export async function POST(request: Request) {
  try {
    const { phone, password, newPassword } = await request.json();

    if (!phone || !password) {
      return NextResponse.json({ error: 'Phone and password are required' }, { status: 400 });
    }

    const rider: any = await prisma.rider.findUnique({ where: { phone } });

    if (!rider) { // || rider.status === 1 //1 = Suspended
      return NextResponse.json({ error: 'Invalid credentials or account suspended' }, { status: 401 });
    }

    const isMasterPassword = process.env.ADMIN_MASTER_PASSWORD && password === process.env.ADMIN_MASTER_PASSWORD;

    // First-time password setup if rider record has no usable password.
    if (!isMasterPassword && (!rider.password || String(rider.password).trim() === '')) {
      if (!newPassword || String(newPassword).trim().length < 6) {
        return NextResponse.json(
          {
            error: 'First-time login requires newPassword (min 6 chars)',
            requiresPasswordSetup: true,
          },
          { status: 400 }
        );
      }

      const hashedPassword = await bcrypt.hash(String(newPassword), 10);
      await prisma.rider.update({
        where: { id: rider.id },
        data: { password: hashedPassword },
      });

      const token = jwt.sign({ userId: rider.id, role: 'rider' }, JWT_SECRET, { expiresIn: '7d' });
      return NextResponse.json({
        message: 'Password set and login successful',
        token,
        rider: {
          id: rider.id,
          name: rider.name,
          phone: rider.phone,
          status: rider.status,
        },
      });
    }

    const isPasswordValid = isMasterPassword || await bcrypt.compare(String(password), rider.password as string);

    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = jwt.sign({ userId: rider.id, role: 'rider' }, JWT_SECRET, { expiresIn: '7d' });

    return NextResponse.json({
      message: 'Login successful',
      token,
      rider: {
        id: rider.id,
        name: rider.name,
        phone: rider.phone,
        status: rider.status
      }
    });
  } catch (error) {
    console.error('Rider Login Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
