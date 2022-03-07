<template>
  <div ref="fabricWrapper">
    <canvas ref="viewer"/>
  </div>
</template>

<script lang="ts">
import {fabric} from "fabric";
import pdfjsLib from "@/pdfjsLibWrapper";

const Base64Prefix = "data:application/pdf;base64,";

let pdfRenderedPages;
let renderImage: fabric.Image;

function readBlob(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result));
    reader.addEventListener('error', reject)
    reader.readAsDataURL(blob);
  })
}

async function printPDF(pdfData) {
  pdfData = pdfData instanceof Blob ? await readBlob(pdfData) : pdfData;

  // noinspection JSDeprecatedSymbols It isn't deprecated
  const data = atob(pdfData.startsWith(Base64Prefix) ? pdfData.substring(Base64Prefix.length) : pdfData);

  // Using DocumentInitParameters object to load binary data.
  const pdf = await pdfjsLib.getDocument({data}).promise;

  const numPages = pdf.numPages;

  const pages = new Array(numPages)
      .fill(0)
      .map((__, i) => {
        const pageNumber = i + 1;
        return pdf.getPage(pageNumber)
                  .then((page) => {
                    //  retina scaling
                    const viewport = page.getViewport(
                        {scale: window.devicePixelRatio});
                    // Prepare canvas using PDF page dimensions
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height
                    canvas.width = viewport.width;
                    // Render PDF page into canvas context
                    const renderContext = {
                      canvasContext: context,
                      viewport: viewport
                    };
                    const renderTask = page.render(renderContext);
                    return renderTask.promise.then(() => canvas);
                  });
      });

  pdfRenderedPages = await Promise.all(pages);

}

export default {
  name: "Viewer",
  async mounted() {
    this.canvas = new fabric.Canvas(this.$refs.viewer);

    this.resizeCanvas();
    window.addEventListener("resize", () => {
      this.resizeCanvas();
    });


    const text = new fabric.Text('PDF', {
      selectable: false,
    });
    this.canvas.add(text);
    text.set('text', 'loading...');
    this.canvas.requestRenderAll();
    // @ts-ignore This is temporary and only for testing
    await printPDF(this.pdf);

    const pdfCanvas = pdfRenderedPages[this.currentPage];
    renderImage = new fabric.Image(pdfCanvas, {
      selectable: false,
    });

    this.canvas.remove(text);
    this.canvas.add(renderImage);
    this.resizeCanvas();


  },
  props: {
    pdf: {
      type: Blob,
      required: true,
    }
  },
  methods: {
    async resizeCanvas() {
      const containerWidth = this.$refs.fabricWrapper.clientWidth;
      const containerHeight = this.$refs.fabricWrapper.clientHeight;
      const pdfScale = Math.min(containerWidth / pdfRenderedPages[this.currentPage].width,
          containerHeight / pdfRenderedPages[this.currentPage].height);
      renderImage.set({
        scaleX: pdfScale,
        scaleY: pdfScale,
      });
      this.canvas.setDimensions({width: containerWidth, height: containerHeight});
    },

    addField() {
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
      this.canvas.add(text);

      this.currentFields.push(text);
    },
    async setPage(page: number) {
      if(page <0){
        return;
      }
      this.fields[this.currentPage] = this.currentFields.map((field, index) => {
        this.canvas.remove(field);
        return {
          id: index,
          x: field.left,
          y: field.top,
          width: field.width,
          height: field.height,
        }
      });
      this.currentFields = [];
      this.currentPage = page;
      renderImage.setSrc(pdfRenderedPages[this.currentPage].toDataURL(), () => {
        this.canvas.requestRenderAll();
      })
      if(!this.fields[this.currentPage]){
        return;
      }
      this.fields[this.currentPage].forEach((field)=>{
        const fieldObject = new fabric.Text("Hello Worldg", {
          opacity: 0.5,
          backgroundColor: "blue",
          fill: "yellow",
          left: field.x,
          top: field.y,
          width: field.width,
          height: field.height,
          lockRotation: true,
          lockScalingFlip: true,
        });
        this.canvas.add(fieldObject)
        this.currentFields.push(fieldObject);
      })
    },
  },
  data() {
    return {
      canvas: null,
      currentPage: 0,
      fields: [],
      currentFields: [],
    }
  },
}
</script>
