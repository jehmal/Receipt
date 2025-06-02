// Mock for minio package
export const Client = jest.fn().mockImplementation(() => ({
  putObject: jest.fn().mockResolvedValue('mock-etag'),
  removeObject: jest.fn().mockResolvedValue(undefined),
  getObject: jest.fn().mockResolvedValue(Buffer.from('mock-file-data')),
  presignedUrl: jest.fn().mockResolvedValue('https://mock-presigned-url.com/file'),
  bucketExists: jest.fn().mockResolvedValue(true),
  makeBucket: jest.fn().mockResolvedValue(undefined)
}));

export default {
  Client
};