/* Toast global (singleton reactivo). Reemplaza toast() del app.js. */
import { reactive } from "vue";

const state = reactive({ message: "", visible: false });
let timer = null;

export function toast(msg) {
  state.message = msg;
  state.visible = true;
  clearTimeout(timer);
  timer = setTimeout(() => { state.visible = false; }, 2200);
}

export function useToast() {
  return { state, toast };
}
