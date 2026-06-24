import { EnumFilePrefix } from '@pksep/zod-shared';
import * as uuid from 'uuid';

/**
 * Генерируем имя файла
 * @param fileType 'jpg' | 'doc'
 * @returns 'cbd88f3f-792c-4566-b201-348ac425d730.dmg'
 */
export const generateDocumentPath = (fileType: string): string => {
  const pathName = uuid.v4() + '.' + fileType;
  return pathName;
};

/**
 * Генерируем имя архива
 * @param name
 * @param version
 * @returns 'file.jpg_archive_v1'
 */
export const generateArchiveName = (name: string, version: number): string => {
  return name + `${EnumFilePrefix.Archive}v${version}`;
};
