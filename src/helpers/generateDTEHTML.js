const generateDTEHTML = {};

generateDTEHTML.cfHTML = ({
  dteTypeName,
  documentDate,
  customerFullname,
  controlNumber,
  generationCode,
  receptionStamp
}) => (`
<!DOCTYPE html
  PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">

<head>
  <title></title>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <!--[if !mso]><!-->
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <!--<![endif]-->
  <meta name="x-apple-disable-message-reformatting" content="" />
  <meta content="target-densitydpi=device-dpi" name="viewport" />
  <meta content="true" name="HandheldFriendly" />
  <meta content="width=device-width" name="viewport" />
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no" />
  <style type="text/css">
    table {
      border-collapse: separate;
      table-layout: fixed;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt
    }

    table td {
      border-collapse: collapse
    }

    .ExternalClass {
      width: 100%
    }

    .ExternalClass,
    .ExternalClass p,
    .ExternalClass span,
    .ExternalClass font,
    .ExternalClass td,
    .ExternalClass div {
      line-height: 100%
    }

    body,
    a,
    li,
    p,
    h1,
    h2,
    h3 {
      -ms-text-size-adjust: 100%;
      -webkit-text-size-adjust: 100%;
    }

    html {
      -webkit-text-size-adjust: none !important
    }

    body,
    #innerTable {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale
    }

    #innerTable img+div {
      display: none;
      display: none !important
    }

    img {
      Margin: 0;
      padding: 0;
      -ms-interpolation-mode: bicubic
    }

    h1,
    h2,
    h3,
    p,
    a {
      line-height: 1;
      overflow-wrap: normal;
      white-space: normal;
      word-break: break-word
    }

    a {
      text-decoration: none
    }

    h1,
    h2,
    h3,
    p {
      min-width: 100% !important;
      width: 100% !important;
      max-width: 100% !important;
      display: inline-block !important;
      border: 0;
      padding: 0;
      margin: 0
    }

    a[x-apple-data-detectors] {
      color: inherit !important;
      text-decoration: none !important;
      font-size: inherit !important;
      font-family: inherit !important;
      font-weight: inherit !important;
      line-height: inherit !important
    }

    u+#body a {
      color: inherit;
      text-decoration: none;
      font-size: inherit;
      font-family: inherit;
      font-weight: inherit;
      line-height: inherit;
    }

    a[href^="mailto"],
    a[href^="tel"],
    a[href^="sms"] {
      color: inherit;
      text-decoration: none
    }

    img,
    p {
      margin: 0;
      Margin: 0;
      font-family: Poppins, BlinkMacSystemFont, Segoe UI, Helvetica Neue, Arial, sans-serif;
      line-height: 22px;
      font-weight: 400;
      font-style: normal;
      font-size: 16px;
      text-decoration: none;
      text-transform: none;
      letter-spacing: 0;
      direction: ltr;
      color: #454545;
      text-align: left;
      mso-line-height-rule: exactly;
      mso-text-raise: 2px
    }

    h1 {
      margin: 0;
      Margin: 0;
      font-family: Roboto, BlinkMacSystemFont, Segoe UI, Helvetica Neue, Arial, sans-serif;
      line-height: 34px;
      font-weight: 400;
      font-style: normal;
      font-size: 28px;
      text-decoration: none;
      text-transform: none;
      letter-spacing: 0;
      direction: ltr;
      color: #333;
      text-align: left;
      mso-line-height-rule: exactly;
      mso-text-raise: 2px
    }

    h2 {
      margin: 0;
      Margin: 0;
      font-family: Lato, BlinkMacSystemFont, Segoe UI, Helvetica Neue, Arial, sans-serif;
      line-height: 30px;
      font-weight: 400;
      font-style: normal;
      font-size: 24px;
      text-decoration: none;
      text-transform: none;
      letter-spacing: 0;
      direction: ltr;
      color: #333;
      text-align: left;
      mso-line-height-rule: exactly;
      mso-text-raise: 2px
    }

    h3 {
      margin: 0;
      Margin: 0;
      font-family: Lato, BlinkMacSystemFont, Segoe UI, Helvetica Neue, Arial, sans-serif;
      line-height: 26px;
      font-weight: 400;
      font-style: normal;
      font-size: 20px;
      text-decoration: none;
      text-transform: none;
      letter-spacing: 0;
      direction: ltr;
      color: #333;
      text-align: left;
      mso-line-height-rule: exactly;
      mso-text-raise: 2px
    }
  </style>
  <style type="text/css">
    @media (min-width: 481px) {
      .hd {
        display: none !important
      }
    }
  </style>
  <style type="text/css">
    @media (max-width: 480px) {
      .hm {
        display: none !important
      }
    }
  </style>
  <style type="text/css">
    @media (min-width: 481px) {

      h1,
      img,
      p {
        margin: 0;
        Margin: 0
      }

      img,
      p {
        font-family: Poppins, BlinkMacSystemFont, Segoe UI, Helvetica Neue, Arial, sans-serif;
        line-height: 22px;
        font-weight: 400;
        font-style: normal;
        font-size: 16px;
        text-decoration: none;
        text-transform: none;
        letter-spacing: 0;
        direction: ltr;
        color: #454545;
        text-align: left;
        mso-line-height-rule: exactly;
        mso-text-raise: 2px
      }

      h1 {
        font-family: Roboto, BlinkMacSystemFont, Segoe UI, Helvetica Neue, Arial, sans-serif;
        line-height: 34px;
        font-weight: 400;
        font-style: normal;
        font-size: 28px;
        text-decoration: none;
        text-transform: none;
        letter-spacing: 0;
        direction: ltr;
        color: #333;
        text-align: left;
        mso-line-height-rule: exactly;
        mso-text-raise: 2px
      }

      h2,
      h3 {
        margin: 0;
        Margin: 0;
        font-family: Lato, BlinkMacSystemFont, Segoe UI, Helvetica Neue, Arial, sans-serif;
        font-weight: 400;
        font-style: normal;
        text-decoration: none;
        text-transform: none;
        letter-spacing: 0;
        direction: ltr;
        color: #333;
        text-align: left;
        mso-line-height-rule: exactly;
        mso-text-raise: 2px
      }

      h2 {
        line-height: 30px;
        font-size: 24px
      }

      h3 {
        line-height: 26px;
        font-size: 20px
      }

      .t65 {
        padding-left: 60px !important;
        padding-right: 60px !important;
        width: 510px !important
      }

      .t5 {
        width: 744px !important
      }

      .t14,
      .t30 {
        width: 738px !important
      }

      .t12,
      .t18,
      .t23,
      .t28,
      .t46,
      .t51 {
        width: 600px !important
      }

      .t35 {
        width: 778px !important
      }

      .t33 {
        width: 572px !important
      }

      .t60 {
        width: 800px !important
      }

      .t45,
      .t58 {
        text-align: left !important
      }

      .t41 {
        mso-line-height-alt: 0px !important;
        line-height: 0 !important;
        display: none !important
      }

      .t43 {
        width: 20.07576% !important;
        max-width: 212px !important
      }

      .t42,
      .t56 {
        padding-left: 22px !important;
        padding-right: 22px !important
      }

      .t57 {
        width: 79.92424% !important;
        max-width: 844px !important
      }
    }
  </style>
  <style type="text/css" media="screen and (min-width:481px)">
    .moz-text-html img,
    .moz-text-html p {
      margin: 0;
      Margin: 0;
      font-family: Poppins, BlinkMacSystemFont, Segoe UI, Helvetica Neue, Arial, sans-serif;
      line-height: 22px;
      font-weight: 400;
      font-style: normal;
      font-size: 16px;
      text-decoration: none;
      text-transform: none;
      letter-spacing: 0;
      direction: ltr;
      color: #454545;
      text-align: left;
      mso-line-height-rule: exactly;
      mso-text-raise: 2px
    }

    .moz-text-html h1 {
      margin: 0;
      Margin: 0;
      font-family: Roboto, BlinkMacSystemFont, Segoe UI, Helvetica Neue, Arial, sans-serif;
      line-height: 34px;
      font-weight: 400;
      font-style: normal;
      font-size: 28px;
      text-decoration: none;
      text-transform: none;
      letter-spacing: 0;
      direction: ltr;
      color: #333;
      text-align: left;
      mso-line-height-rule: exactly;
      mso-text-raise: 2px
    }

    .moz-text-html h2 {
      margin: 0;
      Margin: 0;
      font-family: Lato, BlinkMacSystemFont, Segoe UI, Helvetica Neue, Arial, sans-serif;
      line-height: 30px;
      font-weight: 400;
      font-style: normal;
      font-size: 24px;
      text-decoration: none;
      text-transform: none;
      letter-spacing: 0;
      direction: ltr;
      color: #333;
      text-align: left;
      mso-line-height-rule: exactly;
      mso-text-raise: 2px
    }

    .moz-text-html h3 {
      margin: 0;
      Margin: 0;
      font-family: Lato, BlinkMacSystemFont, Segoe UI, Helvetica Neue, Arial, sans-serif;
      line-height: 26px;
      font-weight: 400;
      font-style: normal;
      font-size: 20px;
      text-decoration: none;
      text-transform: none;
      letter-spacing: 0;
      direction: ltr;
      color: #333;
      text-align: left;
      mso-line-height-rule: exactly;
      mso-text-raise: 2px
    }

    .moz-text-html .t65 {
      padding-left: 60px !important;
      padding-right: 60px !important;
      width: 510px !important
    }

    .moz-text-html .t5 {
      width: 744px !important
    }

    .moz-text-html .t14 {
      width: 738px !important
    }

    .moz-text-html .t12 {
      width: 600px !important
    }

    .moz-text-html .t30 {
      width: 738px !important
    }

    .moz-text-html .t18,
    .moz-text-html .t23,
    .moz-text-html .t28 {
      width: 600px !important
    }

    .moz-text-html .t35 {
      width: 778px !important
    }

    .moz-text-html .t33 {
      width: 572px !important
    }

    .moz-text-html .t60 {
      width: 800px !important
    }

    .moz-text-html .t58 {
      text-align: left !important
    }

    .moz-text-html .t41 {
      mso-line-height-alt: 0px !important;
      line-height: 0 !important;
      display: none !important
    }

    .moz-text-html .t43 {
      width: 20.07576% !important;
      max-width: 212px !important
    }

    .moz-text-html .t42 {
      padding-left: 22px !important;
      padding-right: 22px !important
    }

    .moz-text-html .t57 {
      width: 79.92424% !important;
      max-width: 844px !important
    }

    .moz-text-html .t56 {
      padding-left: 22px !important;
      padding-right: 22px !important
    }

    .moz-text-html .t46,
    .moz-text-html .t51 {
      width: 600px !important
    }

    .moz-text-html .t45 {
      text-align: left !important
    }
  </style>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;700&amp;display=swap" rel="stylesheet"
    type="text/css" />
</head>

<body id="body" class="t69" style="min-width:100%;Margin:0px;padding:0px;background-color:#FAFAFA;">
  <div class="t68" style="background-color:#FAFAFA;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center">
      <tr>
        <td class="t67" style="font-size:0;line-height:0;mso-line-height-rule:exactly;background-color:#FAFAFA;"
          valign="top" align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center"
            id="innerTable">
            <tr>
              <td>
                <table class="t66" role="presentation" cellpadding="0" cellspacing="0" align="center">
                  <tr>
                    <td class="t65" style="background-color:#FFFFFF;width:420px;padding:40px 30px 40px 30px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td>
                            <div class="t3"
                              style="mso-line-height-rule:exactly;mso-line-height-alt:40px;line-height:40px;font-size:1px;display:block;">
                              &nbsp;</div>
                          </td>
                        </tr>
                        <tr>
                          <td>
                            <table class="t6" role="presentation" cellpadding="0" cellspacing="0" align="center">
                              <tr>
                                <td class="t5" style="width:480px;">
                                  <h1 class="t4"
                                    style="margin:0;Margin:0;font-family:Poppins,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:34px;font-weight:700;font-style:normal;font-size:29px;text-decoration:none;text-transform:none;direction:ltr;color:#333333;text-align:left;mso-line-height-rule:exactly;mso-text-raise:2px;">
                                    Emisión DTE</h1>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td>
                            <div class="t7"
                              style="mso-line-height-rule:exactly;mso-line-height-alt:11px;line-height:11px;font-size:1px;display:block;">
                              &nbsp;</div>
                          </td>
                        </tr>
                        <tr>
                          <td>
                            <div class="t50"
                              style="mso-line-height-rule:exactly;mso-line-height-alt:16px;line-height:16px;font-size:1px;display:block;">
                              &nbsp;</div>
                          </td>
                        </tr>
                        <tr>
                          <td>
                            <p class="t8"
                              style="margin:0;Margin:0;font-family:Poppins,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:22px;font-weight:500;font-style:normal;font-size:16px;text-decoration:none;text-transform:none;direction:ltr;color:#454545;text-align:left;mso-line-height-rule:exactly;mso-text-raise:2px;">
                              ${customerFullname || 'Estimado cliente'}:
                              </p>
                          </td>
                        </tr>
                        <tr>
                          <td>
                            <div class="t50"
                              style="mso-line-height-rule:exactly;mso-line-height-alt:10px;line-height:10px;font-size:1px;display:block;">
                              &nbsp;</div>
                          </td>
                        </tr>
                        <tr>
                          <td>
                            <p class="t8"
                              style="margin:0;Margin:0;font-family:Poppins,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:22px;font-weight:400;font-style:normal;font-size:14;text-decoration:none;text-transform:none;direction:ltr;color:#454545;text-align:left;mso-line-height-rule:exactly;mso-text-raise:2px;">
                              Por medio de la presente le informamos que hemos emitido exitosamente un Documento Tributario Electrónico (DTE) relacionado a su cuenta. Este documento es un comprobante oficial de la transacción realizada con nosotros.
                              A continuación, le proporcionamos los detalles del documento emitido:
                              </p>
                          </td>
                        </tr>
                        <tr>
                          <td>
                            <div class="t9"
                              style="mso-line-height-rule:exactly;mso-line-height-alt:34px;line-height:34px;font-size:1px;display:block;">
                              &nbsp;</div>
                          </td>
                        </tr>
                        <tr>
                          <td>
                            <table class="t15" role="presentation" cellpadding="0" cellspacing="0" align="center">
                              <tr>
                                <td class="t14"
                                  style="border:1px solid #E3E3E3;overflow:hidden;width:418px;padding:15px 30px 15px 30px;border-radius:6px 6px 0 0;">
                                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                      <td>
                                        <table class="t13" role="presentation" cellpadding="0" cellspacing="0"
                                          align="center">
                                          <tr>
                                            <td class="t12" style="width:480px;">
                                              <p class="t11"
                                                style="margin:0;Margin:0;font-family:Poppins,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:22px;font-weight:400;font-style:normal;font-size:16px;text-decoration:none;text-transform:none;direction:ltr;color:#454545;text-align:left;mso-line-height-rule:exactly;mso-text-raise:2px;">
                                                <span class="t10"
                                                  style="margin:0;Margin:0;font-weight:bold;mso-line-height-rule:exactly;">${dteTypeName || ''}</span></p>
                                            </td>
                                          </tr>
                                        </table>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td>
                            <table class="t31" role="presentation" cellpadding="0" cellspacing="0" align="center">
                              <tr>
                                <td class="t30"
                                  style="border:1px solid #E3E3E3;width:418px;padding:30px 30px 30px 30px;">
                                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                      <td>
                                        <table class="t19" role="presentation" cellpadding="0" cellspacing="0"
                                          align="center">
                                          <tr>
                                            <td class="t18" style="width:480px;">
                                              <p class="t17"
                                                style="margin:0;Margin:0;font-family:Poppins,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:22px;font-weight:400;font-style:normal;font-size:16px;text-decoration:none;text-transform:none;direction:ltr;color:#454545;text-align:left;mso-line-height-rule:exactly;mso-text-raise:2px;">
                                                <span class="t16"
                                                  style="margin:0;Margin:0;font-weight:bold;mso-line-height-rule:exactly;">Fecha Emisión:</span>
                                                  </p>
                                            </td>
                                          </tr>
                                          <tr>
                                            <td class="t18" style="width:480px;">
                                              <p class="t17"
                                                style="margin:0;Margin:0;font-family:Poppins,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:22px;font-weight:400;font-style:normal;font-size:16px;text-decoration:none;text-transform:none;direction:ltr;color:#454545;text-align:left;mso-line-height-rule:exactly;mso-text-raise:2px;">
                                                ${documentDate || ''}</p>
                                            </td>
                                          </tr>
                                        </table>
                                      </td>
                                    </tr>
                                    <tr>
                                      <td>
                                        <div class="t22"
                                          style="mso-line-height-rule:exactly;mso-line-height-alt:4px;line-height:4px;font-size:1px;display:block;">
                                          &nbsp;</div>
                                      </td>
                                    </tr>
                                    <tr>
                                      <td>
                                        <table class="t19" role="presentation" cellpadding="0" cellspacing="0"
                                          align="center">
                                          <tr>
                                            <td class="t18" style="width:480px;">
                                              <p class="t17"
                                                style="margin:0;Margin:0;font-family:Poppins,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:22px;font-weight:400;font-style:normal;font-size:16px;text-decoration:none;text-transform:none;direction:ltr;color:#454545;text-align:left;mso-line-height-rule:exactly;mso-text-raise:2px;">
                                                <span class="t16"
                                                  style="margin:0;Margin:0;font-weight:bold;mso-line-height-rule:exactly;">Número Control:</span>
                                                  </p>
                                            </td>
                                          </tr>
                                          <tr>
                                            <td class="t18" style="width:480px;">
                                              <p class="t17"
                                                style="margin:0;Margin:0;font-family:Poppins,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:22px;font-weight:400;font-style:normal;font-size:16px;text-decoration:none;text-transform:none;direction:ltr;color:#454545;text-align:left;mso-line-height-rule:exactly;mso-text-raise:2px;">
                                                ${controlNumber || ''}</p>
                                            </td>
                                          </tr>
                                        </table>
                                      </td>
                                    </tr>
                                    <tr>
                                      <td>
                                        <div class="t22"
                                          style="mso-line-height-rule:exactly;mso-line-height-alt:4px;line-height:4px;font-size:1px;display:block;">
                                          &nbsp;</div>
                                      </td>
                                    </tr>
                                    <tr>
                                      <td>
                                        <table class="t24" role="presentation" cellpadding="0" cellspacing="0"
                                          align="center">
                                          <tr>
                                            <td class="t23" style="width:480px;">
                                              <p class="t21"
                                                style="margin:0;Margin:0;font-family:Poppins,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:22px;font-weight:400;font-style:normal;font-size:16px;text-decoration:none;text-transform:none;direction:ltr;color:#454545;text-align:left;mso-line-height-rule:exactly;mso-text-raise:2px;">
                                                <span class="t20"
                                                  style="margin:0;Margin:0;font-weight:bold;mso-line-height-rule:exactly;">Código Generación:</span>
                                                  </p>
                                            </td>
                                          </tr>
                                          <tr>
                                            <td class="t23" style="width:480px;">
                                              <p class="t21"
                                                style="margin:0;Margin:0;font-family:Poppins,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:22px;font-weight:400;font-style:normal;font-size:16px;text-decoration:none;text-transform:none;direction:ltr;color:#454545;text-align:left;mso-line-height-rule:exactly;mso-text-raise:2px;">
                                                ${generationCode || ''}</p>
                                            </td>
                                          </tr>
                                        </table>
                                      </td>
                                    </tr>
                                    <tr>
                                      <td>
                                        <div class="t27"
                                          style="mso-line-height-rule:exactly;mso-line-height-alt:4px;line-height:4px;font-size:1px;display:block;">
                                          &nbsp;</div>
                                      </td>
                                    </tr>
                                    <tr>
                                      <td>
                                        <table class="t29" role="presentation" cellpadding="0" cellspacing="0"
                                          align="center">
                                          <tr>
                                            <td class="t28" style="width:480px;">
                                              <p class="t26"
                                                style="margin:0;Margin:0;font-family:Poppins,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:22px;font-weight:400;font-style:normal;font-size:16px;text-decoration:none;text-transform:none;direction:ltr;color:#454545;text-align:left;mso-line-height-rule:exactly;mso-text-raise:2px;">
                                                <span class="t25"
                                                  style="margin:0;Margin:0;font-weight:bold;mso-line-height-rule:exactly;">Sello de Recepción:</span>
                                                </p>
                                            </td>
                                          </tr>
                                          <tr>
                                            <td class="t28" style="width:480px;">
                                              <p class="t26"
                                                style="margin:0;Margin:0;font-family:Poppins,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:22px;font-weight:400;font-style:normal;font-size:16px;text-decoration:none;text-transform:none;direction:ltr;color:#454545;text-align:left;mso-line-height-rule:exactly;mso-text-raise:2px;">
                                                ${receptionStamp || ''}</p>
                                            </td>
                                          </tr>
                                        </table>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td>
                            <div class="t59"
                              style="mso-line-height-rule:exactly;mso-line-height-alt:50px;line-height:50px;font-size:1px;display:block;">
                              &nbsp;</div>
                          </td>
                        </tr>
                        <tr>
                          <td>
                            <table class="t61" role="presentation" cellpadding="0" cellspacing="0" align="center">
                              <tr>
                                <td class="t60"
                                  style="border-bottom:2px solid #EEEEEE;border-top:2px solid #EEEEEE;width:480px;padding:25px 0 25px 0;">
                                  <div class="t58"
                                    style="display:inline-table;width:100%;text-align:center;vertical-align:middle;">
                                    <div class="t57"
                                      style="display:inline-table;text-align:initial;vertical-align:inherit;width:100%;max-width:490px;">
                                      <div class="t56" style="padding:0 5px 0 5px;">
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                                          class="t55">
                                          <tr>
                                            <td class="t54">
                                              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                                <tr>
                                                  <td>
                                                    <table class="t47" role="presentation" cellpadding="0"
                                                      cellspacing="0" align="center">
                                                      <tr>
                                                        <td class="t46" style="width:480px;">
                                                          <p class="t45"
                                                            style="margin:0;Margin:0;font-family:Poppins,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:22px;font-weight:400;font-style:normal;font-size:14px;text-decoration:none;text-transform:none;direction:ltr;color:#454545;text-align:center;mso-line-height-rule:exactly;mso-text-raise:2px;">
                                                            Por favor, asegúrese de revisar los documentos adjuntos para verificar los detalles de la transacción. Si tiene alguna pregunta o necesita más información, no dude en ponerse en contacto con nosotros.</p>
                                                        </td>
                                                      </tr>
                                                    </table>
                                                  </td>
                                                </tr>
                                                <tr>
                                                  <td>
                                                    <div class="t50"
                                                      style="mso-line-height-rule:exactly;mso-line-height-alt:16px;line-height:16px;font-size:1px;display:block;">
                                                      &nbsp;</div>
                                                  </td>
                                                </tr>
                                                <tr>
                                                  <td>
                                                    <table class="t52" role="presentation" cellpadding="0"
                                                      cellspacing="0" align="center">
                                                      <tr>
                                                        <td class="t51" style="width:480px;">
                                                          <p class="t49"
                                                            style="margin:0;Margin:0;font-family:Poppins,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:22px;font-weight:400;font-style:normal;font-size:12px;text-decoration:none;text-transform:none;direction:ltr;color:#454545;text-align:left;mso-line-height-rule:exactly;mso-text-raise:2px;">
                                                            Conoce más en  <a class="t48"
                                                              href="https://factura.gob.sv"
                                                              style="margin:0;Margin:0;font-weight:700;font-style:normal;text-decoration:none;direction:ltr;color:#FF5A60;mso-line-height-rule:exactly;"
                                                              target="_blank">Facturación Electrónica El Salvador</a></p>
                                                        </td>
                                                      </tr>
                                                    </table>
                                                  </td>
                                                </tr>
                                              </table>
                                            </td>
                                          </tr>
                                        </table>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td>
                            <div class="t62"
                              style="mso-line-height-rule:exactly;mso-line-height-alt:40px;line-height:40px;font-size:1px;display:block;">
                              &nbsp;</div>
                          </td>
                        </tr>
                        <tr>
                          <td class="t39">
                            <div style="font-size:0px;"><img class="t37"
                                style="display:block;border:0;height:auto;width:75px;Margin:0;max-width:75px;"
                                width="73.23966942148759" height="58.375" alt=""
                                src="https://i.ibb.co/MnC8LLx/enapumalogo.png" />
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td>
                            <p class="t63"
                              style="margin:0;Margin:0;font-family:Poppins,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:22px;font-weight:500;font-style:normal;font-size:15px;text-decoration:none;text-transform:none;direction:ltr;color:#595959;text-align:left;mso-line-height-rule:exactly;mso-text-raise:3px;">
                              Puma Santa Rosa</p>
                          </td>
                        </tr>
                        <tr>
                          <td>
                            <p class="t64"
                              style="margin:0;Margin:0;font-family:Poppins,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:22px;font-weight:500;font-style:normal;font-size:13px;text-decoration:none;text-transform:none;direction:ltr;color:#949494;text-align:left;mso-line-height-rule:exactly;mso-text-raise:3px;">
                              Antigua Carretera Ruta Militar No 30, Santa Rosa de Lima, La Unión</p>
                          </td>
                        </tr>
                        <tr>
                          <td>
                            <p class="t64"
                              style="margin:0;Margin:0;font-family:Poppins,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:22px;font-weight:500;font-style:normal;font-size:13px;text-decoration:none;text-transform:none;direction:ltr;color:#949494;text-align:left;mso-line-height-rule:exactly;mso-text-raise:3px;">
                              +503 7940-6386</p>
                          </td>
                        </tr>
                        <tr>
                          <td>
                            <p class="t64"
                              style="margin:0;Margin:0;font-family:Poppins,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:22px;font-weight:500;font-style:normal;font-size:13px;text-decoration:none;text-transform:none;direction:ltr;color:#4096ff;text-align:left;mso-line-height-rule:exactly;mso-text-raise:3px;">
                              ventas.pumasantarosa@gmail.com</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
</body>

</html>
`);

export default generateDTEHTML;
