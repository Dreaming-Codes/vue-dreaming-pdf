<template>
  <div id="app">
    <input v-if="!file" type="file" accept="application/pdf" @change="renderPDF">
    <button @click="spawnText">SPAWN TEXT</button>
    <button @click="previusPage">PREVIUS PAGE</button>
    <button @click="nextPage">NEXT PAGE</button>
    <button @click="exportPDF">EXPORT PDF</button>
    <viewer ref="viewer" v-if="file" style="height: 90%; width: 100%" :pdf="file"></viewer>
  </div>
</template>
<script lang="ts">
import Vue from "vue";
import {fabric} from "fabric";
import {fieldTypes, pdfField, Viewer} from "@/components";

export default Vue.extend({
  components: {Viewer},
  methods: {
    async renderPDF(event) {
      this.file = event.target.files[0];
    },
    spawnText(){
      const fieldToSpawn: pdfField = {
        id: "ID: " + Date.now().toExponential(),
        type: fieldTypes.Input,
        fabricEntity: new fabric.Text("Hello World", {
          opacity: 0.5,
          backgroundColor: "blue",
          fill: "yellow",
          width: 200,
          height: 100,
          lockRotation: true,
          lockScalingFlip: true,
        })
      }

      this.$refs.viewer.addField(fieldToSpawn)
    },
    nextPage(){
      this.$refs.viewer.setPage(this.$refs.viewer.currentPage + 1);
    },
    previusPage(){
      this.$refs.viewer.setPage(this.$refs.viewer.currentPage - 1);
    },
    exportPDF(){
      this.$refs.viewer.exportToPDF()
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
