import * as fs from 'fs';
import PdfPrinter from 'pdfmake';

const rendersAlt = {};

rendersAlt.generateNewPdf = () => {
  try {
    const fonts = {
      Roboto: {
        normal: process.cwd() + '/src/fonts/Roboto-Regular.ttf',
        bold: process.cwd() + '/src/fonts/Roboto-Medium.ttf',
        italics: process.cwd() + '/src/fonts/Roboto-Italic.ttf',
        bolditalics: process.cwd() + '/src/fonts/Roboto-MediumItalic.ttf'
      }
    };
    
    const printer = new PdfPrinter(fonts);

    const docDefinition = {
      footer: function(currentPage, pageCount) {
        return [
          { text: currentPage.toString() + ' of ' + pageCount, alignment: (currentPage % 2) ? 'left' : 'right', margin: [10,10] }
        ]
      },
      header: function(currentPage, pageCount, pageSize) {
        // you can apply any logic and return any valid pdfmake element
        return [
          { text: 'simple text', alignment: (currentPage % 2) ? 'left' : 'right', margin: [10,10] }
        ]
      },
      content: [
        { text: 'This is a header', style: 'header' },
        'No styling here, this is a standard paragraph',
        { text: 'Another text', style: 'anotherStyle' },
        { text: 'Multiple styles applied', style: [ 'header', 'anotherStyle' ] },
        {
          columns: [
            {
              // auto-sized columns have their widths based on their content
              width: 'auto',
              text: 'First column'
            },
            {
              // star-sized columns fill the remaining space
              // if there's more than one star-column, available width is divided equally
              width: '*',
              text: 'Second column'
            },
            {
              // fixed width
              width: 100,
              text: 'Third column'
            },
            {
              // % width
              width: '20%',
              text: { text: 'This is a header', style: 'header' }
            }
          ],
          // optional space between columns
          columnGap: 10
        },
        {
          layout: 'lightHorizontalLines', // optional
          table: {
            // headers are automatically repeated if the table spans over multiple pages
            // you can declare how many rows should be treated as headers
            headerRows: 1,
            widths: [ '*', 'auto', 100, '*' ],
            body: [
              [ 'First', 'Second', 'Third', 'The last one' ],
              [ { text: 'Bold value', bold: true }, 'Value 2', 'Value 3', 'Value 4' ],
              [ { text: 'Bold value', bold: true }, 'Value 2', 'Value 3', 'Value 4' ]
            ]
          }
        },
        'Bulleted list example:',
        {
          // to treat a paragraph as a bulleted list, set an array of items under the ul key
          ul: [
            'Item 1',
            'Item 2',
            'Item 3',
            { text: 'Item 4', bold: true },
          ]
        },
    
        'Numbered list example:',
        {
          // for numbered lists set the ol key
          ol: [
            'Item 1',
            'Item 2',
            'Item 3'
          ]
        }
      ],
      defaultStyle: {
        font: 'Roboto'
      },
      styles: {
        header: {
          fontSize: 22,
          bold: true,
          color: '#000080'
        },
        anotherStyle: {
          italics: true,
          alignment: 'right'
        }
      }
    };
    
    const options = {
      // ...
    }
    
    const pdfDoc = printer.createPdfKitDocument(docDefinition, options);
    pdfDoc.pipe(fs.createWriteStream(process.cwd() + '/src/pdfs/newpdfalt.pdf'));
    pdfDoc.end();
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

rendersAlt.generateLocationProductsByCategoryPdf = (categoriesData, productsData) => {
  try {
    const fonts = {
      Roboto: {
        normal: process.cwd() + '/src/fonts/Roboto-Regular.ttf',
        bold: process.cwd() + '/src/fonts/Roboto-Medium.ttf',
        italics: process.cwd() + '/src/fonts/Roboto-Italic.ttf',
        bolditalics: process.cwd() + '/src/fonts/Roboto-MediumItalic.ttf'
      }
    };
    
    const printer = new PdfPrinter(fonts);

    const bodyData = [];
    bodyData.push(['CODIGO', 'NOMBRE', 'EXISTENCIAS', 'CONTENIDO', 'GENERAL', 'COSTO', 'VALOR']);

    for(const category of (categoriesData || [])) {
      bodyData.push([
        '',
        category?.name || '',
        '',
        '',
        '',
        '',
        ''
      ]);
      for(const product of (productsData || []).filter(x => x.productCategoryId === category.id)) {
        bodyData.push([
          product?.productId || 0,
          product?.productName || '',
          '',
          '',
          '',
          '',
          ''
        ]);
      }
    }

    const docDefinition = {
      footer: function(currentPage, pageCount) {
        return [
          { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [10,10] }
        ]
      },
      header: function(currentPage, pageCount, pageSize) {
        // you can apply any logic and return any valid pdfmake element
        return [
          { text: 'Reporte de Productos por Categoría', alignment: 'left', margin: [10,10] }
        ]
      },
      content: [
        { text: 'This is a header', style: 'header' },
        'No styling here, this is a standard paragraph',
        {
          layout: 'lightHorizontalLines', // optional
          table: {
            // headers are automatically repeated if the table spans over multiple pages
            // you can declare how many rows should be treated as headers
            headerRows: 1,
            widths: ['10%', '40%', '10%', '10%', '10%', '10%', '10%'],
            body: bodyData
          }
        }
      ],
      defaultStyle: {
        font: 'Roboto',
        fontSize: 6
      }
    };
    
    const options = {
      // ...
    }
    
    const pdfDoc = printer.createPdfKitDocument(docDefinition, options);
    pdfDoc.pipe(fs.createWriteStream(process.cwd() + '/src/pdfs/bycategories.pdf'));
    pdfDoc.end();
  } catch(err) {
    throw err;
  }
};

rendersAlt.generateLocationProductsByCategoryPdf = (categoriesData, productsData) => {
  try {
    const fonts = {
      Roboto: {
        normal: process.cwd() + '/src/fonts/Roboto-Regular.ttf',
        bold: process.cwd() + '/src/fonts/Roboto-Medium.ttf',
        italics: process.cwd() + '/src/fonts/Roboto-Italic.ttf',
        bolditalics: process.cwd() + '/src/fonts/Roboto-MediumItalic.ttf'
      }
    };
    
    const printer = new PdfPrinter(fonts);

    const bodyData = [];
    bodyData.push(['CODIGO', 'NOMBRE', 'EXISTENCIAS', 'CONTENIDO', 'GENERAL', 'COSTO', 'VALOR']);

    for(const category of (categoriesData || [])) {
      bodyData.push([
        '',
        category?.name || '',
        '',
        '',
        '',
        '',
        ''
      ]);
      for(const product of (productsData || []).filter(x => x.productCategoryId === category.id)) {
        bodyData.push([
          product?.productId || 0,
          product?.productName || '',
          '',
          '',
          '',
          '',
          ''
        ]);
      }
    }

    const docDefinition = {
      footer: function(currentPage, pageCount) {
        return [
          { text: `${currentPage.toString()} de ${pageCount}`, alignment: 'right', margin: [10,10] }
        ]
      },
      header: function(currentPage, pageCount, pageSize) {
        // you can apply any logic and return any valid pdfmake element
        return [
          { text: 'Reporte de Productos por Categoría', alignment: 'left', margin: [10,10] }
        ]
      },
      content: [
        { text: 'This is a header', style: 'header' },
        'No styling here, this is a standard paragraph',
        {
          layout: 'lightHorizontalLines', // optional
          table: {
            // headers are automatically repeated if the table spans over multiple pages
            // you can declare how many rows should be treated as headers
            headerRows: 1,
            widths: ['10%', '40%', '10%', '10%', '10%', '10%', '10%'],
            body: bodyData
          }
        }
      ],
      defaultStyle: {
        font: 'Roboto',
        fontSize: 6
      }
    };
    
    const options = {
      // ...
    }
    
    const pdfDoc = printer.createPdfKitDocument(docDefinition, options);
    pdfDoc.pipe(fs.createWriteStream(process.cwd() + '/src/pdfs/bycategories.pdf'));
    pdfDoc.end();
  } catch(err) {
    throw err;
  }
};

export default rendersAlt;
