const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// PrismaのDateTime（UTCで保存・toISOString()で渡される）を、管理画面表示用に
// 日本時間（JST, UTC+9固定）の "YYYY-MM-DD HH:MM" 形式へ変換する。
// 実行環境（サーバー・ブラウザ）のローカルタイムゾーンに依存させたくないため、
// toLocaleString等ではなく、UTC値に9時間を加算してからUTCメソッドで読み出す。
export function formatDateTimeJst(isoString: string): string {
  const jst = new Date(new Date(isoString).getTime() + JST_OFFSET_MS);
  const year = jst.getUTCFullYear();
  const month = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  const hours = String(jst.getUTCHours()).padStart(2, "0");
  const minutes = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
