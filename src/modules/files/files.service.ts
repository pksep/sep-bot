import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { FileRecord } from './model/files.model';
import { S3Service } from '../s3/s3.service';
import { createHash, randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { ConfigConstains } from 'src/configs/env.config';

@Injectable()
export class FilesService {
  private readonly bucketName: string;

  constructor(
    @InjectModel(FileRecord) private fileRepository: typeof FileRecord,
    private s3Service: S3Service,
    private configService: ConfigService
  ) {
    this.bucketName = this.configService.get<string>(ConfigConstains.minio.bucketName);
  }

  private generateFileId(type: string, uploaderId: number): string {
    const random = randomBytes(16).toString('hex');
    const timestamp = Date.now().toString(36);
    return Buffer.from(`${type}:${uploaderId}:${random}:${timestamp}`).toString('base64url');
  }

  private generateFileUniqueId(): string {
    return randomBytes(12).toString('base64url');
  }

  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    uploaderId: number,
    uploaderType: 'user' | 'bot'
  ): Promise<{ fileId: string; fileUniqueId: string }> {
    const fileId = this.generateFileId(uploaderType, uploaderId);
    const fileUniqueId = this.generateFileUniqueId();
    const objectKey = `files/${fileUniqueId}/${originalName}`;

    await this.s3Service.putObject(objectKey, buffer, mimeType);

    await this.fileRepository.create({
      fileId,
      fileUniqueId,
      uploaderUserId: uploaderType === 'user' ? uploaderId : null,
      uploaderBotId: uploaderType === 'bot' ? uploaderId : null,
      originalName,
      mimeType,
      fileSize: buffer.length,
      s3ObjectKey: objectKey,
      s3Bucket: this.bucketName
    } as any);

    return { fileId, fileUniqueId };
  }

  async getFile(fileId: string): Promise<{ file: FileRecord; url: string }> {
    const file = await this.fileRepository.findOne({ where: { fileId } });
    if (!file) throw new HttpException('Файл не найден', HttpStatus.NOT_FOUND);

    const url = await this.s3Service.getSignedUrl(file.s3ObjectKey, file.originalName);
    return { file, url };
  }

  async deleteFile(fileId: string): Promise<boolean> {
    const file = await this.fileRepository.findOne({ where: { fileId } });
    if (!file) throw new HttpException('Файл не найден', HttpStatus.NOT_FOUND);

    await this.s3Service.removeObject(file.s3ObjectKey);
    await file.destroy();
    return true;
  }
}
