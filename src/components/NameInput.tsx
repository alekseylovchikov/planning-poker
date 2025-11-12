import { useState, FormEvent } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import styles from "./NameInput.module.scss";

interface NameInputProps {
  onSubmit: (name: string) => void;
  error?: string | null;
  isLoading?: boolean;
}

export const NameInput = ({ onSubmit, error, isLoading }: NameInputProps) => {
  const [name, setName] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim());
    }
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
              {error && <p className={styles.error}>{error}</p>}
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

