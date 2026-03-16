/**
 * Санитизирует имя пользователя, удаляя HTML теги и опасные символы
 */
export function sanitizeName(name: string): string {
    // Удаляем HTML теги
    const withoutTags = name.replace(/<[^>]*>/g, "");
    // Удаляем опасные символы, но оставляем обычные буквы, цифры, пробелы и некоторые символы
    const sanitized = withoutTags.replace(/[<>]/g, "");
    return sanitized.trim();
}
