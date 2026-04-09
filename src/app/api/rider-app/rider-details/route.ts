import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * @swagger
 * /api/rider-app/rider-details:
 *   get:
 *     tags:
 *       - Rider Profile
 *     summary: Get details for an individual rider
 *     description: Fetch individual rider details, assigned vehicle, recent orders, trips, and performance stats. (Separate API from profile)
 *     parameters:
 *       - in: query
 *         name: riderId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The rider's ID
 *     responses:
 *       200:
 *         description: Rider details fetched successfully
 *       400:
 *         description: riderId is required
 *       404:
 *         description: Rider not found
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const riderId = searchParams.get('riderId')

    if (!riderId) {
      return NextResponse.json({ error: 'riderId is required' }, { status: 400 })
    }

    const rider = await (prisma as any).rider.findUnique({
      where: { id: parseInt(riderId) },
      include: {
        assignedVehicle: {
          select: { id: true, regNumber: true, model: true, battery: true, status: true, type: true }
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            customer: { select: { firstName: true, lastName: true, phone: true } }
          }
        },
        trips: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        _count: {
          select: { orders: true, trips: true }
        }
      }
    })

    if (!rider) {
      return NextResponse.json({ error: 'Rider not found' }, { status: 404 })
    }

    // Compute stats
    const completedOrders = rider.orders.filter((o: any) => o.status === 'Delivered' || o.status === 'Completed')
    const totalEarnings = completedOrders.reduce((sum: number, o: any) => sum + (o.amount || 0), 0)
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayOrders = rider.orders.filter((o: any) => new Date(o.createdAt) >= todayStart)
    const todayEarnings = todayOrders
      .filter((o: any) => o.status === 'Delivered' || o.status === 'Completed')
      .reduce((sum: number, o: any) => sum + (o.amount || 0), 0)

    return NextResponse.json({
      ...rider,
      stats: {
        totalOrders: rider._count.orders,
        completedOrders: completedOrders.length,
        totalEarnings,
        todayOrders: todayOrders.length,
        todayEarnings,
        totalTrips: rider._count.trips,
      }
    })
  } catch (error) {
    console.error('Rider details error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
