import * as fs from 'fs';
import PDFDocument from 'pdfkit';

const renders = {};

renders.generateNewPdf = () => {
  try {
    const doc = new PDFDocument;

    doc.pipe(fs.createWriteStream(process.cwd() + '/src/pdfs/newpdf.pdf'));
  
    doc.end();
  } catch(err) {
    throw err;
  }
  // fs.readdir('./src/temp/uploads', (err, files) => {
  //   if (err) throw err;
  //   for (const file of files) {
  //     fs.unlink(`./src/temp/uploads/${file}`, (err) => {
  //       if (err) throw err;
  //     });
  //   }
  // });
};

export default renders;
