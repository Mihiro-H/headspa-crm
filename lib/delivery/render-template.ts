const MERGE_TAG_PATTERN = /\{\{(.+?)\}\}/g;

export function renderTemplate(text: string, tags: Record<string, string>): string {
  return text.replace(MERGE_TAG_PATTERN, (match, key: string) => {
    const trimmedKey = key.trim();
    return trimmedKey in tags ? tags[trimmedKey] : match;
  });
}
