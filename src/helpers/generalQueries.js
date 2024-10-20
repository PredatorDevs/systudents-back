const generalQueries = {};

generalQueries.createAttachment = `
  INSERT INTO attachments (
    fileName,
    fileExtension,
    fileKey,
    fileUrl
  ) VALUES (
    ?,
    ?,
    ?,
    ?
  );
`;

export default generalQueries;
