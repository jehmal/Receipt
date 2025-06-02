import { OCRService } from '../../services/ocr';
import { TestDataFactory } from '../fixtures/test-data';
import axios from 'axios';

// Mock external dependencies
jest.mock('axios');
jest.mock('../../config', () => ({
  ocr: {
    providers: {
      google: {
        enabled: true,
        apiKey: 'test-google-key',
        confidenceThreshold: 0.7
      },
      aws: {
        enabled: true,
        region: 'us-east-1',
        confidenceThreshold: 0.8
      },
      azure: {
        enabled: false,
        apiKey: 'test-azure-key',
        endpoint: 'https://test.cognitiveservices.azure.com/'
      }
    },
    defaultProvider: 'google',
    fallbackProviders: ['aws'],
    processingTimeout: 30000
  }
}));

const mockedAxios = jest.mocked(axios);

describe('OCRService', () => {
  let ocrService: OCRService;

  beforeEach(() => {
    jest.clearAllMocks();
    ocrService = new OCRService();
  });

  describe('Google Vision OCR', () => {
    it('should successfully extract text from receipt image', async () => {
      // Arrange
      const mockImageBuffer = Buffer.from('fake-image-data');
      const mockGoogleResponse = {
        data: {
          responses: [{
            textAnnotations: [
              {
                description: 'WALMART SUPERCENTER\n123 MAIN ST\nANYTOWN, CA 90210\n\nCoke 12pk    $4.99\nBread        $2.49\nMilk         $3.29\n\nSubtotal     $10.77\nTax          $0.86\nTotal        $11.63\n\n01/15/2024 15:30\nCard ending 1234',
                boundingPoly: {
                  vertices: [
                    { x: 10, y: 10 },
                    { x: 400, y: 10 },
                    { x: 400, y: 600 },
                    { x: 10, y: 600 }
                  ]
                }
              }
            ],
            fullTextAnnotation: {
              text: 'WALMART SUPERCENTER\n123 MAIN ST\nANYTOWN, CA 90210\n\nCoke 12pk    $4.99\nBread        $2.49\nMilk         $3.29\n\nSubtotal     $10.77\nTax          $0.86\nTotal        $11.63\n\n01/15/2024 15:30\nCard ending 1234'
            }
          }]
        }
      };

      mockedAxios.post.mockResolvedValue(mockGoogleResponse);

      // Act
      const result = await ocrService.extractTextFromImage(mockImageBuffer, 'google');

      // Assert
      expect(result).toEqual({
        success: true,
        provider: 'google',
        extractedText: mockGoogleResponse.data.responses[0].fullTextAnnotation.text,
        confidence: expect.any(Number),
        processingTimeMs: expect.any(Number),
        extractedData: {
          merchant: 'WALMART SUPERCENTER',
          address: '123 MAIN ST\nANYTOWN, CA 90210',
          total: 11.63,
          subtotal: 10.77,
          tax: 0.86,
          date: '01/15/2024',
          time: '15:30',
          paymentMethod: 'Card ending 1234',
          items: [
            { name: 'Coke 12pk', price: 4.99 },
            { name: 'Bread', price: 2.49 },
            { name: 'Milk', price: 3.29 }
          ]
        }
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://vision.googleapis.com/v1/images:annotate',
        expect.objectContaining({
          requests: [{
            image: {
              content: mockImageBuffer.toString('base64')
            },
            features: [
              { type: 'TEXT_DETECTION', maxResults: 10 },
              { type: 'DOCUMENT_TEXT_DETECTION', maxResults: 10 }
            ]
          }]
        }),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-google-key'
          },
          timeout: 30000
        })
      );
    });

    it('should handle Google Vision API errors gracefully', async () => {
      // Arrange
      const mockImageBuffer = Buffer.from('fake-image-data');
      const mockError = new Error('Google Vision API rate limit exceeded');
      mockedAxios.post.mockRejectedValue(mockError);

      // Act
      const result = await ocrService.extractTextFromImage(mockImageBuffer, 'google');

      // Assert
      expect(result).toEqual({
        success: false,
        provider: 'google',
        error: 'OCR_PROCESSING_FAILED',
        message: 'Google Vision API rate limit exceeded',
        processingTimeMs: expect.any(Number)
      });
    });

    it('should handle low confidence responses', async () => {
      // Arrange
      const mockImageBuffer = Buffer.from('fake-image-data');
      const mockLowConfidenceResponse = {
        data: {
          responses: [{
            textAnnotations: [
              {
                description: 'blurry text...',
                boundingPoly: {
                  vertices: [{ x: 10, y: 10 }, { x: 100, y: 10 }, { x: 100, y: 50 }, { x: 10, y: 50 }]
                }
              }
            ],
            fullTextAnnotation: {
              text: 'blurry text...'
            }
          }]
        }
      };

      mockedAxios.post.mockResolvedValue(mockLowConfidenceResponse);

      // Act
      const result = await ocrService.extractTextFromImage(mockImageBuffer, 'google');

      // Assert
      expect(result.success).toBe(true);
      expect(result.confidence).toBeLessThan(0.7); // Below threshold
      expect(result.extractedData.merchant).toBeUndefined();
      expect(result.extractedData.total).toBeUndefined();
    });
  });

  describe('AWS Textract OCR', () => {
    it('should successfully extract text using AWS Textract', async () => {
      // Arrange
      const mockImageBuffer = Buffer.from('fake-image-data');
      const mockAWSResponse = {
        Blocks: [
          {
            BlockType: 'LINE',
            Text: 'TARGET STORE #1234',
            Confidence: 95.5
          },
          {
            BlockType: 'LINE',
            Text: 'Item 1    $12.99',
            Confidence: 89.2
          },
          {
            BlockType: 'LINE',
            Text: 'Total     $12.99',
            Confidence: 92.1
          }
        ]
      };

      // Mock AWS SDK calls
      const mockTextract = {
        detectDocumentText: jest.fn().mockReturnValue({
          promise: jest.fn().mockResolvedValue(mockAWSResponse)
        })
      };

      // Mock AWS config
      jest.doMock('aws-sdk', () => ({
        Textract: jest.fn(() => mockTextract),
        config: {
          update: jest.fn()
        }
      }));

      // Act
      const result = await ocrService.extractTextFromImage(mockImageBuffer, 'aws');

      // Assert
      expect(result).toEqual({
        success: true,
        provider: 'aws',
        extractedText: 'TARGET STORE #1234\nItem 1    $12.99\nTotal     $12.99',
        confidence: expect.any(Number),
        processingTimeMs: expect.any(Number),
        extractedData: {
          merchant: 'TARGET STORE #1234',
          total: 12.99,
          items: [
            { name: 'Item 1', price: 12.99 }
          ]
        }
      });
    });

    it('should handle AWS Textract errors', async () => {
      // Arrange
      const mockImageBuffer = Buffer.from('fake-image-data');
      const mockError = new Error('AWS Textract service unavailable');

      const mockTextract = {
        detectDocumentText: jest.fn().mockReturnValue({
          promise: jest.fn().mockRejectedValue(mockError)
        })
      };

      jest.doMock('aws-sdk', () => ({
        Textract: jest.fn(() => mockTextract),
        config: { update: jest.fn() }
      }));

      // Act
      const result = await ocrService.extractTextFromImage(mockImageBuffer, 'aws');

      // Assert
      expect(result).toEqual({
        success: false,
        provider: 'aws',
        error: 'OCR_PROCESSING_FAILED',
        message: 'AWS Textract service unavailable',
        processingTimeMs: expect.any(Number)
      });
    });
  });

  describe('Multi-provider fallback', () => {
    it('should fallback to secondary provider when primary fails', async () => {
      // Arrange
      const mockImageBuffer = Buffer.from('fake-image-data');
      
      // Mock primary provider (Google) failure
      mockedAxios.post.mockRejectedValueOnce(new Error('Google API quota exceeded'));
      
      // Mock secondary provider (AWS) success
      const mockAWSResponse = {
        Blocks: [
          {
            BlockType: 'LINE',
            Text: 'WALMART\nTotal $25.99',
            Confidence: 88.5
          }
        ]
      };

      const mockTextract = {
        detectDocumentText: jest.fn().mockReturnValue({
          promise: jest.fn().mockResolvedValue(mockAWSResponse)
        })
      };

      jest.doMock('aws-sdk', () => ({
        Textract: jest.fn(() => mockTextract),
        config: { update: jest.fn() }
      }));

      // Act
      const result = await ocrService.extractTextWithFallback(mockImageBuffer);

      // Assert
      expect(result.success).toBe(true);
      expect(result.provider).toBe('aws');
      expect(result.extractedText).toContain('WALMART');
      expect(result.fallbackUsed).toBe(true);
      expect(result.primaryError).toContain('Google API quota exceeded');
    });

    it('should return error when all providers fail', async () => {
      // Arrange
      const mockImageBuffer = Buffer.from('fake-image-data');
      
      // Mock all providers failing
      mockedAxios.post.mockRejectedValue(new Error('Google API down'));
      
      const mockTextract = {
        detectDocumentText: jest.fn().mockReturnValue({
          promise: jest.fn().mockRejectedValue(new Error('AWS Textract down'))
        })
      };

      jest.doMock('aws-sdk', () => ({
        Textract: jest.fn(() => mockTextract),
        config: { update: jest.fn() }
      }));

      // Act
      const result = await ocrService.extractTextWithFallback(mockImageBuffer);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('ALL_OCR_PROVIDERS_FAILED');
      expect(result.providerErrors).toEqual({
        google: 'Google API down',
        aws: 'AWS Textract down'
      });
    });
  });

  describe('Receipt data parsing', () => {
    it('should parse receipt data from extracted text correctly', async () => {
      // Arrange
      const extractedText = `
        COSTCO WHOLESALE
        1234 RETAIL ROAD
        ANYTOWN, CA 90210
        
        ORGANIC BANANAS        4.99
        KIRKLAND WATER         7.99
        ROTISSERIE CHICKEN    12.99
        
        SUBTOTAL              25.97
        TAX                    2.34
        TOTAL                 28.31
        
        MASTERCARD ****1234
        01/15/2024 14:30:25
        MEMBER: 123456789
      `;

      // Act
      const parsedData = await ocrService.parseReceiptData(extractedText);

      // Assert
      expect(parsedData).toEqual({
        merchant: 'COSTCO WHOLESALE',
        address: '1234 RETAIL ROAD\nANYTOWN, CA 90210',
        total: 28.31,
        subtotal: 25.97,
        tax: 2.34,
        date: '01/15/2024',
        time: '14:30:25',
        paymentMethod: 'MASTERCARD ****1234',
        memberNumber: '123456789',
        items: [
          { name: 'ORGANIC BANANAS', price: 4.99 },
          { name: 'KIRKLAND WATER', price: 7.99 },
          { name: 'ROTISSERIE CHICKEN', price: 12.99 }
        ]
      });
    });

    it('should handle various receipt formats', async () => {
      // Arrange - Different receipt format
      const extractedText = `
        McDONALD'S #12345
        Big Mac Meal         $8.99
        Large Fries         $2.49
        Coca Cola           $1.99
        ========================
        Subtotal:          $13.47
        Tax:               $1.08
        Total:             $14.55
        
        VISA ending in 5678
        12/25/2023 18:45
      `;

      // Act
      const parsedData = await ocrService.parseReceiptData(extractedText);

      // Assert
      expect(parsedData.merchant).toBe("MCDONALD'S #12345");
      expect(parsedData.total).toBe(14.55);
      expect(parsedData.items).toHaveLength(3);
      expect(parsedData.items[0]).toEqual({ name: 'Big Mac Meal', price: 8.99 });
    });

    it('should handle receipts with no clear item separation', async () => {
      // Arrange
      const extractedText = `
        STARBUCKS STORE #5678
        COFFEE $4.95 TAX $0.40
        TOTAL $5.35
        01/01/2024
      `;

      // Act
      const parsedData = await ocrService.parseReceiptData(extractedText);

      // Assert
      expect(parsedData.merchant).toBe('STARBUCKS STORE #5678');
      expect(parsedData.total).toBe(5.35);
      expect(parsedData.tax).toBe(0.40);
      expect(parsedData.date).toBe('01/01/2024');
    });
  });

  describe('Performance and optimization', () => {
    it('should process image within acceptable time limits', async () => {
      // Arrange
      const mockImageBuffer = Buffer.from('fake-image-data');
      const startTime = Date.now();

      mockedAxios.post.mockImplementation(() => {
        // Simulate processing delay
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              data: {
                responses: [{
                  fullTextAnnotation: { text: 'Test receipt data' }
                }]
              }
            });
          }, 100); // 100ms delay
        });
      });

      // Act
      const result = await ocrService.extractTextFromImage(mockImageBuffer, 'google');
      const processingTime = Date.now() - startTime;

      // Assert
      expect(result.success).toBe(true);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.processingTimeMs).toBeGreaterThan(50);
      expect(result.processingTimeMs).toBeLessThan(1000);
    });

    it('should handle large image files efficiently', async () => {
      // Arrange - Create a large mock image buffer (5MB)
      const largeImageBuffer = Buffer.alloc(5 * 1024 * 1024, 'fake-image-data');

      mockedAxios.post.mockResolvedValue({
        data: {
          responses: [{
            fullTextAnnotation: { text: 'Large image processed successfully' }
          }]
        }
      });

      // Act
      const result = await ocrService.extractTextFromImage(largeImageBuffer, 'google');

      // Assert
      expect(result.success).toBe(true);
      expect(result.extractedText).toContain('Large image processed successfully');
      
      // Verify the image was sent as base64
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          requests: [{
            image: {
              content: largeImageBuffer.toString('base64')
            },
            features: expect.any(Array)
          }]
        }),
        expect.any(Object)
      );
    });

    it('should timeout requests that take too long', async () => {
      // Arrange
      const mockImageBuffer = Buffer.from('fake-image-data');

      mockedAxios.post.mockImplementation(() => {
        return new Promise((resolve, reject) => {
          // Simulate a request that never completes
          setTimeout(() => {
            reject(new Error('Request timeout'));
          }, 35000); // Longer than our 30s timeout
        });
      });

      // Act
      const result = await ocrService.extractTextFromImage(mockImageBuffer, 'google');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('OCR_PROCESSING_FAILED');
      expect(result.message).toContain('timeout');
    });
  });

  describe('Data quality and validation', () => {
    it('should validate extracted data quality', async () => {
      // Arrange
      const mockImageBuffer = Buffer.from('fake-image-data');
      const mockHighQualityResponse = {
        data: {
          responses: [{
            textAnnotations: [
              {
                description: 'WALMART\nTotal: $15.99\n01/15/2024',
                boundingPoly: {
                  vertices: [{ x: 10, y: 10 }, { x: 200, y: 10 }, { x: 200, y: 100 }, { x: 10, y: 100 }]
                }
              }
            ],
            fullTextAnnotation: {
              text: 'WALMART\nTotal: $15.99\n01/15/2024'
            }
          }]
        }
      };

      mockedAxios.post.mockResolvedValue(mockHighQualityResponse);

      // Act
      const result = await ocrService.extractTextFromImage(mockImageBuffer, 'google');

      // Assert
      expect(result.success).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.extractedData.merchant).toBe('WALMART');
      expect(result.extractedData.total).toBe(15.99);
      expect(result.extractedData.date).toBe('01/15/2024');
      expect(result.dataQuality).toEqual({
        hasMerchant: true,
        hasTotal: true,
        hasDate: true,
        hasItems: false,
        overallScore: expect.any(Number)
      });
    });

    it('should flag low quality extractions', async () => {
      // Arrange
      const mockImageBuffer = Buffer.from('fake-image-data');
      const mockLowQualityResponse = {
        data: {
          responses: [{
            fullTextAnnotation: {
              text: 'blurry... unclear... $??'
            }
          }]
        }
      };

      mockedAxios.post.mockResolvedValue(mockLowQualityResponse);

      // Act
      const result = await ocrService.extractTextFromImage(mockImageBuffer, 'google');

      // Assert
      expect(result.success).toBe(true);
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.dataQuality.overallScore).toBeLessThan(0.3);
      expect(result.dataQuality.hasMerchant).toBe(false);
      expect(result.dataQuality.hasTotal).toBe(false);
      expect(result.requiresManualReview).toBe(true);
    });
  });
}); 