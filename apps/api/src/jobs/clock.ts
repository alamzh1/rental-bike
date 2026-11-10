import { Injectable } from '@nestjs/common';

/** Текущее время для правил броней (удержание, отмена, неявка). В тестах подменяется. */
@Injectable()
export class Clock {
  now(): Date {
    return new Date();
  }
}
