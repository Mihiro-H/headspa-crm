export interface CustomerFilterCondition {
  name?: string;
  phone?: string;
  statusId?: number;
  storeId?: number;
}

// 無効化（退会・不正利用等）された顧客は、常にセグメント配信の対象から除外する。
export function buildMemberWhereClause(condition: CustomerFilterCondition) {
  return {
    isActive: true,
    ...(condition.name
      ? { name: { contains: condition.name, mode: "insensitive" as const } }
      : {}),
    ...(condition.phone ? { phone: { contains: condition.phone } } : {}),
    ...(condition.statusId ? { statusId: condition.statusId } : {}),
    ...(condition.storeId ? { primaryStoreId: condition.storeId } : {}),
  };
}
