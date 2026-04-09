import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { publishNotification } from '@/lib/redis-pub'
import { sendPushNotification } from '@/lib/onesignal-server'
import { ORDER_STATUS, TRIP_STATUS, VEHICLE_STATUS } from '@/lib/constants'

// POST /api/rider-app/accept
// Rider self-accepts a pending ride near them
/**
 * @swagger
 * /api/rider-app/accept:
 *   post:
 *     tags:
 *       - Rider Actions
 *     summary: "[STEP 1] Accept a pending ride"
 *     description: |
 *       ## 📱 USE THIS FOR: Orders Tab — Step 1
 *
 *       **Rider accepts a ride from the Rides tab.** This is the first action in the order lifecycle.
 *
 *       ### How to use:
 *       - When rider taps "Accept" on a ride card, call this API
 *       - Send `orderId` (from pending-rides response), `riderId` (from login), `vehicleId` (from profile)
 *       - `vehicleId` is optional — if not sent, it will be auto-fetched from rider's assigned vehicle
 *
 *       ### What happens after this:
 *       - Order status changes to `1` (Accepted)
 *       - A 4-digit `otp` is generated and sent to customer
 *       - Rider gets pickup location coordinates (`pickupLat`, `pickupLng`)
 *       - Customer gets a push notification
 *
 *       ### Next Step:
 *       Navigate rider to pickup location. When rider reaches, call **POST /api/rider-app/ride/arrive**
 *
 *       ### Error Cases:
 *       - `"This ride has already been accepted"` → Another rider accepted first, refresh the rides list
 *       - `"You are already on a trip"` → Rider must complete current trip first
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
 *                 description: ID of the ride to accept (from pending-rides API)
 *                 example: 1
 *               riderId:
 *                 type: integer
 *                 description: Logged-in rider's ID (from login response)
 *                 example: 1
 *               vehicleId:
 *                 type: integer
 *                 description: Rider's assigned vehicle ID (optional, auto-fetched if not sent)
 *                 example: 1
 *     responses:
 *       200:
 *         description: Ride accepted — returns order with OTP and pickup coordinates
 *       400:
 *         description: Validation error or ride already taken or rider busy
 *       404:
 *         description: Order not found
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    let { orderId, riderId, vehicleId } = body

    if (!orderId || !riderId) {
      return NextResponse.json({ error: 'orderId and riderId are required' }, { status: 400 })
    }

    // Resolve vehicleId if not sent
    if (!vehicleId) {
      const rider = await prisma.rider.findUnique({ where: { id: parseInt(riderId) } });
      if (rider?.assignedVehicleId) {
        vehicleId = rider.assignedVehicleId;
      }
    }

    // Check order is still Pending
    const order = await prisma.order.findUnique({
      where: { id: parseInt(orderId) },
      include: { customer: true }
    })

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.status !== ORDER_STATUS.PENDING) {
      return NextResponse.json({ error: 'This ride has already been accepted or is no longer available' }, { status: 400 })
    }

    // Check rider is free
    const riderBusy = await prisma.trip.findFirst({
      where: { riderId: parseInt(riderId), status: TRIP_STATUS.ONGOING }
    })
    if (riderBusy) return NextResponse.json({ error: 'You are already on a trip' }, { status: 400 })

    // Accept the ride
    const result = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: parseInt(orderId) },
        data: { 
          riderId: parseInt(riderId), 
          status: ORDER_STATUS.ACCEPTED
        },
        include: { customer: true }
      })
      
      if (vehicleId) {
        await tx.vehicle.update({
          where: { id: parseInt(vehicleId) },
          data: { status: VEHICLE_STATUS.IN_USE }
        })
      }
      return updatedOrder
    })

    // 4. Send real-time notification
    await publishNotification('ride-accepted', {
      orderId: parseInt(orderId),
      riderId: parseInt(riderId),
      otp: result.otp,
      message: `✅ Ride accepted: Rider #${riderId} is heading to pick up Order #ORD-${orderId}.`
    });

    sendPushNotification({
      title: "Rider En Route 🚘",
      message: `Your ride has been accepted! Your driver is heading to your pickup location. Your OTP is: ${result.otp}`,
      url: `/user/track/${orderId}`,
      userIds: [order.customerId.toString()]
    });

    return NextResponse.json({
      message: 'Ride accepted! Head to the pickup location.',
      order: {
        id: result.id,
        status: result.status,
        otp: result.otp,
        customer: result.customer,
        pickupLoc: result.pickupLoc,
        pickupLat: result.pickupLat,
        pickupLng: result.pickupLng,
        dropLoc: result.dropLoc,
        dropLat: result.dropLat,
        dropLng: result.dropLng,
        amount: result.amount,
        paymentMode: result.paymentMode,
      }
    })
  } catch (error: any) {
    console.error('Accept ride error:', error)
    return NextResponse.json({ error: 'Failed to accept ride' }, { status: 500 })
  }
}
