const fileExtVerifications = {};

fileExtVerifications.verifyFileExtension = (fileName, targetExt) => {
  let re = /(?:\.([^.]+))?$/;
  let verified = re.exec(fileName);
  let ext = verified[1];

  if (ext !== undefined) {
    if (ext === targetExt) return true;
    return false;
  } else {
    throw 'Provide a valid file name!';
  }
};

fileExtVerifications.getFileExtension = (fileName) => {
  let re = /(?:\.([^.]+))?$/;
  let verified = re.exec(fileName);
  let ext = verified[1];

  return ext !== undefined ? ext : null;
};

export default fileExtVerifications;
