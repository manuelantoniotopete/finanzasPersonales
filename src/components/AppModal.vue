<script setup>
import { computed } from "vue";
import { useModal } from "../composables/useModal.js";

const { state, closeModal, submitModal } = useModal();

function optValue(o) { return (o && typeof o === "object") ? o.value : o; }
function optLabel(o) { return (o && typeof o === "object") ? o.label : o; }

// Campos que ocupan dos columnas (span:2) o son checkbox.
function fieldClass(f) {
  return ["field", f.span === 2 ? "row2" : "", f.type === "checkbox" ? "field-check row2" : ""]
    .filter(Boolean).join(" ");
}

const visible = computed(() => state.open);
</script>

<template>
  <div v-if="visible" class="modal-backdrop" @click.self="closeModal">
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-head">
        <h3>{{ state.title }}</h3>
        <button class="icon-btn" type="button" @click="closeModal">✕</button>
      </div>

      <form class="modal-form" @submit.prevent="submitModal">
        <div class="field-grid">
          <div v-for="f in state.fields" :key="f.k" :class="fieldClass(f)">
            <!-- Checkbox -->
            <template v-if="f.type === 'checkbox'">
              <input :id="`f_${f.k}`" type="checkbox" class="chk" v-model="state.model[f.k]" />
              <label :for="`f_${f.k}`">{{ f.label }}</label>
            </template>

            <!-- Select -->
            <template v-else-if="f.type === 'select'">
              <label :for="`f_${f.k}`">{{ f.label }}<span v-if="f.required"> *</span></label>
              <select :id="`f_${f.k}`" v-model="state.model[f.k]">
                <option value="">—</option>
                <option v-for="o in f.options" :key="optValue(o)" :value="optValue(o)">{{ optLabel(o) }}</option>
              </select>
            </template>

            <!-- Textarea -->
            <template v-else-if="f.type === 'textarea'">
              <label :for="`f_${f.k}`">{{ f.label }}<span v-if="f.required"> *</span></label>
              <textarea :id="`f_${f.k}`" v-model="state.model[f.k]" placeholder="Opcional…"></textarea>
            </template>

            <!-- text / number / date / month -->
            <template v-else>
              <label :for="`f_${f.k}`">{{ f.label }}<span v-if="f.required"> *</span></label>
              <input
                :id="`f_${f.k}`"
                :type="f.type"
                v-model="state.model[f.k]"
                :step="f.type === 'number' ? '0.01' : undefined"
                :min="f.min != null ? f.min : undefined"
                :max="f.max != null ? f.max : undefined"
                :list="f.datalist ? `dl_${f.k}` : undefined"
                :required="f.required || undefined"
              />
              <datalist v-if="f.datalist" :id="`dl_${f.k}`">
                <option v-for="o in f.datalist" :key="o" :value="o"></option>
              </datalist>
            </template>
          </div>
        </div>
      </form>

      <div class="modal-foot">
        <button class="btn btn-ghost" type="button" @click="closeModal">Cancelar</button>
        <button class="btn btn-primary" type="button" @click="submitModal">Guardar</button>
      </div>
    </div>
  </div>
</template>
