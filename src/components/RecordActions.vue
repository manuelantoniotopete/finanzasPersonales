<script setup>
/* Celda de acciones (editar / eliminar) para las filas de tabla.
   Equivale a actionsCell() del app.js vanilla. */
const emit = defineEmits(["edit", "del"]);
</script>

<template>
  <td class="t-actions">
    <button class="icon-btn" title="Editar" @click="emit('edit')">✏️</button>
    <button class="icon-btn" title="Eliminar" @click="emit('del')">🗑️</button>
  </td>
</template>
