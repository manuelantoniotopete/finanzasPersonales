<script setup>
import { openModal } from "../composables/useModal.js";

defineProps({
  mod: { type: String, default: "" },
  title: { type: String, default: "" },
  sub: { type: String, default: "" },
  icon: { type: String, default: "🗂️" },
});
</script>

<template>
  <div class="empty">
    <div class="empty-ico">{{ icon }}</div>
    <h3>{{ title }}</h3>
    <p>{{ sub }}</p>
    <button v-if="mod" class="btn btn-primary" @click="openModal(mod)">＋ Agregar el primero</button>
  </div>
</template>
