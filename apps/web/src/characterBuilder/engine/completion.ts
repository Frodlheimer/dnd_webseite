import type { CharacterBuildStatus, ValidationIssue } from '../model/character';

export const resolveCharacterBuildStatus = (args: {
  blockingErrors: ValidationIssue[];
  pendingRequiredDecisions: number;
  warnings: ValidationIssue[];
}): CharacterBuildStatus => {
  if (args.blockingErrors.length > 0) {
    return 'invalid';
  }

  if (args.pendingRequiredDecisions === 0) {
    return 'ready';
  }

  if (args.pendingRequiredDecisions > 0 || args.warnings.length > 0) {
    return 'in_progress';
  }

  return 'draft';
};

