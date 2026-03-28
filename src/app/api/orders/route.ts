import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')

    const where: any = {}
    if (customerId) where.customerId = parseInt(customerId)

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: true,
        rider: true,
      },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(orders)
  } catch (error) {
    console.error('Fetch orders error:', error)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { customerId, riderId, status, date } = body

    if (!customerId) {
      return NextResponse.json({ error: 'Missing customer' }, { status: 400 })
    }

    const order = await prisma.order.create({
      data: {
        customerId: parseInt(customerId),
        riderId: riderId ? parseInt(riderId) : null,
        status: status || 'Pending',
        date: date ? new Date(date) : new Date(),
      },
      include: {
        customer: true,
        rider: true,
      }
    })

    return NextResponse.json(order, { status: 201 })
  } catch (error: any) {
    console.error('Create order error:', error)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
