import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { ORDER_STATUS, TRIP_STATUS } from '@/lib/constants'

// GET /api/rider-app/pending-rides?riderId=X
// Returns nearby pending ride orders for a rider
/**
 * @swagger
 * /api/rider-app/pending-rides:
 *   get:
 *     tags:
 *       - Rider Actions
 *     summary: "[RIDES TAB] Get available rides for rider"
 *     description: |
 *       ## 📱 USE THIS FOR: Rides Tab
 *
 *       **Step 1 of the ride flow.** Call this API to show available rides to the rider.
 *
 *       ### How to use:
 *       - Call this API when the rider opens the **Rides tab**
 *       - Pass the `riderId` to check rider's current status
 *       - Poll this every 10-15 seconds to get fresh rides
 *
 *       ### Response Behavior:
 *       - If rider is **free** → returns `pendingOrders` array (all available rides)
 *       - If rider is **busy** (already on a trip) → returns `currentTrip` and `activeOrder`
 *
 *       ### Order Status Values:
 *       - `0` = Pending (available for riders to accept)
 *       - `1` = Accepted
 *       - `2` = Arrived
 *       - `3` = Started
 *       - `4` = Delivered/Completed
 *
 *       ### Next Step:
 *       After showing rides to rider, use **POST /api/rider-app/accept** when rider taps "Accept"
 *     parameters:
 *       - in: query
 *         name: riderId
 *         required: false
 *         schema:
 *           type: string
 *         description: The ID of the logged-in rider (get from login response)
 *     responses:
 *       200:
 *         description: Successfully fetched pending rides
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const riderId = parseInt(searchParams.get('riderId') || '0')

    // Check if rider is already on a trip or has an accepted order
    if (riderId) {
      const activeOrder = await prisma.order.findFirst({
        where: {
          riderId,
          status: { in: [ORDER_STATUS.ACCEPTED, ORDER_STATUS.ARRIVED, ORDER_STATUS.STARTED] }
        },
        include: { customer: true },
        orderBy: { updatedAt: 'desc' }
      })

      if (activeOrder) {
        // Find the trip if it has started
        const currentTrip = await prisma.trip.findFirst({
          where: {
            riderId,
            status: TRIP_STATUS.ONGOING
          },
          include: {
            vehicle: true,
            locationLogs: { orderBy: { timestamp: 'desc' }, take: 1 }
          }
        })

        return NextResponse.json({
          riderStatus: 'busy',
          currentTrip: currentTrip || null,
          activeOrder: activeOrder
        })
      }
    }

    // Rider is free — return all Pending orders
    const pendingOrders = await prisma.order.findMany({
      where: { status: ORDER_STATUS.PENDING },//'Pending'
      include: { customer: true },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      riderStatus: 'free',
      pendingOrders
    })
  } catch (error) {
    console.error('Error fetching pending rides:', error)
    return NextResponse.json({ error: 'Failed to fetch rides' }, { status: 500 })
  }
}
