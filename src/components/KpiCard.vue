<script setup>
defineProps({
  label: { type: String, default: "" },
  value: { type: String, default: "" },
  cls: { type: String, default: "" },   // "" | "pos" | "neg"
  foot: { type: String, default: "" },
});
</script>

<template>
  <div class="kpi">
    <div class="kpi-label">{{ label }}</div>
    <div class="kpi-value" :class="cls">{{ value }}</div>
    <div class="kpi-foot">{{ foot }}</div>
  </div>
</template>
