export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .replace(/^-|-$/g, '')
}

export function generateUniqueSlug(base: string, suffix?: string | number): string {
  const slug = generateSlug(base)
  return suffix ? `${slug}-${suffix}` : slug
}
