import { MAX_NAME_LENGTH, MIN_NAME_LENGTH } from "./constants";

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
    return { isValid: false, errorMessage: 'Имя не может быть пустым' };
  }

  if (trimmed.length > MAX_NAME_LENGTH) {
    return {
      isValid: false,
      errorMessage: `Имя не может быть длиннее ${MAX_NAME_LENGTH} символов`,
    };
  }

  // Проверяем на HTML теги
  if (/<[^>]*>/.test(trimmed)) {
    return { isValid: false, errorMessage: 'Имя не может содержать HTML теги' };
  }

  // Проверяем на опасные символы
  if (/[<>]/.test(trimmed)) {
    return {
      isValid: false,
      errorMessage: 'Имя содержит недопустимые символы',
    };
  }

  return { isValid: true };
}
