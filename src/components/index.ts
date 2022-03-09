import {fabric} from "fabric";

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
    fabricEntity: fabric.Object | fabric.Point | fabric.Intersection
}

export {default as Viewer} from './Viewer.vue';
