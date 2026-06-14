<script setup>
import { ref } from "vue";
import { storeToRefs } from "pinia";
import { useFinanzas } from "../store/finanzas.js";
import { toast } from "../composables/useToast.js";
import { isoToday } from "../utils/format.js";

const emit = defineEmits(["toggle-menu"]);

const store = useFinanzas();
const { currentMonth, theme } = storeToRefs(store);

function onMonthChange(e) { store.setMonth(e.target.value); }

// ----- Importar -----
const showImport = ref(false);
const importText = ref("");
const fileInput = ref(null);

function openImport() { importText.value = ""; showImport.value = true; }
function pickFile() { fileInput.value?.click(); }
function onFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    importText.value = reader.result;
    toast("Archivo cargado, revisa y pulsa Importar");
    e.target.value = "";
  };
  reader.readAsText(file);
}
function doImport() {
  const txt = importText.value.trim();
  if (!txt) { toast("Pega un JSON o carga un archivo"); return; }
  try {
    store.importFromText(txt);
    showImport.value = false;
    toast("📥 Datos importados correctamente");
  } catch (err) {
    alert("El JSON no es válido.\n\n" + err.message);
  }
}

// ----- Exportar -----
const showExport = ref(false);
const exportText = ref("");
function openExport() { exportText.value = store.exportJSON(); showExport.value = true; }
function copyExport() {
  const done = () => toast("📋 Copiado al portapapeles");
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(exportText.value).then(done, fallbackCopy);
  } else fallbackCopy();
  function fallbackCopy() {
    const ta = document.getElementById("dlgExportText");
    if (!ta) return;
    ta.focus(); ta.select();
    try { document.execCommand("copy"); done(); }
    catch { toast("No se pudo copiar; selecciónalo y copia manualmente"); }
  }
}
function downloadExport() {
  const blob = new Blob([exportText.value], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `finanzas-${isoToday()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast("📤 JSON descargado");
}

// ----- Demo -----
function loadDemo() {
  if (store.hasData() && !confirm("Esto reemplazará tus datos actuales con datos de ejemplo. ¿Continuar?")) return;
  store.loadSample();
  toast("✨ Datos de ejemplo cargados");
}
</script>

<template>
  <header class="topbar">
    <div class="topbar-left">
      <button class="icon-btn only-mobile" title="Menú" @click="emit('toggle-menu')">☰</button>
      <div class="month-picker">
        <button class="icon-btn" title="Mes anterior" @click="store.shiftMonthBy(-1)">‹</button>
        <input type="month" class="month-input" :value="currentMonth" @change="onMonthChange" />
        <button class="icon-btn" title="Mes siguiente" @click="store.shiftMonthBy(1)">›</button>
      </div>
    </div>

    <div class="topbar-right">
      <button class="btn btn-ghost" title="Cargar un archivo JSON" @click="openImport">⬆️ <span class="lbl">Importar</span></button>
      <button class="btn btn-ghost" title="Descargar tus datos como JSON" @click="openExport">⬇️ <span class="lbl">Exportar</span></button>
      <button class="btn btn-ghost" title="Cargar datos de ejemplo" @click="loadDemo">✨ <span class="lbl">Demo</span></button>
      <button class="icon-btn" title="Cambiar tema" @click="store.toggleTheme()">{{ theme === 'dark' ? '☀️' : '🌙' }}</button>
      <input ref="fileInput" type="file" accept="application/json,.json" hidden @change="onFile" />
    </div>
  </header>

  <!-- Diálogo Importar -->
  <div v-if="showImport" class="modal-backdrop" @click.self="showImport = false">
    <div class="modal modal-lg">
      <div class="modal-head"><h3>Importar datos</h3><button class="icon-btn" @click="showImport = false">✕</button></div>
      <div class="dlg-body">
        <p class="dlg-hint">Pega aquí tu JSON, o carga un archivo. Esto <b>reemplazará</b> tus datos actuales (exporta antes si quieres respaldo).</p>
        <textarea v-model="importText" class="dlg-textarea" placeholder='Pega aquí tu JSON…  { "version": 1, "moneda": "MXN", ... }'></textarea>
        <div><button class="btn btn-ghost btn-sm" @click="pickFile">📂 Cargar desde archivo…</button></div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" @click="showImport = false">Cancelar</button>
        <button class="btn btn-primary" @click="doImport">Importar</button>
      </div>
    </div>
  </div>

  <!-- Diálogo Exportar -->
  <div v-if="showExport" class="modal-backdrop" @click.self="showExport = false">
    <div class="modal modal-lg">
      <div class="modal-head"><h3>Exportar datos</h3><button class="icon-btn" @click="showExport = false">✕</button></div>
      <div class="dlg-body">
        <p class="dlg-hint">Copia este JSON al portapapeles o descárgalo como respaldo.</p>
        <textarea id="dlgExportText" :value="exportText" class="dlg-textarea" readonly></textarea>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" @click="showExport = false">Cerrar</button>
        <button class="btn btn-ghost" @click="downloadExport">⬇️ Descargar</button>
        <button class="btn btn-primary" @click="copyExport">📋 Copiar</button>
      </div>
    </div>
  </div>
</template>
