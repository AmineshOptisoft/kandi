import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * @swagger
 * /api/rider-app/trips:
 *   get:
 *     tags:
 *       - Rider Profile
 *     summary: Get trips for a rider
 *     description: Fetch distinct trips associated with an individual rider.
 *     parameters:
 *       - in: query
 *         name: riderId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The rider's ID
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of trips to retrieve
 *     responses:
 *       200:
 *         description: Rider trips fetched successfully
 *       400:
 *         description: riderId is required
 *       500:
 *         description: Internal Server Error
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const riderId = searchParams.get('riderId')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (!riderId) {
      return NextResponse.json({ error: 'riderId is required' }, { status: 400 })
    }

    const trips = await (prisma as any).trip.findMany({
      where: { riderId: parseInt(riderId) },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json(trips)
  } catch (error) {
    console.error('Rider trips error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
