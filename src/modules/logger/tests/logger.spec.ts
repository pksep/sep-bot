import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from '../filters/all-exceptions.filter';
import { LoggerService } from '../logger.service';
import { mockReqId, mockRequest, mockContext } from './mocks/logger.mock';
import { REDACTED_BOT_TOKEN } from 'src/utils/logger/redact-bot-token';

describe('LoggerService', () => {
  describe('AllExceptionsFilter', () => {
    let filter: AllExceptionsFilter;
    let logger: jest.Mocked<LoggerService>;

    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    } as any;

    const mockHttpContext = {
      getRequest: jest.fn().mockReturnValue(mockRequest),
      getResponse: jest.fn().mockReturnValue(mockResponse)
    };

    const mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue(mockHttpContext)
    } as unknown as ArgumentsHost;

    beforeEach(() => {
      logger = {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn()
      } as unknown as jest.Mocked<LoggerService>;

      filter = new AllExceptionsFilter(logger);

      jest.clearAllMocks();
    });

    it('should handle HttpException correctly', () => {
      const exception = new HttpException(
        { message: 'Bad request' },
        HttpStatus.BAD_REQUEST
      );

      filter.catch(exception, mockArgumentsHost);

      expect(logger.error).toHaveBeenCalledWith(exception.message, mockContext);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.BAD_REQUEST,
        message: exception.getResponse(),
        reqId: mockReqId
      });
    });

    it('should handle generic error correctly', () => {
      const exception = new Error('Something went wrong');

      filter.catch(exception, mockArgumentsHost);

      expect(logger.error).toHaveBeenCalledWith(
        'Something went wrong',
        mockContext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        reqId: mockReqId
      });
    });

    it('should handle unknown exception', () => {
      const exception = 'unknown error';

      filter.catch(exception, mockArgumentsHost);

      expect(logger.error).toHaveBeenCalledWith('Unknown error', mockContext);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        reqId: mockReqId
      });
    });

    it('should redact a bot token from the exception request context', () => {
      const requestWithToken = {
        ...mockRequest,
        url: '/api/bot42:fake-secret/getMe?verbose=true'
      };
      mockHttpContext.getRequest.mockReturnValueOnce(requestWithToken);

      filter.catch(new Error('Invalid request'), mockArgumentsHost);

      expect(logger.error).toHaveBeenCalledWith(
        'Invalid request',
        `HTTP GET /api/bot${REDACTED_BOT_TOKEN}/getMe?verbose=true reqId=${mockReqId}`
      );
    });
  });
});
