import { useState, type FormEvent } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { sanitizeName, validateName } from "../lib/utils";
import styles from "./NameInput.module.scss";

interface NameInputProps {
  onSubmit: (name: string) => void;
  error?: string | null;
  isLoading?: boolean;
}

export const NameInput = ({ onSubmit, error, isLoading }: NameInputProps) => {
  const [name, setName] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    // Санитизируем ввод в реальном времени
    const sanitized = sanitizeName(inputValue);
    setName(sanitized);
    
    // Очищаем ошибку валидации при изменении
    if (validationError) {
      setValidationError(null);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    
    if (!trimmed) {
      setValidationError("Имя не может быть пустым");
      return;
    }
    
    // Валидируем имя
    const validation = validateName(trimmed);
    if (!validation.isValid) {
      setValidationError(validation.errorMessage || "Некорректное имя");
      return;
    }
    
    // Отправляем санитизированное имя
    const sanitized = sanitizeName(trimmed);
    onSubmit(sanitized);
    setValidationError(null);
  };

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <CardHeader>
          <CardTitle>Добро пожаловать в Planning Poker</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <Input
                type="text"
                placeholder="Введите ваше имя"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                className={styles.input}
                autoFocus
              />
              {(error || validationError) && (
                <p className={styles.error}>{error || validationError}</p>
              )}
            </div>
            <Button
              type="submit"
              disabled={!name.trim() || isLoading}
              className={styles.button}
            >
              {isLoading ? "Подключение..." : "Присоединиться"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
