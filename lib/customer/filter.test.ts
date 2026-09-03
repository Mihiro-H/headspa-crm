import { describe, it, expect } from "vitest";
import { buildMemberWhereClause } from "./filter";

describe("buildMemberWhereClause", () => {
  it("returns an empty object when no condition fields are given", () => {
    expect(buildMemberWhereClause({})).toEqual({});
  });

  it("includes a case-insensitive name filter when name is given", () => {
    expect(buildMemberWhereClause({ name: "田中" })).toEqual({
      name: { contains: "田中", mode: "insensitive" },
    });
  });

  it("includes a phone filter when phone is given", () => {
    expect(buildMemberWhereClause({ phone: "090" })).toEqual({
      phone: { contains: "090" },
    });
  });

  it("includes statusId and primaryStoreId filters when given", () => {
    expect(buildMemberWhereClause({ statusId: 2, storeId: 1 })).toEqual({
      statusId: 2,
      primaryStoreId: 1,
    });
  });

  it("combines all given filters together", () => {
    expect(
      buildMemberWhereClause({ name: "田中", phone: "090", statusId: 2, storeId: 1 }),
    ).toEqual({
      name: { contains: "田中", mode: "insensitive" },
      phone: { contains: "090" },
      statusId: 2,
      primaryStoreId: 1,
    });
  });
});
