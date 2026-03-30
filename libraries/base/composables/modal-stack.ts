import type { Component } from "vue";
import ConfirmationModal from "../components/ConfirmationModal.vue";
import NotificationModal from "../components/NotificationModal.vue";
import TextInputModal from "../components/TextInputModal.vue";

export type ModalCallbackType<T extends ModalType> = (
  event: ModalEvents[T],
  close: () => void,
  ...args: any[]
) => Promise<void> | void;

export interface ModalStackElement<T extends ModalType> {
  component: Component;
  type: T;
  callback: ModalCallbackType<T>;
  loading: Ref<boolean>;
  data: ModalDatas[T];
}

export enum ModalType {
  Confirmation,
  Notification,
  TextInput
}

export type ModalEvents = {
  [ModalType.Confirmation]: "confirm" | "cancel";
  [ModalType.Notification]: "close";
  [ModalType.TextInput]: "cancel" | "submit"
};

export type ModalDatas = {
  [ModalType.Confirmation]: {
    title: string;
    description: string;
    buttonText?: string;
  };
  [ModalType.Notification]: {
    title: string;
    description: string;
    buttonText?: string;
  };
  [ModalType.TextInput]: {
    title: string,
    description: string,
    buttonText?: string,
    dft?: string,
    placeholder?: string,
  }
};

const modalComponents: { [key in ModalType]: Component } = {
  [ModalType.Confirmation]: ConfirmationModal,
  [ModalType.Notification]: NotificationModal,
  [ModalType.TextInput]: TextInputModal,
};

export function createModal<T extends ModalType>(
  type: T,
  data: ModalDatas[T],
  callback: ModalCallbackType<T>
) {
  const modalStack = useModalStack();
  modalStack.value.push({
    type,
    component: modalComponents[type],
    data,
    callback,
    loading: ref(false),
  });
}

export const useModalStack = () =>
  useState<Array<ModalStackElement<any>>>("modal-stack", () => []);
