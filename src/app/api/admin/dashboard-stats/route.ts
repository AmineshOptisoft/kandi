import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

import { ORDER_STATUS, RIDER_STATUS } from "@/lib/constants";

export async function GET() {
  try {
    const [
      totalOrders,
      activeDeliveries,
      completedOrders,
      cancelledOrders,
      availableRiders,
      totalRevenue,
      totalCustomers,
      allOrders
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({
        where: {
          status: { in: [ORDER_STATUS.ACCEPTED, ORDER_STATUS.ARRIVED, ORDER_STATUS.STARTED] }
        }
      }),
      prisma.order.count({
        where: { status: ORDER_STATUS.DELIVERED }
      }),
      prisma.order.count({
        where: { status: ORDER_STATUS.CANCELED }
      }),
      prisma.rider.count({
        where: { status: RIDER_STATUS.ACTIVE }
      }),
      prisma.order.aggregate({
        where: { status: ORDER_STATUS.DELIVERED },
        _sum: { amount: true }
      }),
      prisma.customer.count(),
      prisma.order.findMany({
        select: { createdAt: true, amount: true, status: true }
      })
    ]);

    const completionRate = totalOrders > 0
      ? ((completedOrders / totalOrders) * 100).toFixed(1)
      : 0;

    // Chart Data Computation
    const monthlyDeliveries = Array(12).fill(0);
    const revenuePerMonth = Array(12).fill(0);
    const salesPerMonth = Array(12).fill(0);
    let currentMonthRevenue = 0;
    let currentQuarterRevenue = 0;
    let currentYearRevenue = 0;
    let todayRevenue = 0;
    
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const todayString = today.toDateString();
    const currentQuarter = Math.floor(currentMonth / 3);

    allOrders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      const month = orderDate.getMonth(); // 0 to 11
      
      // All created orders count toward "Sales" volume
      salesPerMonth[month] += 1;

      // Only delivered orders count toward deliveries and revenue
      if (order.status === ORDER_STATUS.DELIVERED) {
        monthlyDeliveries[month] += 1;
        const amt = order.amount || 0;
        revenuePerMonth[month] += amt;
        
        if (orderDate.getFullYear() === currentYear) {
          currentYearRevenue += amt;
          
          if (Math.floor(month / 3) === currentQuarter) {
            currentQuarterRevenue += amt;
          }
          
          if (month === currentMonth) {
            currentMonthRevenue += amt;
          }
        }
        
        if (orderDate.toDateString() === todayString) {
          todayRevenue += amt;
        }
      }
    });

    const targetRevenue = 20000; // Hardcoded $20K monthly target
    const targetProgress = Math.min(100, (currentMonthRevenue / targetRevenue) * 100);

    return NextResponse.json({
      totalOrders,
      activeDeliveries,
      completedOrders,
      cancelledOrders,
      availableRiders,
      totalRevenue: totalRevenue._sum.amount || 0,
      totalCustomers,
      completionRate,
      chartData: {
        monthlyDeliveries,
        revenuePerMonth,
        salesPerMonth,
        targetStats: {
          currentMonthRevenue,
          currentQuarterRevenue,
          currentYearRevenue,
          monthlyTarget: 20000,
          todayRevenue
        }
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
