<template>
  <div ref="fabricWrapper">
    <canvas ref="viewer"/>
  </div>
</template>

<script lang="ts">
import {fabric} from "fabric";
import pdfjsLib from "@/pdfjsLibWrapper";

const Base64Prefix = "data:application/pdf;base64,";


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

  return new Array(numPages)
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
}

async function pdfToImage(pdfData, canvas) {
  return (await printPDF(pdfData))
      .map(async c => {
        const pdfCanvas = await c;
        console.log(canvas.width, pdfCanvas.width)
        const scale = canvas.width / (pdfCanvas.width + 6000);

        canvas.add(new fabric.Image(pdfCanvas, {
          scaleX: scale,
          // Scale always accordingly to width to keep aspect ratio and make it fit horizontally in canvas
          scaleY: scale,
          selectable: false,
        }));
      });
}

export default {
  name: "Viewer",
  async mounted() {
    this.canvas = new fabric.Canvas(this.$refs.viewer);

    this.resizeCanvas();
    window.addEventListener("resize", () => {
      this.resizeCanvas();
    });


    const text = new fabric.Text('PDF');
    this.canvas.add(text);
    text.set('text', 'loading...');
    this.canvas.requestRenderAll();
    // @ts-ignore This is temporary and only for testing
    await pdfToImage(this.pdf, this.canvas);
    this.canvas.remove(text);
  },
  props: {
    pdf: {
      type: Blob,
      required: true,
    },
  },
  methods: {
    async resizeCanvas() {
      const containerWidth = this.$refs.fabricWrapper.clientWidth;
      const containerHeight = this.$refs.fabricWrapper.clientHeight;
      const scale          = containerWidth / this.canvas.getWidth();
      const zoom           = this.canvas.getZoom() * scale;

      this.canvas.setDimensions({width: containerWidth, height: containerHeight});
      this.canvas.setViewportTransform([zoom, 0, 0, zoom, 0, 0]);
    }
  },
  data() {
    return {
      canvas: null,
    }
  },
}
</script>
