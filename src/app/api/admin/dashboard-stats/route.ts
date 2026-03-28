import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const [
      totalOrders,
      activeDeliveries,
      completedOrders,
      cancelledOrders,
      availableRiders,
      totalRevenue,
      totalCustomers
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({
        where: {
          status: { in: ["Accepted", "Arrived", "Started"] }
        }
      }),
      prisma.order.count({
        where: { status: "Delivered" }
      }),
      prisma.order.count({
        where: { status: "Canceled" }
      }),
      prisma.rider.count({
        where: { status: "active" }
      }),
      prisma.order.aggregate({
        where: { status: "Delivered" },
        _sum: { amount: true }
      }),
      prisma.customer.count()
    ]);

    const completionRate = totalOrders > 0 
      ? ((completedOrders / totalOrders) * 100).toFixed(1) 
      : 0;

    return NextResponse.json({
      totalOrders,
      activeDeliveries,
      completedOrders,
      cancelledOrders,
      availableRiders,
      totalRevenue: totalRevenue._sum.amount || 0,
      totalCustomers,
      completionRate
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
