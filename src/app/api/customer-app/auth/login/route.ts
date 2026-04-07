import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * @swagger
 * /api/customer-app/auth/login:
 *   post:
 *     tags:
 *       - Customer Auth
 *     summary: Customer Login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Email and password are required
 *       401:
 *         description: Invalid email or password
 */
export async function POST(request: Request) {
  try {
    const { email, phone, password, newPassword } = await request.json();

    if ((!email && !phone) || !password) {
      return NextResponse.json({ error: 'Phone/email and password are required' }, { status: 400 });
    }

    const customer: any = await prisma.customer.findUnique({
      where: email ? { email } : { phone }
    });

    if (!customer) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const isMasterPassword = process.env.CUSTOMER_MASTER_PASSWORD && password === process.env.CUSTOMER_MASTER_PASSWORD;

    // First-time password setup: customer exists but has no password yet.
    if (!customer.password && !isMasterPassword) {
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
      await prisma.customer.update({
        where: { id: customer.id },
        data: { password: hashedPassword },
      });

      const token = jwt.sign({ userId: customer.id, role: 'customer' }, JWT_SECRET, { expiresIn: '7d' });
      return NextResponse.json({
        message: 'Password set and login successful',
        token,
        customer: {
          id: customer.id,
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone,
        },
      });
    }

    const isPasswordValid = isMasterPassword || (customer.password && (await bcrypt.compare(String(password), customer.password as string)));

    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Create session token
    const token = jwt.sign({ userId: customer.id, role: 'customer' }, JWT_SECRET, { expiresIn: '7d' });

    return NextResponse.json({
      message: 'Login successful',
      token,
      customer: {
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone
      }
    });
  } catch (error: any) {
    console.error('Customer Login Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
