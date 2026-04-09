export const ORDER_STATUS = {
  PENDING: 0,
  ACCEPTED: 1,
  ARRIVED: 2,
  STARTED: 3,
  DELIVERED: 4,
  CANCELED: 5,
};
// 0: Pending, 1: Accepted, 2: Arrived, 3: Started, 4: Delivered, 5: Canceled
export const ORDER_STATUS_LABELS: Record<number, string> = {
  0: "Pending",
  1: "Accepted",
  2: "Arrived",
  3: "Started",
  4: "Delivered",
  5: "Canceled",
};

export const RIDER_STATUS = {
  ACTIVE: 0,
  SUSPENDED: 1,
  OFFLINE: 2,
};

export const VEHICLE_STATUS = {
  AVAILABLE: 0,
  IN_USE: 1,
  MAINTENANCE: 2,
};

export const TRIP_STATUS = {
  ONGOING: 0,
  COMPLETED: 1,
  CANCELLED: 2,
};
