<template>
  <div ref="fabricWrapper">
    <canvas ref="viewer"/>
  </div>
</template>

<script lang="ts">
import {fabric} from "fabric";
import pdfjsLib from "@/pdfjsLibWrapper";
import {PDFDocument} from "pdf-lib";
import {fieldTypes, pdfField} from "@/components/index";

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

function blobToBase64(blob) {
  return new Promise((resolve, _) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

async function printPDF(pdfData) {
  /*
  pdfData = pdfData instanceof Blob ? await readBlob(pdfData) : pdfData;

  // noinspection JSDeprecatedSymbols It isn't deprecated
  const data = atob(pdfData.startsWith(Base64Prefix) ? pdfData.substring(Base64Prefix.length) : pdfData);

   */

  // Using DocumentInitParameters object to load binary data.
  const pdf = await pdfjsLib.getDocument({data: pdfData}).promise;

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

  return Promise.all(pages);

}



export default {
  name: "Viewer",
  async mounted() {
    this.canvas = new fabric.Canvas(this.$refs.viewer);

    const text = new fabric.Text('PDF', {
      selectable: false,
    });
    this.canvas.add(text);
    text.set('text', 'loading...');
    this.canvas.requestRenderAll();

    this.pdf = await readBlob(this.pdf)

    const pdfDoc = await PDFDocument.load(this.pdf);

    const form = pdfDoc.getForm()

    const fields = form.getFields()

    fields.forEach(field => {
      const name = field.getName();
      const textField = form.getTextField(name);
      const widgets = textField.acroField.getWidgets();
      widgets.forEach((w) => {
        let rectangle = w.getRectangle();
        let page = pdfDoc.getPages().find((p) => p.ref === w.P());
        let pageIndex = pdfDoc.getPages().findIndex((p) => p.ref === w.P());

        console.log(rectangle, pageIndex);
        if (!this.fields[pageIndex]) {
          this.fields[pageIndex] = [];
        }
        const textBoxToSpawn = new fabric.Text(name, {
          left: rectangle.x * window.devicePixelRatio,
          backgroundColor: '#5e1d1d',
          strokeWidth: 1,
        });

        textBoxToSpawn.scaleX = rectangle.width / textBoxToSpawn.width * window.devicePixelRatio;
        textBoxToSpawn.scaleY = rectangle.height / textBoxToSpawn.height * window.devicePixelRatio;
        textBoxToSpawn.top = (page.getHeight() - rectangle.y) * window.devicePixelRatio - textBoxToSpawn.getScaledHeight();

        form.removeField(field)


        this.fields[pageIndex].push({
          id: name,
          type: fieldTypes.Input,
          fabricEntity: textBoxToSpawn
        })
      });
    })

    this.pdf = await blobToBase64(await new Blob([await pdfDoc.save()], {type: 'application/pdf'}))


    pdfRenderedPages = await printPDF(atob(this.pdf.substring(Base64Prefix.length)))

    const pdfCanvas = pdfRenderedPages[this.currentPage];
    renderImage = new fabric.Image(pdfCanvas, {
      selectable: false,
    });

    this.canvas.remove(text);
    this.canvas.add(renderImage);
    this.resizeCanvas();
    window.addEventListener("resize", () => {
      this.resizeCanvas();
    });
    this.setPage(0);


  },
  props: {
    pdf: {
      type: Blob,
      required: true,
    }
  },
  methods: {
    async resizeCanvas() {
      try {
        const containerWidth = this.$refs.fabricWrapper.clientWidth;
        const containerHeight = this.$refs.fabricWrapper.clientHeight;
        const pdfScale = Math.min(containerWidth / pdfRenderedPages[this.currentPage].width,
            containerHeight / pdfRenderedPages[this.currentPage].height);
        this.canvas.setZoom(pdfScale)
        this.canvas.setDimensions({width: renderImage.width * pdfScale, height: renderImage.height * pdfScale});
      } catch (e) {
        // Discard error caused by clientWidth and clientHeight being unavailable during resize
      }

    },

    /**
     *  Add a field to the pdf for exporting
     * @param field field to add. Only
     */
    addField(field: pdfField) {
      if (!this.fields[this.currentPage]) {
        this.fields[this.currentPage] = [];
      }

      this.fields[this.currentPage].push(field);
      this.canvas.add(field.fabricEntity);
    },

    async setPage(page: number) {
      if (page < 0 || page >= pdfRenderedPages.length) {
        console.warn("Page out of bounds");
        return;
      }
      if (this.fields[this.currentPage]) {
        this.fields[this.currentPage].forEach((field) => {
          this.canvas.remove(field.fabricEntity)
        });
      }
      this.currentPage = page;
      renderImage.setSrc(pdfRenderedPages[this.currentPage].toDataURL(), () => {
        this.canvas.requestRenderAll();
      })
      if (!this.fields[this.currentPage]) {
        return;
      }
      this.fields[this.currentPage].forEach((field) => {
        this.canvas.add(field.fabricEntity)
      })
    },
    async exportToPDF() {
      const pdfDoc = await PDFDocument.load(this.pdf.toString());
      const forms = pdfDoc.getForm();
      pdfDoc.getPages().forEach((page, index) => {
        if (this.fields[index]) {
          this.fields[index].forEach(({id, type, fabricEntity}) => {
            const pdfForm = forms.createTextField(id)
            console.log(pdfForm)

            const height = fabricEntity.getScaledHeight() / window.devicePixelRatio;
            const width = fabricEntity.getScaledWidth() / window.devicePixelRatio;

            pdfForm.addToPage(page, {
              x: fabricEntity.left / window.devicePixelRatio,
              y: page.getHeight() - fabricEntity.top / window.devicePixelRatio - height,
              width,
              height,
            })
          })
        }
      });

      pdfDoc.save().then(pdfBlob => {
        const url = URL.createObjectURL(new Blob([pdfBlob]));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'output.pdf';
        a.click();
      });
    }
  },
  data() {
    return {
      canvas: null,
      currentPage: 0,
      fields: []
    }
  },
}
</script>
