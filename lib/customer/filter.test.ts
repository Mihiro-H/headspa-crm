import { describe, it, expect } from "vitest";
import { buildMemberWhereClause } from "./filter";

describe("buildMemberWhereClause", () => {
  it("always excludes inactive members, even with no other condition fields", () => {
    expect(buildMemberWhereClause({})).toEqual({ isActive: true });
  });

  it("includes a case-insensitive name filter when name is given", () => {
    expect(buildMemberWhereClause({ name: "田中" })).toEqual({
      isActive: true,
      name: { contains: "田中", mode: "insensitive" },
    });
  });

  it("includes a phone filter when phone is given", () => {
    expect(buildMemberWhereClause({ phone: "090" })).toEqual({
      isActive: true,
      phone: { contains: "090" },
    });
  });

  it("includes statusId and primaryStoreId filters when given", () => {
    expect(buildMemberWhereClause({ statusId: 2, storeId: 1 })).toEqual({
      isActive: true,
      statusId: 2,
      primaryStoreId: 1,
    });
  });

  it("combines all given filters together", () => {
    expect(
      buildMemberWhereClause({ name: "田中", phone: "090", statusId: 2, storeId: 1 }),
    ).toEqual({
      isActive: true,
      name: { contains: "田中", mode: "insensitive" },
      phone: { contains: "090" },
      statusId: 2,
      primaryStoreId: 1,
    });
  });
});
