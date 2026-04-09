import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * @swagger
 * /api/rider-app/ride/complete:
 *   post:
 *     tags:
 *       - Rider Actions
 *     summary: "[STEP 4] Complete the ride"
 *     description: |
 *       ## 📱 USE THIS FOR: Orders Tab — Step 4 (Final Step)
 *
 *       **Rider completes the trip at the drop location.** Call this when rider taps "Complete Ride".
 *
 *       ### How to use:
 *       - When rider reaches the drop location, show a "Complete Ride" button
 *       - Send `orderId`, `riderId`, and `tripId` (tripId was returned from `/ride/start`)
 *       - Optionally send `finalDistance` (in KM) and `batteryUsed` (%)
 *
 *       ### What happens after this:
 *       - Order status changes to `4` (Delivered/Completed)
 *       - Final fare is calculated: **₹50 base + ₹15 per KM**
 *       - Trip is marked as completed with end time
 *       - Vehicle is freed and battery is updated
 *
 *       ### Response includes:
 *       - `order.amount` → Final fare amount (show this to rider)
 *       - `trip.distance` → Total distance traveled
 *       - `trip.fare` → Fare earned (same as order.amount)
 *
 *       ### ⚠️ Important:
 *       - `tripId` comes from the response of **POST /api/rider-app/ride/start**
 *       - After this, rider is free to accept new rides
 *       - This ride will appear in **GET /api/rider-app/earnings** (Trips tab)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId, riderId, tripId]
 *             properties:
 *               orderId:
 *                 type: integer
 *                 description: Active order ID
 *                 example: 1
 *               riderId:
 *                 type: integer
 *                 description: Logged-in rider's ID
 *                 example: 1
 *               tripId:
 *                 type: integer
 *                 description: Trip ID from the /ride/start response (required!)
 *                 example: 1
 *               finalDistance:
 *                 type: number
 *                 description: Actual distance in KM — if not sent, fare uses trip estimate
 *                 example: 12.5
 *               batteryUsed:
 *                 type: integer
 *                 description: Battery % consumed (default 10% if not sent)
 *                 example: 15
 *     responses:
 *       200:
 *         description: Ride completed — returns final fare amount and trip summary
 *       400:
 *         description: Validation error
 *       404:
 *         description: Order or trip not found
 */
import { ORDER_STATUS, TRIP_STATUS, VEHICLE_STATUS } from '@/lib/constants';

export async function POST(request: Request) {
  try {
    const { orderId, riderId, tripId, finalDistance, batteryUsed } = await request.json();

    if (!orderId || !riderId || !tripId) {
      return NextResponse.json({ error: 'orderId, riderId, and tripId are required' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({ where: { id: parseInt(orderId) } });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    if (order.riderId !== parseInt(riderId)) {
      return NextResponse.json({ error: 'This order is not assigned to you' }, { status: 400 });
    }

    const trip = await prisma.trip.findUnique({ where: { id: parseInt(tripId) } });
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

    // Calculate final fare if distance provided
    const distance = finalDistance || trip.distance || 0;
    const fare = Math.round(50 + 15 * distance); // base Rs.50 + Rs.15/km

    // Transaction: complete everything
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update order to Delivered
      const updatedOrder = await tx.order.update({
        where: { id: parseInt(orderId) },
        data: { status: ORDER_STATUS.DELIVERED, amount: fare }
      });

      // 2. Complete the trip
      const updatedTrip = await tx.trip.update({
        where: { id: parseInt(tripId) },
        data: {
          status: TRIP_STATUS.COMPLETED,
          endTime: new Date(),
          distance: parseFloat(String(distance)),
          fare
        }
      });

      // 3. Free the vehicle and reduce battery
      if (trip.vehicleId) {
        const vehicle = await tx.vehicle.findUnique({ where: { id: trip.vehicleId } });
        if (vehicle) {
          const newBattery = Math.max(0, vehicle.battery - (batteryUsed || 10));
          await tx.vehicle.update({
            where: { id: trip.vehicleId },
            data: { status: VEHICLE_STATUS.AVAILABLE, battery: newBattery }
          });
        }
      }

      return { updatedOrder, updatedTrip };
    });

    return NextResponse.json({
      message: 'Ride completed successfully!',
      order: { id: result.updatedOrder.id, status: result.updatedOrder.status, amount: result.updatedOrder.amount },
      trip: { id: result.updatedTrip.id, distance: result.updatedTrip.distance, fare: result.updatedTrip.fare, endTime: result.updatedTrip.endTime },
      paymentMode: result.updatedOrder.paymentMode,
    });
  } catch (error) {
    console.error('Complete ride error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
