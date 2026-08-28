import { GUARDS_METADATA } from '@nestjs/common/constants';
import { BotsController } from '../../bots/bots.controller';
import { TokenAuth } from '../jwt-auth.guard';

describe('API authentication boundaries', () => {
  it('защищает BotsController обязательным JWT guard', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, BotsController) ?? [];

    expect(guards).toContain(TokenAuth);
  });
});
