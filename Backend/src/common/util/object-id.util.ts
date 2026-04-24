import { BadRequestException } from '@nestjs/common';
import { isValidObjectId, Types } from 'mongoose';

/**
 * Parse một string thành `ObjectId`, ném `BadRequestException` nếu không hợp lệ.
 * Dùng chung để không lặp lại util riêng trong từng service.
 */
export function toObjectId(
  id: string,
  message = 'id không hợp lệ',
): Types.ObjectId {
  if (!isValidObjectId(id)) {
    throw new BadRequestException(message);
  }
  return new Types.ObjectId(id);
}
