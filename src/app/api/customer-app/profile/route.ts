import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * @swagger
 * /api/customer-app/profile:
 *   get:
 *     tags:
 *       - Customer Profile
 *     summary: Get Customer Profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile fetched successfully
 *       401:
 *         description: Unauthorized
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded: any = jwt.verify(token, JWT_SECRET);

    if (!decoded.userId || decoded.role !== 'customer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: decoded.userId }
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Exclude password from response
    const { password, ...safeCustomer } = customer;

    return NextResponse.json(safeCustomer);
  } catch (error: any) {
    console.error('Customer Profile Fetch Error:', error);
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }
}

/**
 * @swagger
 * /api/customer-app/profile:
 *   put:
 *     tags:
 *       - Customer Profile
 *     summary: Update Customer Profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               street:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               zip:
 *                 type: string
 *               homeAddress:
 *                 type: string
 *               workAddress:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 *       401:
 *         description: Unauthorized
 */
export async function PUT(request: Request) {
    try {
      const authHeader = request.headers.get('authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
  
      const token = authHeader.split(' ')[1];
      const decoded: any = jwt.verify(token, JWT_SECRET);
  
      const body = await request.json();
      const { firstName, lastName, phone, street, city, state, zip, homeAddress, workAddress } = body;
  
      const updatedCustomer = await prisma.customer.update({
        where: { id: decoded.userId },
        data: {
          firstName,
          lastName,
          phone,
          street,
          city,
          state,
          zip,
          homeAddress,
          workAddress
        }
      });
  
      const { password, ...safeCustomer } = updatedCustomer;
      return NextResponse.json(safeCustomer);
    } catch (error: any) {
      console.error('Customer Profile Update Error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
