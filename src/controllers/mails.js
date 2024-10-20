import nodemailer from 'nodemailer';
import rendersAlt from '../helpers/pdfRenderingAlt.js';

const controller = {};

controller.sendMail = (req, res) => {
  try {
    rendersAlt.generateLocationProductsByCategoryPdf(
      [
        {id: 1, name: "TEST CATEGORY"}
      ],
      [
        {productName: "TEST PRODUCT 1 2",
        packageContent: 1,
        productCost: 1,
        productCategoryId: 1}
      ]
    );
  } catch(error) {
    console.log(error);
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'sanchez.gustavo0505@gmail.com',
      pass: 'xztp tetm cesu hiep'
    }
  });
  
  const mailOptions = {
    from: 'sanchez.gustavo0505@gmail.com',
    to: 'sanchezgustavosg@outlook.com',
    subject: 'Testing invoice mail sending',
    text: 'Im testing nodemailer and attachment pdf with my personal Gmail account',
    attachments: [{
      filename: 'bycategories.pdf',
      path: process.cwd() + '/src/pdfs/bycategories.pdf',
      contentType: 'application/pdf'
    }]
  };

  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      res.json({ status: 400, message: 'Error' });
      console.log(error);
    } else {
      res.json({ status: 200, message: 'Success' });
      console.log('Email sent: ' + info.response);
    }
  });
}

export default controller;
