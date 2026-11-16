import { describe, expect, it } from 'vitest';
import * as core from '../src/index.js';

// Types leave no trace at run time, so this checks the functions only.
// The type exports (Difference, Field, FieldKind, HandoverRecord, Photo, Signature, VerifyResult)
// are checked by `npm run typecheck`, because the other tests import them.
describe('index exports', () => {
  it('exports exactly the functions of the design', () => {
    expect(Object.keys(core).sort()).toEqual([
      'buildCopyFile',
      'canonicalText',
      'diffRecords',
      'parseCopyFile',
      'sealRecord',
      'sealWords',
      'sha256Hex',
      'validateRecord',
      'verifyRecord',
    ]);
  });
});
