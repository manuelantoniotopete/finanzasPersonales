<script setup>
import { useToast } from "../composables/useToast.js";
const { state } = useToast();
</script>

<template>
  <div class="toast" :class="{ show: state.visible }" :hidden="!state.visible">
    {{ state.message }}
  </div>
</template>
