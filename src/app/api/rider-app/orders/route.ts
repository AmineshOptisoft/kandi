import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * @swagger
 * /api/rider-app/orders:
 *   get:
 *     tags:
 *       - Rider Profile
 *     summary: Get orders for a rider
 *     description: Fetch distinct orders associated with an individual rider, including customer information.
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
 *         description: Number of orders to retrieve
 *     responses:
 *       200:
 *         description: Rider orders fetched successfully
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

    const orders = await (prisma as any).order.findMany({
      where: { riderId: parseInt(riderId) },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } }
      }
    })

    return NextResponse.json(orders)
  } catch (error) {
    console.error('Rider orders error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
