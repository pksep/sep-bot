import { Inject, Injectable } from '@nestjs/common';
import { Client } from 'minio';
import { ConfigService } from '@nestjs/config';
import { S3_PROVIDE_NAME } from './s3.module';
import { ConfigConstains } from 'src/configs/env.config';
import mime from 'mime';
import { calculateHash } from 'src/utils/methods/hash';

export interface IPutObjectResponse {
  objectName: string;
  hash: string;
  etag: string;
}

@Injectable()
export class S3Service {
  private readonly bucketName: string;
  private readonly publicBaseUrl: string;

  constructor(
    @Inject(S3_PROVIDE_NAME) private readonly s3Client: Client,
    private readonly configService: ConfigService
  ) {
    this.bucketName = this.configService.get<string>(
      ConfigConstains.minio.bucketName
    );
    this.publicBaseUrl = this.configService.get<string>(
      ConfigConstains.minio.publicBaseUrl
    );
  }

  async putObject(
    objectName: string,
    buffer: Buffer,
    contentType?: string
  ): Promise<IPutObjectResponse> {
    const mimeType = mime.getType(objectName) || 'application/octet-stream';
    const hash = await calculateHash(buffer);

    const result = await this.s3Client.putObject(
      this.bucketName,
      objectName,
      buffer,
      buffer.length,
      {
        'Content-Type': contentType ?? mimeType,
        'x-amz-meta-hash': hash
      }
    );

    return { objectName, hash, etag: result.etag };
  }

  async getObject(objectName: string) {
    return this.s3Client.getObject(this.bucketName, objectName);
  }

  async removeObject(objectName: string) {
    return this.s3Client.removeObject(this.bucketName, objectName);
  }

  async listObjects(prefix = '') {
    return this.s3Client.listObjects(this.bucketName, prefix, true);
  }

  async exists(objectName: string): Promise<boolean> {
    try {
      await this.s3Client.statObject(this.bucketName, objectName);
      return true;
    } catch (err: any) {
      if (['NoSuchKey', 'NotFound'].includes(err.code)) {
        return false;
      }
      throw err;
    }
  }

  async getSignedUrl(
    objectName: string,
    downloadName?: string,
    expiry = 24 * 60 * 60
  ): Promise<string> {
    return this.s3Client.presignedGetObject(
      this.bucketName,
      objectName,
      expiry,
      downloadName
        ? {
            'response-content-disposition': `attachment; filename="${downloadName}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`
          }
        : undefined
    );
  }

  getPublicUrl(objectName: string): string {
    if (!this.publicBaseUrl)
      throw new Error('Public base URL is not configured!');
    return `${this.publicBaseUrl}/${this.bucketName}/${objectName}`;
  }
}
