import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params
    const id = parseInt(rawId)
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    const rider = await prisma.rider.findUnique({ where: { id } })
    if (!rider) return NextResponse.json({ error: 'Rider not found' }, { status: 404 })

    return NextResponse.json(rider)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch rider' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params
    const id = parseInt(rawId)
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    const body = await request.json()
    const { name, phone, email, password, nid, status } = body

    const data: any = {}
    if (name !== undefined) data.name = name
    if (phone !== undefined) data.phone = phone
    if (email !== undefined) data.email = email
    if (nid !== undefined) data.nid = nid
    if (status !== undefined) data.status = status
    if (password) data.password = await bcrypt.hash(password, 10)
    // Admin vehicle assignment
    if ('assignedVehicleId' in body) {
      data.assignedVehicleId = body.assignedVehicleId ? parseInt(body.assignedVehicleId) : null
    }

    const rider = await prisma.rider.update({ where: { id }, data })
    return NextResponse.json(rider)
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Phone or email already exists' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to update rider' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params
    const id = parseInt(rawId)
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    const tripsCount = await prisma.trip.count({ where: { riderId: id } })
    if (tripsCount > 0) {
      return NextResponse.json({ error: 'Cannot delete rider with associated trips' }, { status: 400 })
    }

    await prisma.rider.delete({ where: { id } })
    return NextResponse.json({ message: 'Rider deleted' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete rider' }, { status: 500 })
  }
}
