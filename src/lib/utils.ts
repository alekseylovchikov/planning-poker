import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Максимальная длина имени пользователя
const MAX_NAME_LENGTH = 50;

// Минимальная длина имени пользователя
const MIN_NAME_LENGTH = 1;

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

/**
 * Валидирует имя пользователя
 * @returns объект с isValid и errorMessage
 */
export function validateName(name: string): {
  isValid: boolean;
  errorMessage?: string;
} {
  const trimmed = name.trim();

  if (trimmed.length < MIN_NAME_LENGTH) {
    return { isValid: false, errorMessage: "Имя не может быть пустым" };
  }

  if (trimmed.length > MAX_NAME_LENGTH) {
    return {
      isValid: false,
      errorMessage: `Имя не может быть длиннее ${MAX_NAME_LENGTH} символов`,
    };
  }

  // Проверяем на HTML теги
  if (/<[^>]*>/.test(trimmed)) {
    return { isValid: false, errorMessage: "Имя не может содержать HTML теги" };
  }

  // Проверяем на опасные символы
  if (/[<>]/.test(trimmed)) {
    return {
      isValid: false,
      errorMessage: "Имя содержит недопустимые символы",
    };
  }

  return { isValid: true };
}

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
