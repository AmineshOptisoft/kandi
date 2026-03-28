import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/ride-requests/[id]
// Fetches detailed information about a specific ride request for tracking
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params
    const orderId = parseInt(rawId)
    if (isNaN(orderId)) return NextResponse.json({ error: 'Invalid Order ID' }, { status: 400 })

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        rider: {
          select: {
            id: true,
            name: true,
            phone: true,
          }
        },
        customer: {
          select: {
            firstName: true,
            lastName: true,
          }
        }
      }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json(order)

  } catch (error) {
    console.error('Fetch order error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
