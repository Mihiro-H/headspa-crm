export interface CustomerFilterCondition {
  name?: string;
  phone?: string;
  statusId?: number;
  storeId?: number;
}

export function buildMemberWhereClause(condition: CustomerFilterCondition) {
  return {
    ...(condition.name
      ? { name: { contains: condition.name, mode: "insensitive" as const } }
      : {}),
    ...(condition.phone ? { phone: { contains: condition.phone } } : {}),
    ...(condition.statusId ? { statusId: condition.statusId } : {}),
    ...(condition.storeId ? { primaryStoreId: condition.storeId } : {}),
  };
}
