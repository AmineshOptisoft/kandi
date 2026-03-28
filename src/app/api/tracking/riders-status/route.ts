import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    // 1. Fetch all riders
    const riders = await prisma.rider.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        status: true,
        assignedVehicleId: true,
      }
    });

    // 2. Fetch all ongoing trips with their latest location logs
    const ongoingTrips = await prisma.trip.findMany({
      where: { status: 'ongoing' },
      include: {
        locationLogs: {
          orderBy: { timestamp: 'desc' },
          take: 1
        },
        vehicle: true
      }
    });

    // Create a map to quickly look up ongoing trips by riderId
    const busyRiderMap = new Map();
    ongoingTrips.forEach(trip => {
      busyRiderMap.set(trip.riderId, trip);
    });

    // 3. Categorize riders
    const freeRiders: any[] = [];
    const busyRiders: any[] = [];

    riders.forEach(rider => {
      if (rider.status !== 'active') return; // Skip suspended ones entirely if needed

      if (busyRiderMap.has(rider.id)) {
        const trip = busyRiderMap.get(rider.id);
        const lastLocation = trip.locationLogs.length > 0 ? trip.locationLogs[0] : null;

        busyRiders.push({
          ...rider,
          currentState: 'Busy',
          trip: {
            id: trip.id,
            vehicle: trip.vehicle.regNumber,
            startTime: trip.startTime
          },
          currentLocation: lastLocation ? { lat: lastLocation.lat, lng: lastLocation.lng, updated: lastLocation.timestamp } : null
        });
      } else {
        freeRiders.push({
          ...rider,
          currentState: 'Free'
        });
      }
    });

    return NextResponse.json({
      summary: {
        totalActive: freeRiders.length + busyRiders.length,
        freeCount: freeRiders.length,
        busyCount: busyRiders.length
      },
      freeRiders,
      busyRiders
    });

  } catch (error) {
    console.error('Error fetching rider status:', error);
    return NextResponse.json({ error: 'Failed to fetch tracking data' }, { status: 500 });
  }
}
