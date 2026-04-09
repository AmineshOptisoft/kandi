import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * @swagger
 * /api/rider-app/ride/arrive:
 *   post:
 *     tags:
 *       - Rider Actions
 *     summary: "[STEP 2] Mark rider as arrived at pickup"
 *     description: |
 *       ## 📱 USE THIS FOR: Orders Tab — Step 2
 *
 *       **Rider has reached the customer's pickup location.** Call this API when rider taps "I've Arrived" button.
 *
 *       ### How to use:
 *       - Show an "I've Arrived" button on the active order screen
 *       - When rider taps it, call this API with `orderId` and `riderId`
 *
 *       ### What happens after this:
 *       - Order status changes to `2` (Arrived)
 *       - Customer is notified that rider has arrived
 *
 *       ### Next Step:
 *       Show OTP input screen to rider. When rider enters customer's OTP, call **POST /api/rider-app/ride/start**
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId, riderId]
 *             properties:
 *               orderId:
 *                 type: integer
 *                 description: Active order ID (from accept response)
 *                 example: 1
 *               riderId:
 *                 type: integer
 *                 description: Logged-in rider's ID
 *                 example: 1
 *     responses:
 *       200:
 *         description: Rider marked as arrived at pickup location
 */
import { ORDER_STATUS } from '@/lib/constants';

export async function POST(request: Request) {
  try {
    const { orderId, riderId } = await request.json();

    if (!orderId || !riderId) {
      return NextResponse.json({ error: 'orderId and riderId are required' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({ where: { id: parseInt(orderId) } });
    if (!order || order.riderId !== parseInt(riderId)) {
      return NextResponse.json({ error: 'Invalid order or rider' }, { status: 400 });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: parseInt(orderId) },
      data: { status: ORDER_STATUS.ARRIVED } 
    });

    return NextResponse.json({ message: 'Rider marked as arrived', order: updatedOrder });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
