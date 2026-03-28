import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const { tripId, lat, lng } = data

    if (!tripId || lat === undefined || lng === undefined) {
       return NextResponse.json({ error: 'tripId, lat, and lng are required' }, { status: 400 })
    }

    // Verify trip exists and is ongoing
    const trip = await prisma.trip.findUnique({ where: { id: parseInt(tripId) } })
    if (!trip || trip.status !== "ongoing") {
        return NextResponse.json({ error: 'Invalid or inactive trip' }, { status: 400 })
    }

    // Save location point to database
    const locationLog = await prisma.locationLog.create({
      data: {
        tripId: parseInt(tripId),
        lat: parseFloat(lat),
        lng: parseFloat(lng),
      }
    })

    return NextResponse.json({ message: 'Location updated', data: locationLog })

  } catch (error: any) {
    console.error('Location logging error:', error)
    return NextResponse.json({ error: 'Failed to update location' }, { status: 500 })
  }
}
