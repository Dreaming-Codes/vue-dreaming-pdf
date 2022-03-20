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
import {PDFPageProxy} from "pdfjs-dist";

const Base64Prefix = "data:application/pdf;base64,";

let renderImage: fabric.Image;

let pdfPage: PDFPageProxy;

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

    this.pdfJS = await pdfjsLib.getDocument({data: atob(this.pdf.substring(Base64Prefix.length)), fontExtraProperties: true}).promise;

    this.canvas.remove(text);
    this.resizeCanvas();
    window.addEventListener("resize", () => {
      this.resizeCanvas();
    });
    this.setPage(1);


  },
  props: {
    pdf: {
      type: Blob,
      required: true,
    }
  },
  methods: {
    async renderPDFPage(force = false) {
      pdfPage = await this.pdfJS.getPage(this.currentPage);

      let viewport = pdfPage.getViewport({scale: 1});
      const newScale = this.$refs.fabricWrapper.clientWidth * window.devicePixelRatio / viewport.width;
      if(!force && newScale < this.scale){
        return;
      }
      this.scale = newScale;
      console.log("rendering page");
      viewport = pdfPage.getViewport({scale: newScale});

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await pdfPage.render(renderContext).promise;
      this.canvas.remove(renderImage);

      renderImage = new fabric.Image(canvas, {
        selectable: false,
      });
      this.canvas.add(renderImage)
    },
    async resizeCanvas(forceRender = false) {
      try {
        await this.renderPDFPage(forceRender);
        const fabricContainer = this.$refs.fabricWrapper.children[0];
        fabricContainer.style.width = "100%";
        const height = this.$refs.fabricWrapper.clientWidth * renderImage.height / renderImage.width + "px";
        fabricContainer.style.height = height;
        for(let child of fabricContainer.children){
          child.style.width = "100%";
          child.style.height = height;
        }
        this.canvas.setDimensions({width: renderImage.width, height: renderImage.height}, {backstoreOnly: true});
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
      await this.resizeCanvas(true);
      if (!this.fields[this.currentPage - 1]) {
        return;
      }
      this.fields[this.currentPage - 1].forEach((field) => {
        this.canvas.add(field.fabricEntity)
      })
    },
    async exportToPDF() {
      const pdfDoc = await PDFDocument.load(this.pdf.toString());
      const forms = pdfDoc.getForm();
      pdfDoc.getPages().forEach((page, index) => {
        if (this.fields[index]) {
          this.fields[index].forEach(({id, _type, fabricEntity}) => {
            const pdfForm = forms.createTextField(id)
            console.log(pdfForm)

            const height = fabricEntity.getScaledHeight() / this.scale;
            const width = fabricEntity.getScaledWidth() / this.scale;

            pdfForm.addToPage(page, {
              x: fabricEntity.left / this.scale,
              y: page.getHeight() - fabricEntity.top / this.scale - height,
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
      currentPage: 1,
      fields: [],
      pdfJS: null,
      scale: null,
      canvasScaling: 1
    }
  },
}
</script>
