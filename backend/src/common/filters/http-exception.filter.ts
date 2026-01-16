import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorDetails: any = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || message;
        errorDetails = exceptionResponse;
      }
    } else if (exception instanceof Error) {
      message = exception.message;

      // Log full error details for debugging
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
      );

      // Check for Prisma errors
      if (exception.name === 'PrismaClientKnownRequestError') {
        const prismaError = exception as any;
        this.logger.error(`Prisma error code: ${prismaError.code}`);

        switch (prismaError.code) {
          case 'P2002':
            status = HttpStatus.CONFLICT;
            message = 'A record with this value already exists';
            break;
          case 'P2025':
            status = HttpStatus.NOT_FOUND;
            message = 'Record not found';
            break;
          case 'P2003':
            status = HttpStatus.BAD_REQUEST;
            message = 'Foreign key constraint failed';
            break;
          default:
            message = 'Database error occurred';
        }
      } else if (exception.name === 'PrismaClientValidationError') {
        status = HttpStatus.BAD_REQUEST;
        message = 'Invalid data provided';
      }
    }

    // Log the error with request context
    this.logger.error(
      `[${request.method}] ${request.url} - Status: ${status} - ${message}`,
      {
        body: request.body,
        query: request.query,
        params: request.params,
        user: (request as any).user?.userId || 'unauthenticated',
      },
    );

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(process.env.NODE_ENV !== 'production' && { errorDetails }),
    });
  }
}
