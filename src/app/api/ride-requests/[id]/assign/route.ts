import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { publishNotification } from '@/lib/redis-pub'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params
    const orderId = parseInt(rawId)
    if (isNaN(orderId)) return NextResponse.json({ error: 'Invalid Order ID' }, { status: 400 })

    const body = await request.json()
    const { riderId, vehicleId } = body

    if (!riderId || !vehicleId) {
      return NextResponse.json({ error: 'Rider ID and Vehicle ID are required' }, { status: 400 })
    }

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true }
    })
    if (!existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    if (existingOrder.status !== 'Pending') {
      return NextResponse.json({ error: 'Only Pending orders can be assigned' }, { status: 400 })
    }

    const riderBusy = await prisma.trip.findFirst({
      where: { riderId: parseInt(riderId), status: 'ongoing' }
    })
    if (riderBusy) {
      return NextResponse.json({ error: 'Selected rider is already on a trip' }, { status: 400 })
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id: parseInt(vehicleId) } })
    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    const vehicleBusy = await prisma.trip.findFirst({
      where: { vehicleId: parseInt(vehicleId), status: 'ongoing' }
    })
    if (vehicleBusy) {
      return NextResponse.json({ error: 'Selected vehicle is already on a trip with another rider' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          riderId: parseInt(riderId),
          status: 'Accepted',
        },
        include: { customer: true, rider: true }
      })

      await tx.vehicle.update({
        where: { id: parseInt(vehicleId) },
        data: { status: 'in_use' }
      })

      return { order: updatedOrder, vehicleId: parseInt(vehicleId) }
    })

    // 5. Send real-time notification
    await publishNotification('ride-assigned', {
      orderId,
      riderId: parseInt(riderId),
      vehicleId: parseInt(vehicleId),
      message: `🎯 Booking #ORD-${orderId} assigned to you!`
    });

    return NextResponse.json({
      message: `Rider ${result.order.rider?.name} assigned to Order #${orderId}.`,
      order: result.order,
      otp: result.order.otp,
    }, { status: 200 })

  } catch (error: any) {
    console.error('Ride assignment error:', error)
    return NextResponse.json({ error: 'Failed to assign ride' }, { status: 500 })
  }
}
