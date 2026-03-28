import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/riders/live-status
// Fetches the last known location and status of ALL active riders
export async function GET() {
  try {
    const riders = await prisma.rider.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        name: true,
        phone: true,
        lastLat: true,
        lastLng: true,
        lastArea: true,
        lastUpdated: true,
        assignedVehicle: {
          select: {
             regNumber: true,
             status: true
          }
        }
      }
    })

    // Map to a cleaner format
    const formatted = riders.map(r => ({
      riderId: r.id,
      name: r.name,
      lat: r.lastLat || 28.6139,
      lng: r.lastLng || 77.2090,
      area: r.lastArea || "Unknown",
      lastSeen: r.lastUpdated ? r.lastUpdated.getTime() : Date.now(),
      status: r.assignedVehicle?.status === 'in_use' ? 'busy' : 'free'
    }))

    return NextResponse.json(formatted)
  } catch (error) {
    console.error('Fetch live status error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
