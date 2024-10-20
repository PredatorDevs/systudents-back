
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createReadStream } from 'fs';
import { config } from 'dotenv';

config();

const AWS_BUCKET_NAME = process.env.AWS_BUCKET_NAME;
const AWS_BUCKET_REGION = process.env.AWS_BUCKET_REGION;
const AWS_PUBLIC_KEY = process.env.AWS_PUBLIC_KEY;
const AWS_MY_SECRET_KEY = process.env.AWS_MY_SECRET_KEY;

const client = new S3Client({
  region: AWS_BUCKET_REGION,
  credentials: {
    accessKeyId: AWS_PUBLIC_KEY,
    secretAccessKey: AWS_MY_SECRET_KEY
  }
});

const getFileContentType = (extension) => {
  switch(extension) {
    case 'pdf': return 'application/pdf';
    case 'png': return 'image/png';
    case 'jpeg': return 'image/jpeg';
    case 'jpg': return 'image/jpeg';
    case 'xls': return 'application/vnd.ms-excel';
    case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'doc': return 'application/msword';
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    default: return 'application/pdf';
  }
}

const s3Methods = {};

s3Methods.uploadFile = async (file, key, extension) => {
  const stream = createReadStream(file);
  const params = {
    Bucket: AWS_BUCKET_NAME,
    Key: `${key}`,
    Body: stream,
    ACL: 'public-read',
    ContentDisposition: 'inline',
    ContentType: getFileContentType(extension)
  }
  const command = new PutObjectCommand(params);
  return await client.send(command);
};

export default s3Methods;
