// Mock for file-type package
export const fileTypeFromBuffer = jest.fn().mockResolvedValue({
  ext: 'jpg',
  mime: 'image/jpeg'
});

export default {
  fileTypeFromBuffer
};