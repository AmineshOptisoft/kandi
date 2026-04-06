"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";
import flatpickr from "flatpickr";
import ChartTab, { ChartFilter } from "../common/ChartTab";
import { CalenderIcon } from "../../icons";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function StatisticsChart() {
  const [salesData, setSalesData] = useState<number[]>([0,0,0,0,0,0,0,0,0,0,0,0]);
  const [revenueData, setRevenueData] = useState<number[]>([0,0,0,0,0,0,0,0,0,0,0,0]);
  const [filter, setFilter] = useState<ChartFilter>("Monthly");

  useEffect(() => {
    fetch("/api/admin/dashboard-stats")
      .then(res => res.json())
      .then(res => {
        if (res.chartData) {
          setSalesData(res.chartData.salesPerMonth);
          setRevenueData(res.chartData.revenuePerMonth);
        }
      });
  }, []);

  const datePickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!datePickerRef.current) return;

    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 6);

    const fp = flatpickr(datePickerRef.current, {
      mode: "range",
      static: true,
      monthSelectorType: "static",
      dateFormat: "M d",
      defaultDate: [sevenDaysAgo, today],
      clickOpens: true,
      prevArrow:
        '<svg class="stroke-current" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 15L7.5 10L12.5 5" stroke="" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      nextArrow:
        '<svg class="stroke-current" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.5 15L12.5 10L7.5 5" stroke="" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    });

    return () => {
      if (!Array.isArray(fp)) {
        fp.destroy();
      }
    };
  }, []);

  const options: ApexOptions = {
    legend: {
      show: false, // Hide legend
      position: "top",
      horizontalAlign: "left",
    },
    colors: ["#006600", "#69af69"], // Define line colors
    chart: {
      fontFamily: "Outfit, sans-serif",
      height: 310,
      type: "line", // Set the chart type to 'line'
      toolbar: {
        show: false, // Hide chart toolbar
      },
    },
    stroke: {
      curve: "straight", // Define the line style (straight, smooth, or step)
      width: [2, 2], // Line width for each dataset
    },

    fill: {
      type: "gradient",
      gradient: {
        opacityFrom: 0.55,
        opacityTo: 0,
      },
    },
    markers: {
      size: 0, // Size of the marker points
      strokeColors: "#fff", // Marker border color
      strokeWidth: 2,
      hover: {
        size: 6, // Marker size on hover
      },
    },
    grid: {
      xaxis: {
        lines: {
          show: false, // Hide grid lines on x-axis
        },
      },
      yaxis: {
        lines: {
          show: true, // Show grid lines on y-axis
        },
      },
    },
    dataLabels: {
      enabled: false, // Disable data labels
    },
    tooltip: {
      enabled: true, // Enable tooltip
      x: {
        format: "dd MMM yyyy", // Format for x-axis tooltip
      },
    },
    xaxis: {
      type: "category",
      categories: filter === "Quarterly" 
        ? ["Q1", "Q2", "Q3", "Q4"] 
        : filter === "Annually" 
        ? ["Year-to-Date"] 
        : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      axisBorder: {
        show: false, // Hide x-axis border
      },
      axisTicks: {
        show: false, // Hide x-axis ticks
      },
      tooltip: {
        enabled: false, // Disable tooltip for x-axis points
      },
    },
    yaxis: {
      labels: {
        style: {
          fontSize: "12px", // Adjust font size for y-axis labels
          colors: ["#6B7280"], // Color of the labels
        },
      },
      title: {
        text: "", // Remove y-axis title
        style: {
          fontSize: "0px",
        },
      },
    },
  };

  let displaySales = salesData;
  let displayRevenue = revenueData;

  if (filter === "Quarterly") {
    displaySales = [
      salesData[0]+salesData[1]+salesData[2],
      salesData[3]+salesData[4]+salesData[5],
      salesData[6]+salesData[7]+salesData[8],
      salesData[9]+salesData[10]+salesData[11]
    ];
    displayRevenue = [
      revenueData[0]+revenueData[1]+revenueData[2],
      revenueData[3]+revenueData[4]+revenueData[5],
      revenueData[6]+revenueData[7]+revenueData[8],
      revenueData[9]+revenueData[10]+revenueData[11]
    ];
  } else if (filter === "Annually") {
    displaySales = [salesData.reduce((a, b) => a + b, 0)];
    displayRevenue = [revenueData.reduce((a, b) => a + b, 0)];
  }

  const series = [
    {
      name: "Sales",
      data: displaySales,
    },
    {
      name: "Revenue",
      data: displayRevenue,
    },
  ];
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-5 pb-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6">
      <div className="flex flex-col gap-5 mb-6 sm:flex-row sm:justify-between">
        <div className="w-full">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Statistics
          </h3>
          <p className="mt-1 text-gray-500 text-theme-sm dark:text-gray-400">
            Target you've set for each month
          </p>
        </div>
        <div className="flex items-center gap-3 sm:justify-end">
          <ChartTab selected={filter} onChange={setFilter} />
          <div className="relative inline-flex items-center">
            <CalenderIcon className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 lg:left-3 lg:top-1/2 lg:translate-x-0 lg:-translate-y-1/2  text-gray-500 dark:text-gray-400 pointer-events-none z-10" />
            <input
              ref={datePickerRef}
              className="h-10 w-10 lg:w-40 lg:h-auto  lg:pl-10 lg:pr-3 lg:py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-transparent lg:text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-800 dark:lg:text-gray-300 cursor-pointer"
              placeholder="Select date range"
            />
          </div>
        </div>
      </div>

      <div className="max-w-full overflow-x-auto custom-scrollbar">
        <div className="min-w-[1000px] xl:min-w-full">
          <Chart options={options} series={series} type="area" height={310} />
        </div>
      </div>
    </div>
  );
}