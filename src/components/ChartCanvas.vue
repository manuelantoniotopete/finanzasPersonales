<script setup>
/* Envoltura reactiva de Chart.js. Recibe una config completa y reconstruye
   la instancia cuando cambia (datos o tema). Si `config` es null, muestra vacío. */
import { ref, shallowRef, onMounted, onBeforeUnmount, watch } from "vue";
import Chart from "chart.js/auto";
import { themeColors } from "../utils/charts.js";

const props = defineProps({
  config: { type: Object, default: null },
});

const canvas = ref(null);
const chart = shallowRef(null);

function destroy() {
  if (chart.value) { chart.value.destroy(); chart.value = null; }
}

function build() {
  destroy();
  if (!canvas.value || !props.config) return;
  // Sincroniza el color/fuente por defecto con el tema activo (claro/oscuro).
  Chart.defaults.color = themeColors().soft;
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  chart.value = new Chart(canvas.value, props.config);
}

onMounted(build);
onBeforeUnmount(destroy);
// flush:"post" → corre tras el repintado del DOM, así el <canvas> ya existe
// cuando la config pasa de null (estado vacío) a un objeto con datos.
watch(() => props.config, build, { flush: "post" });
</script>

<template>
  <div v-if="!config" class="empty" style="padding:40px 0">
    <div class="empty-ico">📭</div>
    <p>Sin datos para mostrar</p>
  </div>
  <canvas v-else ref="canvas"></canvas>
</template>
