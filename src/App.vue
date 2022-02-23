<template>
  <div id="app">
    <input type="file" accept="application/pdf" @change="renderPDF">
    <button @click="spawnText">SPAWN TEXT</button>
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
      this.$refs.viewer.canvas.add(new fabric.Text("HELLO PDF WORLD"))
    }
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
