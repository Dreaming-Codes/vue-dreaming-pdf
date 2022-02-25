<template>
  <div id="app">
    <input v-if="!file" type="file" accept="application/pdf" @change="renderPDF">
    <button @click="spawnText">SPAWN TEXT</button>
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

      const text = new fabric.Text("Hello World", {
        opacity: 0.5,
        backgroundColor: "blue",
        fill: "yellow",
        width: wInitialSize,
        height: hInitialSize,
        lockRotation: true,
        lockScalingFlip: true,
      });
      this.$refs.viewer.canvas.add(text);
      setInterval(()=>{
        console.log(text.get("top"))
        console.log(text.get("left"))
        console.log("w:" + wInitialSize * text.get("scaleX"))
        console.log("h:" + hInitialSize * text.get("scaleY"))
      })
    },
    nextPage(){
      this.$refs.viewer.currentPage++;
      this.$refs.viewer.updateRenderedPage();
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
