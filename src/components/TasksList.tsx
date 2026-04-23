import { useState, useCallback, useMemo } from "react";
import { z } from "zod";
import type { Task } from "../types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Modal } from "./ui/modal";
import styles from "./TasksList.module.scss";

const taskSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Название обязательно")
    .max(100, "Максимум 100 символов"),
  url: z
    .string()
    .trim()
    .min(1, "Ссылка обязательна")
    .url("Некорректный URL (пример: https://...)"),
  description: z
    .string()
    .trim()
    .max(300, "Максимум 300 символов")
    .optional()
    .or(z.literal("")),
});

type TaskFormData = z.infer<typeof taskSchema>;
type FieldErrors = Partial<Record<keyof TaskFormData, string>>;

interface TasksListProps {
  tasks: Task[];
  isCreator: boolean;
  onAddTask: (name: string, url: string, description?: string) => void;
  onRemoveTask: (taskId: string) => void;
  onUpdateTask: (
    taskId: string,
    updates: { name?: string; url?: string; description?: string },
  ) => void;
}

function useTaskForm(initial: TaskFormData = { name: "", url: "", description: "" }) {
  const [values, setValues] = useState<TaskFormData>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});

  const setValue = useCallback(
    (field: keyof TaskFormData, value: string) => {
      setValues((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    [],
  );

  const validate = useCallback((): TaskFormData | null => {
    const result = taskSchema.safeParse(values);
    if (result.success) {
      setErrors({});
      return result.data;
    }

    const fieldErrors: FieldErrors = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof TaskFormData;
      if (!fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    setErrors(fieldErrors);
    return null;
  }, [values]);

  const reset = useCallback((next?: TaskFormData) => {
    setValues(next ?? { name: "", url: "", description: "" });
    setErrors({});
  }, []);

  return { values, errors, setValue, validate, reset };
}

export function TasksList({
  tasks,
  isCreator,
  onAddTask,
  onRemoveTask,
  onUpdateTask,
}: TasksListProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const addForm = useTaskForm();
  const editForm = useTaskForm();

  const openAddModal = () => {
    addForm.reset();
    setIsAddModalOpen(true);
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
  };

  const handleAdd = () => {
    const data = addForm.validate();
    if (!data) return;

    onAddTask(data.name, data.url, data.description || undefined);
    closeAddModal();
  };

  const openEditModal = (task: Task) => {
    editForm.reset({
      name: task.name,
      url: task.url,
      description: task.description || "",
    });
    setEditingTask(task);
  };

  const closeEditModal = () => {
    setEditingTask(null);
  };

  const handleUpdate = () => {
    if (!editingTask) return;
    const data = editForm.validate();
    if (!data) return;

    onUpdateTask(editingTask.taskId, {
      name: data.name,
      url: data.url,
      description: data.description || "",
    });
    closeEditModal();
  };

  const sortedTasks = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }),
    [tasks],
  );

  return (
    <div className={styles.container}>
      {tasks.length === 0 && (
        <p className={styles.empty}>Задачи пока не добавлены</p>
      )}

      <ul className={styles.list}>
        {sortedTasks.map((task) => (
          <li key={task.taskId} className={styles.item}>
            <div className={styles.taskRow}>
              <div className={styles.taskInfo}>
                <a
                  href={task.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.taskLink}
                >
                  {task.name}
                </a>
                {task.description && (
                  <span className={styles.taskDescription}>
                    {task.description}
                  </span>
                )}
              </div>
              {isCreator && (
                <div className={styles.taskActions}>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => openEditModal(task)}
                    title="Редактировать"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={`${styles.iconButton} ${styles.deleteButton}`}
                    onClick={() => onRemoveTask(task.taskId)}
                    title="Удалить"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {isCreator && (
        <Button
          variant="outline"
          size="sm"
          onClick={openAddModal}
          className={styles.addButton}
        >
          + Добавить задачу
        </Button>
      )}

      <Modal
        open={isAddModalOpen}
        onClose={closeAddModal}
        title="Добавить задачу"
      >
        <TaskFormFields
          values={addForm.values}
          errors={addForm.errors}
          onChange={addForm.setValue}
          onSubmit={handleAdd}
          submitLabel="Добавить"
          onCancel={closeAddModal}
        />
      </Modal>

      <Modal
        open={!!editingTask}
        onClose={closeEditModal}
        title="Редактировать задачу"
      >
        <TaskFormFields
          values={editForm.values}
          errors={editForm.errors}
          onChange={editForm.setValue}
          onSubmit={handleUpdate}
          submitLabel="Сохранить"
          onCancel={closeEditModal}
        />
      </Modal>
    </div>
  );
}

interface TaskFormFieldsProps {
  values: TaskFormData;
  errors: FieldErrors;
  onChange: (field: keyof TaskFormData, value: string) => void;
  onSubmit: () => void;
  submitLabel: string;
  onCancel: () => void;
}

function TaskFormFields({
  values,
  errors,
  onChange,
  onSubmit,
  submitLabel,
  onCancel,
}: TaskFormFieldsProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className={styles.modalForm}>
      <div className={styles.field}>
        <label className={styles.label}>
          Название <span className={styles.required}>*</span>
        </label>
        <Input
          value={values.name}
          onChange={(e) => onChange("name", e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="WEB-1234"
          autoFocus
          className={errors.name ? styles.inputError : ""}
        />
        {errors.name && <span className={styles.errorText}>{errors.name}</span>}
      </div>

      <div className={styles.field}>
        <label className={styles.label}>
          Ссылка <span className={styles.required}>*</span>
        </label>
        <Input
          value={values.url}
          onChange={(e) => onChange("url", e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="https://jira.example.com/browse/WEB-1234"
          className={errors.url ? styles.inputError : ""}
        />
        {errors.url && <span className={styles.errorText}>{errors.url}</span>}
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Описание</label>
        <Input
          value={values.description ?? ""}
          onChange={(e) => onChange("description", e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Краткое описание (необязательно)"
        />
        {errors.description && (
          <span className={styles.errorText}>{errors.description}</span>
        )}
      </div>

      <div className={styles.modalActions}>
        <Button variant="outline" size="sm" onClick={onCancel}>
          Отмена
        </Button>
        <Button variant="default" size="sm" onClick={onSubmit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
