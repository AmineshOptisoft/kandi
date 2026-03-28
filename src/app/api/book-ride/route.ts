import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { publishNotification } from "@/lib/redis-pub";

// Generate a 4-digit OTP
function generateOTP(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Haversine formula to calculate distance in KM between two lat/lng coords
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Estimated fare: base Rs.50 + Rs.15 per km
function calculateFare(distanceKm: number): number {
  return Math.round(50 + 15 * distanceKm);
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const {
      firstName,
      lastName,
      phone,
      email,
      // Pickup
      pickupLat,
      pickupLng,
      pickupLoc,
      // Drop
      dropLat,
      dropLng,
      dropLoc,
      // Payment preference
      paymentMode = "Cash",
    } = data;

    if (!firstName || !lastName || !phone || !email) {
      return NextResponse.json(
        { error: "First name, last name, phone, and email are required." },
        { status: 400 }
      );
    }

    if (!pickupLat || !pickupLng || !dropLat || !dropLng) {
      return NextResponse.json(
        { error: "Pickup and drop coordinates are required." },
        { status: 400 }
      );
    }

    // 1. Find or create customer
    let customer = await prisma.customer.findFirst({
      where: {
        OR: [{ phone }, { email }],
      },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: { firstName, lastName, phone, email },
      });
    }

    // 2. Calculate estimated distance & fare
    const distanceKm = calculateDistance(
      parseFloat(pickupLat),
      parseFloat(pickupLng),
      parseFloat(dropLat),
      parseFloat(dropLng)
    );
    const estimatedFare = calculateFare(distanceKm);

    // 3. Generate OTP for ride verification when rider arrives
    const otp = generateOTP();

    // 4. Create the Order (Ride Request)
    const newOrder = await prisma.order.create({
      data: {
        customerId: customer.id,
        status: "Pending",
        date: new Date(),
        pickupLat: parseFloat(pickupLat),
        pickupLng: parseFloat(pickupLng),
        pickupLoc: pickupLoc || null,
        dropLat: parseFloat(dropLat),
        dropLng: parseFloat(dropLng),
        dropLoc: dropLoc || null,
        otp,
        paymentMode,
        amount: estimatedFare,
      },
      include: { customer: true },
    });

    // ── NEW: Real-time notification to Admin ───────────────────────────
    await publishNotification('new-booking', {
      orderId: newOrder.id,
      customerName: `${newOrder.customer.firstName} ${newOrder.customer.lastName}`,
      pickup: newOrder.pickupLoc,
      amount: newOrder.amount,
      message: `🔔 New Ride Request: #ORD-${newOrder.id} from ${newOrder.customer.firstName}`
    });

    // 5. Find nearby free riders (using Haversine on their latest location logs)
    const freeRiders = await prisma.rider.findMany({
      where: {
        status: "active",
        trips: {
          none: { status: "ongoing" }, // no ongoing trip = FREE
        },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        trips: {
          where: { status: "completed" },
          orderBy: { endTime: "desc" },
          take: 1,
          include: {
            locationLogs: {
              orderBy: { timestamp: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    // 6. Filter and sort riders by distance to pickup point
    const nearbyRiders = freeRiders
      .map((rider) => {
        const lastLog = rider.trips[0]?.locationLogs[0];
        if (!lastLog) return { ...rider, distance: Infinity };
        const dist = calculateDistance(
          lastLog.lat,
          lastLog.lng,
          parseFloat(pickupLat),
          parseFloat(pickupLng)
        );
        return { ...rider, distance: parseFloat(dist.toFixed(2)) };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5); // Top 5 nearest riders

    return NextResponse.json(
      {
        message: "Ride request placed successfully!",
        order: {
          id: newOrder.id,
          status: newOrder.status,
          otp: newOrder.otp, // Customer should save this OTP
          amount: newOrder.amount,
          distance: parseFloat(distanceKm.toFixed(2)),
          paymentMode: newOrder.paymentMode,
          pickupLoc: newOrder.pickupLoc,
          dropLoc: newOrder.dropLoc,
          customer: {
            name: `${newOrder.customer.firstName} ${newOrder.customer.lastName}`,
            phone: newOrder.customer.phone,
          },
        },
        nearbyRiders, // Admin can use this to manually assign
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating ride request:", error);
    return NextResponse.json(
      { error: "Failed to place ride request. Please try again." },
      { status: 500 }
    );
  }
}
