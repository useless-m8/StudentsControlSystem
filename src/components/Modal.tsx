import type { ReactNode } from "react";
import { Button } from "./Button";

type ModalProps = {
  title: string;
  open: boolean;
  children: ReactNode;
  onClose: () => void;
};

export function Modal({ title, open, children, onClose }: ModalProps) {
  if (!open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-header">
          <h2>{title}</h2>
          <Button type="button" variant="secondary" onClick={onClose}>
            Закрыть
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
