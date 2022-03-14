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
import {PDFDocumentProxy} from "pdfjs-dist";

const Base64Prefix = "data:application/pdf;base64,";

let renderImage: fabric.Image;

const renderCache = [];


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


async function printPDFPage(pdf: PDFDocumentProxy, page: number) {
  if (renderCache[page - 1]) {
    return renderCache[page - 1];
  }
  const pdfPage = await pdf.getPage(page);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  const viewport = pdfPage.getViewport({scale: (screen.width / pdfPage.getViewport({scale: 1}).width)});
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  const renderContext = {
    canvasContext: context,
    viewport: viewport
  };
  await pdfPage.render(renderContext).promise;
  renderCache[page - 1] = canvas;
  return canvas;
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

    this.pdfJS = await pdfjsLib.getDocument({data: atob(this.pdf.substring(Base64Prefix.length))}).promise;

    renderImage = new fabric.Image(await printPDFPage(this.pdfJS, 1), {
      selectable: false,
    });

    this.canvas.remove(text);
    this.canvas.add(renderImage);
    this.resizeCanvas();
    //TODO: Uncomment this after fixing the zoom graphics loss
    /*
    window.addEventListener("resize", () => {
      this.resizeCanvas();
    });
     */
    this.setPage(1);


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
        const pdfScale = this.$refs.fabricWrapper.clientWidth / renderImage.width;

        this.canvas.setZoom(pdfScale)
        this.canvas.setDimensions({width: renderImage.width * pdfScale, height: renderImage.height * pdfScale});
        console.log("RESIZING")
      } catch (e) {
        // Discard error caused by clientWidth and clientHeight being unavailable during resize
      }

    },

    /**
     *  Add a field to the pdf for exporting
     * @param field field to add. Only
     */
    addField(field: pdfField) {
      if (!this.fields[this.currentPage - 1]) {
        this.fields[this.currentPage - 1] = [];
      }

      this.fields[this.currentPage - 1].push(field);
      this.canvas.add(field.fabricEntity);
    },

    async setPage(page: number) {
      if (page < 1 || page >= this.pdfJS.numPages) {
        console.warn("Page out of bounds");
        return;
      }
      if (this.fields[this.currentPage - 1]) {
        this.fields[this.currentPage - 1].forEach((field) => {
          this.canvas.remove(field.fabricEntity)
        });
      }
      this.currentPage = page;
      renderImage.setSrc((await printPDFPage(this.pdfJS, this.currentPage)).toDataURL(), () => {
        this.canvas.requestRenderAll();
      })
      if (!this.fields[this.currentPage - 1]) {
        return;
      }
      this.fields[this.currentPage - 1].forEach((field) => {
        this.canvas.add(field.fabricEntity)
      })
      await this.resizeCanvas();
    },
    async exportToPDF() {
      const pdfDoc = await PDFDocument.load(this.pdf.toString());
      const forms = pdfDoc.getForm();
      pdfDoc.getPages().forEach((page, index) => {
        if (this.fields[index]) {
          this.fields[index].forEach(({id, _type, fabricEntity}) => {
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
      fields: [],
      pdfJS: null,
    }
  },
}
</script>
