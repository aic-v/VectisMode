import { describe, it, expect } from 'vitest';
import { isValidBoard } from './storage.js';
import { INITIAL_ITEMS } from './board.js';

const validBoard = () => JSON.parse(JSON.stringify(INITIAL_ITEMS));

describe('isValidBoard', () => {
  it('accepts the initial board shape', () => {
    expect(isValidBoard(validBoard())).toBe(true);
  });

  it('rejects null, arrays, and primitives', () => {
    expect(isValidBoard(null)).toBe(false);
    expect(isValidBoard([])).toBe(false);
    expect(isValidBoard('board')).toBe(false);
  });

  it('rejects a board missing a column', () => {
    const board = validBoard();
    delete board.archive;
    expect(isValidBoard(board)).toBe(false);
  });

  it('rejects a column that is not an array', () => {
    const board = validBoard();
    board.waiting = {};
    expect(isValidBoard(board)).toBe(false);
  });

  it('rejects cards without a string id and title', () => {
    const board = validBoard();
    board['user-3'] = [{ id: 42, title: 'numeric id' }];
    expect(isValidBoard(board)).toBe(false);

    board['user-3'] = [{ id: 'ok' }];
    expect(isValidBoard(board)).toBe(false);
  });
});
