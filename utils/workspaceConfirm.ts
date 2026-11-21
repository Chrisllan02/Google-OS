export interface WorkspaceConfirmRequest {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmHandler = (req: WorkspaceConfirmRequest) => Promise<boolean>;

let activeHandler: ConfirmHandler | null = null;

export function registerWorkspaceConfirmHandler(handler: ConfirmHandler | null): void {
  activeHandler = handler;
}

/**
 * Prompts the user with an explicit in-app confirmation modal before executing
 * any mutating or destructive operation against their real Google Workspace account.
 * Fails closed (returns false) if no confirmation UI is mounted.
 */
export async function confirmWorkspaceAction(req: WorkspaceConfirmRequest): Promise<boolean> {
  if (!activeHandler) {
    return false;
  }
  return activeHandler(req);
}
