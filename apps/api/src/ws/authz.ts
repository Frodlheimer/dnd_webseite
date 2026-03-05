import type { MapEditPolicy, MapEditUserOverride, Role, TokenControlledBy, TokenMovePolicy } from '@dnd-vtt/shared';

export type TokenAction = 'create' | 'move' | 'delete';

const hasTokenOwnership = (controlledBy: TokenControlledBy, userId: string): boolean => {
  if (controlledBy.mode === 'ALL') {
    return true;
  }

  return controlledBy.userIds.includes(userId);
};

export const canUpdateRoomSettings = (role: Role): boolean => {
  return role === 'DM';
};

export const canSetRoomMap = (role: Role): boolean => {
  return role === 'DM';
};

export const canUseMapEdit = (args: {
  role: Role;
  userId: string;
  mapEditPolicy: MapEditPolicy;
  mapEditUserOverrides: MapEditUserOverride[];
}): boolean => {
  if (args.role === 'DM') {
    return true;
  }

  const override = args.mapEditUserOverrides.find((entry) => entry.userId === args.userId);
  if (override) {
    return override.enabled;
  }

  if (args.role === 'PLAYER') {
    return args.mapEditPolicy === 'PLAYERS';
  }

  return false;
};

export const canPerformTokenAction = (args: {
  role: Role;
  tokenMovePolicy: TokenMovePolicy;
  action: TokenAction;
  userId: string;
  controlledBy?: TokenControlledBy;
}): boolean => {
  if (args.role === 'DM') {
    return true;
  }

  if (args.role === 'SPECTATOR') {
    return false;
  }

  if (args.tokenMovePolicy === 'DM_ONLY') {
    return false;
  }

  if (args.tokenMovePolicy === 'ALL') {
    return true;
  }

  if (args.action === 'create') {
    return true;
  }

  if (!args.controlledBy) {
    return false;
  }

  return hasTokenOwnership(args.controlledBy, args.userId);
};
