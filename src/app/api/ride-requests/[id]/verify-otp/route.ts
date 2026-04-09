import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { publishNotification } from '@/lib/redis-pub'
import { sendPushNotification } from '@/lib/onesignal-server'
import { ORDER_STATUS, TRIP_STATUS } from '@/lib/constants'

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

    if (order.status !== ORDER_STATUS.ACCEPTED && order.status !== ORDER_STATUS.ARRIVED) {
      return NextResponse.json({ error: 'OTP can only be verified for Accepted/Arrived orders' }, { status: 400 })
    }

    // Validate OTP (convert both to string and trim to be safe)
    console.log(`[DEBUG] Verifying OTP for Order ${orderId}: DB_OTP="${order.otp}", Input_OTP="${otp}"`);
    
    if (order.otp?.toString().trim() !== otp?.toString().trim()) {
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
        data: { status: ORDER_STATUS.STARTED }
      })

      // Create the actual Trip record
      const newTrip = await tx.trip.create({
        data: {
          riderId: order.riderId!,
          vehicleId: vid,
          status: TRIP_STATUS.ONGOING,
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
      message: `OTP Verified! Trip to ${order.dropLoc} has started.`,
      customer: `${order.customer.firstName} ${order.customer.lastName}`,
      destination: order.dropLoc
    })

    sendPushNotification({
      title: "Ride Started 🚗",
      message: `OTP verified! Your ride with ${order.rider?.name} to ${order.dropLoc} is on the way.`,
      url: `/user/track/${orderId}`,
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
