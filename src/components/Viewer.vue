<template>
  <div ref="fabricWrapper">
    <canvas ref="viewer"/>
  </div>
</template>

<script lang="ts">
import {fabric} from "fabric";
import pdfjsLib from "@/pdfjsLibWrapper";
import {PDFDocument} from "pdf-lib";
import {PDFDocumentProxy, PDFPageProxy} from "pdfjs-dist";
import Component from "vue-class-component";
import Vue from "vue";

const Base64Prefix = "data:application/pdf;base64,";

let renderImage: fabric.Image;

let pdfPage: PDFPageProxy;

let resizeInProgress = false;

export enum fieldTypes {
  /**
   * Only works with text entities
   */
  Input
}


export interface pdfField {
  id: string,
  type: fieldTypes,
  /**
   * For now only support text entities with Input type
   */
  fabricEntity: fabric.Text
}

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

const ViewerProps = Vue.extend({
  props: {
    file: {
      type: Blob,
      required: true,
    }
  },
})

@Component({
  watch: {
    isLoading(isLoading) {
      if (!isLoading) {
        this.$emit("loaded");
      }
    }
  }
})
export default class Viewer extends ViewerProps {
  $refs!: {
    fabricWrapper: HTMLDivElement,
    viewer: HTMLCanvasElement
  }

  canvas: fabric.Canvas = null;
  currentPage = 1;
  fields: pdfField[][] = [];
  pdfJS: PDFDocumentProxy = null;
  scale: number = null;
  pdf = null;
  isLoading = true;
  firstLoad = true;

  async mounted() {
    // @ts-ignore
    this.canvas = new fabric.Canvas(this.$refs.viewer);

    const text = new fabric.Text('PDF', {
      selectable: false,
    });
    this.canvas.add(text);
    text.set('text', 'loading...');
    this.canvas.requestRenderAll();

    this.pdf = await readBlob(this.file)

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

    this.pdfJS = await pdfjsLib.getDocument(
        {data: atob(this.pdf.substring(Base64Prefix.length)), fontExtraProperties: true}).promise;

    this.canvas.remove(text);
    this.resizeCanvas();
    window.addEventListener("resize", () => {
      this.resizeCanvas();
    });
    this.setPage(1);
  }

  async renderPDFPage(force = false) {
    pdfPage = await this.pdfJS.getPage(this.currentPage);

    let viewport = pdfPage.getViewport({scale: 1});
    const newScale = this.$refs.fabricWrapper.clientWidth * window.devicePixelRatio / viewport.width;

    if (!force && newScale < this.scale) {
      return;
    }

    //TODO: Move fields to correct position in the new scaling

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

    if (!renderImage) {
      renderImage = new fabric.Image(canvas, {
        selectable: false,
      });
      this.canvas.add(renderImage)
    } else {
      renderImage.setSrc(canvas.toDataURL());
    }
  }

  async resizeCanvas(forceRender = false) {
    try {
      if (!forceRender && resizeInProgress) {
        return;
      }
      resizeInProgress = true;
      await this.renderPDFPage(forceRender);
      const fabricContainer = this.$refs.fabricWrapper.children[0] as HTMLDivElement;
      fabricContainer.style.width = "100%";
      const height = this.$refs.fabricWrapper.clientWidth * renderImage.height / renderImage.width + "px";
      fabricContainer.style.height = height;
      //@ts-ignore
      for (let child of fabricContainer.children) {
        child.style.width = "100%";
        child.style.height = height;
      }
      this.canvas.setDimensions({width: renderImage.width, height: renderImage.height}, {backstoreOnly: true});
      console.log("RESIZING")
    } catch (e) {
      // Discard error caused by clientWidth and clientHeight being unavailable during resize
    } finally {
      console.log("resize done");
      resizeInProgress = false;
    }

  }

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
  }

  getFieldsLength() {
    return this.fields.flat().length;
  }

  /**
   * Get the field with the given id
   * @param id
   * @returns [page, pdfField]
   */
  getFieldById(id: string): [number, pdfField] {
    let field;
    // +1 because page numeration in pdfJS starts at 1
    const page = this.fields.findIndex((page) => {
      field = page.find(field => field.id === id);
      return field;
    }) + 1;
    return [page, field];
  }

  /**
   * Move field by id to the given page
   * @param id id of the field to move
   * @param page page to move to
   * @returns [page, pdfField]
   */
  moveField(id: string, page: number) {
    if (page < 1 || page > this.pdfJS.numPages) {
      throw new Error("Invalid page number");
    }
    const [oldPage, field] = this.getFieldById(id);
    if (oldPage === page) {
      return;
    }
    if (!field) {
      throw new Error("Field not found");
    }
    this.fields[oldPage - 1].splice(this.fields[oldPage - 1].indexOf(field), 1);
    if (!this.fields[page - 1]) {
      this.fields[page - 1] = [field];
    } else {
      this.fields[page - 1].push(field);
    }
    this.canvas.add(field.fabricEntity);
  }

  async removeField(id: string) {
    const [page, field] = this.getFieldById(id);
    if (!field) {
      throw new Error("Field not found");
    }
    this.fields[page - 1].splice(this.fields[page - 1].indexOf(field), 1);
    if (page === this.currentPage) {
      this.canvas.remove(field.fabricEntity);
    }
  }

  async setPage(page: number) {
    if (!this.firstLoad && this.isLoading) {
      return;
    }
    this.firstLoad = false;
    if (page < 1 || page > this.pdfJS.numPages) {
      console.warn("Page out of bounds");
      return;
    }
    this.isLoading = true;
    if (this.fields[this.currentPage - 1]) {
      this.fields[this.currentPage - 1].forEach((field) => {
        this.canvas.remove(field.fabricEntity)
      });
    }
    this.currentPage = page;
    await this.resizeCanvas(true);
    this.isLoading = false;
    if (!this.fields[this.currentPage - 1]) {
      return;
    }
    this.fields[this.currentPage - 1].forEach((field) => {
      this.canvas.add(field.fabricEntity)
    })
  }

  async exportToPDF(): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(this.pdf.toString());
    const forms = pdfDoc.getForm();
    pdfDoc.getPages().forEach((page, index) => {
      if (this.fields[index]) {
        this.fields[index].forEach(({id, fabricEntity}) => {
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

    return pdfDoc.save();
  }
}
</script>
