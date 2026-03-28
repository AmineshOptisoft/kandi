import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { publishNotification } from '@/lib/redis-pub'

// POST /api/rider-app/accept
// Rider self-accepts a pending ride near them
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { orderId, riderId, vehicleId } = body

    if (!orderId || !riderId || !vehicleId) {
      return NextResponse.json({ error: 'orderId, riderId, and vehicleId are required' }, { status: 400 })
    }

    // Check order is still Pending
    const order = await prisma.order.findUnique({
      where: { id: parseInt(orderId) },
      include: { customer: true }
    })

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.status !== 'Pending') {
      return NextResponse.json({ error: 'This ride has already been accepted or is no longer available' }, { status: 400 })
    }

    // Check rider is free
    const riderBusy = await prisma.trip.findFirst({
      where: { riderId: parseInt(riderId), status: 'ongoing' }
    })
    if (riderBusy) return NextResponse.json({ error: 'You are already on a trip' }, { status: 400 })

    // Accept the ride
    const result = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: parseInt(orderId) },
        data: { riderId: parseInt(riderId), status: 'Accepted' },
        include: { customer: true }
      })
      await tx.vehicle.update({
        where: { id: parseInt(vehicleId) },
        data: { status: 'in_use' }
      })
      return updatedOrder
    })

    // 4. Send real-time notification
    await publishNotification('ride-accepted', {
      orderId: parseInt(orderId),
      riderId: parseInt(riderId),
      message: `✅ Ride accepted: Rider #${riderId} is heading to pick up Order #ORD-${orderId}.`
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
