import { MAX_NAME_LENGTH } from "./constants";

/**
 * Обрезает имя пользователя до максимальной длины с добавлением многоточия
 */
export function truncateName(
    name: string,
    maxLength: number = MAX_NAME_LENGTH
): string {
    if (name.length <= maxLength) {
        return name;
    }
    return name.substring(0, maxLength - 3) + "...";
}
