import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * @swagger
 * /api/rider-app/ride/start:
 *   post:
 *     tags:
 *       - Rider Actions
 *     summary: "[STEP 3] Start the ride with OTP verification"
 *     description: |
 *       ## 📱 USE THIS FOR: Orders Tab — Step 3
 *
 *       **Rider verifies the customer's OTP to start the trip.** Call this when rider submits the OTP.
 *
 *       ### How to use:
 *       - After arriving, show an OTP input field to the rider
 *       - Customer will share their 4-digit OTP (they got it after ride was accepted)
 *       - Send `orderId`, `riderId`, `vehicleId`, and `otp` to this API
 *
 *       ### What happens after this:
 *       - OTP is verified against the stored OTP
 *       - Order status changes to `3` (Started)
 *       - A new **Trip record** is created — save the returned `trip.id` for the complete step!
 *
 *       ### ⚠️ Important:
 *       - Store the `trip.id` from the response — you'll need it for **POST /api/rider-app/ride/complete**
 *       - Rider must have already called `/arrive` before this (order must be in status `2`)
 *
 *       ### Next Step:
 *       Navigate rider to the drop location. When ride ends, call **POST /api/rider-app/ride/complete**
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId, riderId, vehicleId, otp]
 *             properties:
 *               orderId:
 *                 type: integer
 *                 description: Active order ID
 *                 example: 1
 *               riderId:
 *                 type: integer
 *                 description: Logged-in rider's ID
 *                 example: 1
 *               vehicleId:
 *                 type: integer
 *                 description: Rider's assigned vehicle ID (from profile API)
 *                 example: 1
 *               otp:
 *                 type: string
 *                 description: 4-digit OTP shared by the customer
 *                 example: "1234"
 *     responses:
 *       200:
 *         description: Ride started — returns order status and trip.id (save this!)
 *       400:
 *         description: Invalid OTP or rider must arrive first
 *       404:
 *         description: Order not found
 */
import { ORDER_STATUS, TRIP_STATUS } from '@/lib/constants';

export async function POST(request: Request) {
  try {
    let { orderId, riderId, vehicleId, otp } = await request.json();
    if (!orderId || !riderId || !vehicleId || !otp) {
      return NextResponse.json({ error: 'orderId, riderId, vehicleId, and otp are required' }, { status: 400 });
    }

    const otpStr = otp?.toString().trim();

    const order = await prisma.order.findUnique({
      where: { id: parseInt(orderId) },
      include: { customer: true }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.riderId !== parseInt(riderId)) {
      return NextResponse.json({ error: 'This order is not assigned to you' }, { status: 400 });
    }

    // Verify OTP
    if (order.otp?.toString().trim() !== otpStr) {
      return NextResponse.json({ error: 'Invalid OTP. Please ask the customer for the correct code.' }, { status: 400 });
    }

    // Allow both Accepted (1) and Arrived (2) orders to be started
    if (order.status !== ORDER_STATUS.ACCEPTED && order.status !== ORDER_STATUS.ARRIVED) {
      return NextResponse.json({ error: 'Ride must be accepted or arrived before starting' }, { status: 400 });
    }

    // Transaction: update order + create trip
    const result = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: parseInt(orderId) },
        data: { status: ORDER_STATUS.STARTED }
      });

      const trip = await tx.trip.create({
        data: {
          riderId: parseInt(riderId),
          vehicleId: parseInt(vehicleId),
          startTime: new Date(),
          status: TRIP_STATUS.ONGOING,
          startLoc: order.pickupLoc || null,
          endLoc: order.dropLoc || null
        }
      });

      return { updatedOrder, trip };
    });

    // Fetch vehicle details for battery info
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: parseInt(vehicleId) }
    });

    return NextResponse.json({
      message: 'Ride started! Navigate to the drop location.',
      orderId: result.updatedOrder.id,
      tripId: result.trip.id,
      startBattery: vehicle?.battery || 100,
      pickupLoc: result.updatedOrder.pickupLoc,
      dropLoc: result.updatedOrder.dropLoc,
      otp: result.updatedOrder.otp,
      paymentMode: result.updatedOrder.paymentMode,
      amount: result.updatedOrder.amount,
      order: { id: result.updatedOrder.id, status: result.updatedOrder.status },
      trip: { id: result.trip.id, startTime: result.trip.startTime }
    });
  } catch (error) {
    console.error('Start ride error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
