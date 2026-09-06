"use client";

import { Dialog } from "radix-ui";
import { X } from "lucide-react";

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ open, onOpenChange, title, children }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[85vh] w-[90vw] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-0 p-6 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="font-heading text-lg text-primary-700">{title}</Dialog.Title>
            <Dialog.Close
              className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
              aria-label="閉じる"
            >
              <X size={18} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
