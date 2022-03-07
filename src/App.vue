<template>
  <div id="app">
    <input v-if="!file" type="file" accept="application/pdf" @change="renderPDF">
    <button @click="spawnText">SPAWN TEXT</button>
    <button @click="previusPage">PREVIUS PAGE</button>
    <button @click="nextPage">NEXT PAGE</button>
    <viewer ref="viewer" v-if="file" style="height: 100%; width: 100%" :pdf="file"></viewer>
  </div>
</template>
<script lang="ts">
import Vue from "vue";
import Viewer from "@/components/Viewer.vue";
import {fabric} from "fabric";

export default Vue.extend({
  components: {Viewer},
  methods: {
    async renderPDF(event) {
      this.file = event.target.files[0];
    },
    spawnText(){
      const wInitialSize = 200;
      const hInitialSize = 100;

      this.$refs.viewer.addField()
    },
    nextPage(){
      this.$refs.viewer.setPage(this.$refs.viewer.currentPage + 1);
    },
    previusPage(){
      this.$refs.viewer.setPage(this.$refs.viewer.currentPage - 1);
    },
  },
  data() {
    return {
      file: null
    };
  }
})
</script>
<style>
#app {
  height: 100%;
  width: 100%;
  position: absolute;
}
body{
  margin: 0;
}
</style>
