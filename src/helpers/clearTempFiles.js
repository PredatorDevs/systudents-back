import * as fs from 'fs';

const clearTempFiles = {};

clearTempFiles.clearUploads = () => {
  fs.readdir('./src/temp/uploads', (err, files) => {
    if (err) throw err;
    for (const file of files) {
      fs.unlink(`./src/temp/uploads/${file}`, (err) => {
        if (err) throw err;
      });
    }
  });
};

clearTempFiles.clearDownloads = () => {
  fs.readdir('./src/temp/downloads', (err, files) => {
    if (err) throw err;
    for (const file of files) {
      fs.unlink(`./src/temp/downloads/${file}`, (err) => {
        if (err) throw err;
      });
    }
  });
};

export default clearTempFiles;
