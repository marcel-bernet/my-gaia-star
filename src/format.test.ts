import { expect, it } from 'vitest';
import { roundToError } from './format';

it('rounds a value to the place of its uncertainty', () => {
  expect(roundToError(2712, 384)).toEqual({ value: 2700, err: 400, digits: 0 });
  expect(roundToError(1847, 123)).toEqual({ value: 1850, err: 120, digits: 0 });
  expect(roundToError(14.27, 0.34)).toEqual({ value: 14.3, err: 0.3, digits: 1 });
  expect(roundToError(-638, 384)).toEqual({ value: -600, err: 400, digits: 0 });
});
