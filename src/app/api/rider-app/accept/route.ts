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
 *     summary: Accept a pending ride
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId, riderId, vehicleId]
 *             properties:
 *               orderId:
 *                 type: integer
 *               riderId:
 *                 type: integer
 *               vehicleId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Ride accepted
 *       400:
 *         description: Validation error or rider busy
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
          status: ORDER_STATUS.ACCEPTED,
          otp: Math.floor(1000 + Math.random() * 9000).toString()
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
