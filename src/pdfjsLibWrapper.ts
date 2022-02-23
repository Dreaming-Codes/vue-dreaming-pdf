import * as pdfjsLib from "pdfjs-dist";
import PDFWorker from "pdfjs-dist/build/pdf.worker.js?url";

//Fix worker
pdfjsLib.GlobalWorkerOptions.workerSrc = PDFWorker;
export default pdfjsLib;
