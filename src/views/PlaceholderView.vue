<script setup>
import { useRoute } from "vue-router";
const route = useRoute();
</script>

<template>
  <div class="view-head">
    <div>
      <div class="view-title">{{ route.meta.title }}</div>
      <div class="view-sub">Módulo pendiente de migrar</div>
    </div>
  </div>

  <div class="empty">
    <div class="empty-ico">🚧</div>
    <h3>En construcción</h3>
    <p>Esta sección se migrará en la {{ route.meta.etapa }} de la conversión a Vue.</p>
  </div>
</template>
