import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getMyStaffId,
  getStaffShiftRequests,
  saveStaffShiftRequest,
  listShiftRequestsForStore,
} from "./staff-shift-requests";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { getCurrentAdminStoreScope } from "./current-admin-scope";

vi.mock("@/lib/db", () => ({
  prisma: {
    admin: { findUnique: vi.fn() },
    staff: { findUnique: vi.fn(), findMany: vi.fn() },
    staffShiftRequest: { findMany: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("./current-admin-scope", () => ({
  getCurrentAdminStoreScope: vi.fn(),
}));

describe("getMyStaffId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    expect(await getMyStaffId()).toBeNull();
  });

  it("returns null when the session role is not staff", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", role: "manager" } } as never);
    expect(await getMyStaffId()).toBeNull();
    expect(prisma.admin.findUnique).not.toHaveBeenCalled();
  });

  it("returns the linked staffId for a staff-role admin", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "staff" } } as never);
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({ id: 7, staffId: 42 } as never);

    expect(await getMyStaffId()).toBe(42);
  });

  it("returns null when a staff-role admin has no linked staffId", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "staff" } } as never);
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({ id: 7, staffId: null } as never);

    expect(await getMyStaffId()).toBeNull();
  });
});

describe("getStaffShiftRequests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the requests when called by the linked staff member themselves", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "staff" } } as never);
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({ id: 7, staffId: 42 } as never);
    vi.mocked(prisma.staffShiftRequest.findMany).mockResolvedValue([
      {
        workDate: new Date("2026-10-01T00:00:00.000Z"),
        isDayOffRequested: false,
        preferredStartTime: new Date("1970-01-01T10:00:00.000Z"),
        preferredEndTime: new Date("1970-01-01T15:00:00.000Z"),
      },
    ] as never);

    const result = await getStaffShiftRequests(42, "2026-10");

    expect(result).toEqual([
      {
        workDate: "2026-10-01",
        isDayOffRequested: false,
        preferredStartMinutes: 600,
        preferredEndMinutes: 900,
      },
    ]);
  });

  it("returns an empty array when called by someone who is neither the staff member nor a manager/hq", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "staff" } } as never);
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({ id: 9, staffId: 99 } as never);

    const result = await getStaffShiftRequests(42, "2026-10");

    expect(result).toEqual([]);
    expect(prisma.staffShiftRequest.findMany).not.toHaveBeenCalled();
  });

  it("returns the requests for a manager whose store scope includes the staff's store", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", role: "manager" } } as never);
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({ id: 3, staffId: null } as never);
    vi.mocked(getCurrentAdminStoreScope).mockResolvedValue({
      isUnrestricted: false,
      storeIds: [1],
    });
    vi.mocked(prisma.staff.findUnique).mockResolvedValue({ id: 42, storeId: 1 } as never);
    vi.mocked(prisma.staffShiftRequest.findMany).mockResolvedValue([] as never);

    const result = await getStaffShiftRequests(42, "2026-10");

    expect(result).toEqual([]);
    expect(prisma.staffShiftRequest.findMany).toHaveBeenCalled();
  });

  it("returns an empty array for a manager whose store scope does not include the staff's store", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", role: "manager" } } as never);
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({ id: 3, staffId: null } as never);
    vi.mocked(getCurrentAdminStoreScope).mockResolvedValue({
      isUnrestricted: false,
      storeIds: [2],
    });
    vi.mocked(prisma.staff.findUnique).mockResolvedValue({ id: 42, storeId: 1 } as never);

    const result = await getStaffShiftRequests(42, "2026-10");

    expect(result).toEqual([]);
    expect(prisma.staffShiftRequest.findMany).not.toHaveBeenCalled();
  });

  it("returns the requests for an hq caller regardless of store scope", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "5", role: "hq" } } as never);
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({ id: 5, staffId: null } as never);
    vi.mocked(getCurrentAdminStoreScope).mockResolvedValue({
      isUnrestricted: true,
      storeIds: [],
    });
    vi.mocked(prisma.staff.findUnique).mockResolvedValue({ id: 42, storeId: 1 } as never);
    vi.mocked(prisma.staffShiftRequest.findMany).mockResolvedValue([
      {
        workDate: new Date("2026-10-01T00:00:00.000Z"),
        isDayOffRequested: false,
        preferredStartTime: new Date("1970-01-01T10:00:00.000Z"),
        preferredEndTime: new Date("1970-01-01T15:00:00.000Z"),
      },
    ] as never);

    const result = await getStaffShiftRequests(42, "2026-10");

    expect(result).toEqual([
      {
        workDate: "2026-10-01",
        isDayOffRequested: false,
        preferredStartMinutes: 600,
        preferredEndMinutes: 900,
      },
    ]);
    expect(prisma.staffShiftRequest.findMany).toHaveBeenCalled();
  });

  it("returns an empty array without querying shift requests when the staffId does not exist", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", role: "manager" } } as never);
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({ id: 3, staffId: null } as never);
    vi.mocked(prisma.staff.findUnique).mockResolvedValue(null as never);

    const result = await getStaffShiftRequests(999, "2026-10");

    expect(result).toEqual([]);
    expect(prisma.staffShiftRequest.findMany).not.toHaveBeenCalled();
  });
});

describe("saveStaffShiftRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unauthorized when the caller is not the linked staff member", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "9", role: "staff" } } as never);
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({ id: 9, staffId: 99 } as never);

    const result = await saveStaffShiftRequest({
      staffId: 42,
      workDate: "2026-10-01",
      isDayOffRequested: false,
      preferredStartMinutes: 600,
      preferredEndMinutes: 900,
    });

    expect(result).toEqual({ status: "unauthorized" });
    expect(prisma.staffShiftRequest.upsert).not.toHaveBeenCalled();
  });

  it("upserts the request when the caller is the linked staff member", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "staff" } } as never);
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({ id: 7, staffId: 42 } as never);

    const result = await saveStaffShiftRequest({
      staffId: 42,
      workDate: "2026-10-01",
      isDayOffRequested: false,
      preferredStartMinutes: 600,
      preferredEndMinutes: 900,
    });

    expect(result).toEqual({ status: "saved" });
    expect(prisma.staffShiftRequest.upsert).toHaveBeenCalledWith({
      where: {
        staffId_workDate: { staffId: 42, workDate: new Date("2026-10-01T00:00:00.000Z") },
      },
      create: {
        staffId: 42,
        workDate: new Date("2026-10-01T00:00:00.000Z"),
        isDayOffRequested: false,
        preferredStartTime: new Date("1970-01-01T10:00:00.000Z"),
        preferredEndTime: new Date("1970-01-01T15:00:00.000Z"),
      },
      update: {
        isDayOffRequested: false,
        preferredStartTime: new Date("1970-01-01T10:00:00.000Z"),
        preferredEndTime: new Date("1970-01-01T15:00:00.000Z"),
      },
    });
  });

  it("upserts null preferred times when a day-off is requested without preferred times", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "staff" } } as never);
    vi.mocked(prisma.admin.findUnique).mockResolvedValue({ id: 7, staffId: 42 } as never);

    const result = await saveStaffShiftRequest({
      staffId: 42,
      workDate: "2026-10-01",
      isDayOffRequested: true,
      preferredStartMinutes: null,
      preferredEndMinutes: null,
    });

    expect(result).toEqual({ status: "saved" });
    expect(prisma.staffShiftRequest.upsert).toHaveBeenCalledWith({
      where: {
        staffId_workDate: { staffId: 42, workDate: new Date("2026-10-01T00:00:00.000Z") },
      },
      create: {
        staffId: 42,
        workDate: new Date("2026-10-01T00:00:00.000Z"),
        isDayOffRequested: true,
        preferredStartTime: null,
        preferredEndTime: null,
      },
      update: {
        isDayOffRequested: true,
        preferredStartTime: null,
        preferredEndTime: null,
      },
    });
  });
});

describe("listShiftRequestsForStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unauthorized for a non-manager role", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7", role: "staff" } } as never);

    const result = await listShiftRequestsForStore(1, "2026-10");

    expect(result).toEqual({ status: "unauthorized" });
  });

  it("returns unauthorized when the store is outside the manager's scope", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", role: "manager" } } as never);
    vi.mocked(getCurrentAdminStoreScope).mockResolvedValue({
      isUnrestricted: false,
      storeIds: [2],
    });

    const result = await listShiftRequestsForStore(1, "2026-10");

    expect(result).toEqual({ status: "unauthorized" });
  });

  it("returns requests grouped by staffId for an authorized manager", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", role: "manager" } } as never);
    vi.mocked(getCurrentAdminStoreScope).mockResolvedValue({
      isUnrestricted: false,
      storeIds: [1],
    });
    vi.mocked(prisma.staff.findMany).mockResolvedValue([{ id: 42 }, { id: 43 }] as never);
    vi.mocked(prisma.staffShiftRequest.findMany).mockResolvedValue([
      {
        staffId: 42,
        workDate: new Date("2026-10-01T00:00:00.000Z"),
        isDayOffRequested: true,
        preferredStartTime: null,
        preferredEndTime: null,
      },
    ] as never);

    const result = await listShiftRequestsForStore(1, "2026-10");

    expect(result).toEqual({
      status: "ok",
      requestsByStaffId: {
        42: [
          {
            workDate: "2026-10-01",
            isDayOffRequested: true,
            preferredStartMinutes: null,
            preferredEndMinutes: null,
          },
        ],
      },
    });
  });

  it("returns an empty requestsByStaffId when the store has no active staff", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", role: "manager" } } as never);
    vi.mocked(getCurrentAdminStoreScope).mockResolvedValue({
      isUnrestricted: false,
      storeIds: [1],
    });
    vi.mocked(prisma.staff.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.staffShiftRequest.findMany).mockResolvedValue([] as never);

    const result = await listShiftRequestsForStore(1, "2026-10");

    expect(result).toEqual({ status: "ok", requestsByStaffId: {} });
  });
});
