// Mock for sharp package
const sharp = jest.fn().mockImplementation(() => ({
  resize: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  png: jest.fn().mockReturnThis(),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-image-data')),
  metadata: jest.fn().mockResolvedValue({
    width: 1920,
    height: 1080,
    format: 'jpeg'
  })
}));

export default sharp;