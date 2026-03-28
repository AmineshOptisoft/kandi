import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { publishNotification } from '@/lib/redis-pub'

// POST /api/ride-requests/[id]/verify-otp
// Rider arrives at pickup, customer shows OTP — rider verifies it to START the trip
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params
    const orderId = parseInt(rawId)
    if (isNaN(orderId)) return NextResponse.json({ error: 'Invalid Order ID' }, { status: 400 })

    const body = await request.json()
    const { otp, vehicleId } = body

    if (!otp) {
      return NextResponse.json({ error: 'OTP is required' }, { status: 400 })
    }

    // Fetch order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { rider: true, customer: true }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.status !== 'Accepted') {
      return NextResponse.json({ error: 'OTP can only be verified for Accepted orders' }, { status: 400 })
    }

    // Validate OTP
    if (order.otp !== otp.toString()) {
      return NextResponse.json({ error: 'Invalid OTP. Please check again.' }, { status: 400 })
    }

    if (!order.riderId) {
      return NextResponse.json({ error: 'No rider assigned to this order' }, { status: 400 })
    }

    // Find the vehicle assigned (from the reserved vehicle via assign route)
    // vehicleId should be passed by the rider app
    const vid = vehicleId ? parseInt(vehicleId) : null;
    if (!vid) {
      return NextResponse.json({ error: 'Vehicle ID is required to start trip' }, { status: 400 })
    }

    // OTP matched! Now start the trip
    const result = await prisma.$transaction(async (tx) => {
      // Update order status to Started
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: 'Started' }
      })

      // Create the actual Trip record
      const newTrip = await tx.trip.create({
        data: {
          riderId: order.riderId!,
          vehicleId: vid,
          status: 'ongoing',
          startTime: new Date(),
          startLoc: order.pickupLoc || null,
          endLoc: order.dropLoc || null,
          fare: order.amount || 0,
        }
      })

      return { order: updatedOrder, trip: newTrip }
    })

    // 5. Send real-time notification to Admin
    await publishNotification('trip-started', {
      orderId,
      riderId: order.riderId!,
      message: `🚕 Ride started: Order #ORD-${orderId} is now ONGOING.`
    });

    return NextResponse.json({
      message: `OTP verified ✅ Ride started! Trip #${result.trip.id} is now ongoing.`,
      trip: result.trip,
      order: result.order
    }, { status: 200 })

  } catch (error: any) {
    console.error('OTP verification error:', error)
    return NextResponse.json({ error: 'Failed to verify OTP' }, { status: 500 })
  }
}
