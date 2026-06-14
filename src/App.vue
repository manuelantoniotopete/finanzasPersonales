<script setup>
import { ref, onMounted } from "vue";
import { useFinanzas } from "./store/finanzas.js";
import AppSidebar from "./components/AppSidebar.vue";
import AppTopbar from "./components/AppTopbar.vue";
import AppModal from "./components/AppModal.vue";
import AppToast from "./components/AppToast.vue";

const store = useFinanzas();
const navOpen = ref(false);

function closeNav() { navOpen.value = false; }

onMounted(() => {
  store.load();
  store.applyTheme(store.theme);
});
</script>

<template>
  <AppSidebar :open="navOpen" @navigate="closeNav" />

  <div class="main">
    <AppTopbar @toggle-menu="navOpen = !navOpen" />
    <main class="content">
      <RouterView />
    </main>
  </div>

  <div class="nav-scrim" :class="{ show: navOpen }" @click="closeNav"></div>

  <AppModal />
  <AppToast />
</template>
