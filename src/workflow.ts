export type WorkflowStatus = 'NEW' | 'ASSIGNED' | 'TRANSCRIBED' | 'REVIEWED' | 'COMPLETED';

const validTransitions: Record<WorkflowStatus, WorkflowStatus[]> = {
  NEW: ['ASSIGNED'],
  ASSIGNED: ['TRANSCRIBED'],
  TRANSCRIBED: ['REVIEWED'],
  REVIEWED: ['COMPLETED'],
  COMPLETED: [],
};

export function canTransition(from: WorkflowStatus, to: WorkflowStatus): boolean {
  return validTransitions[from].includes(to);
}

export function assertTransition(from: WorkflowStatus, to: WorkflowStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid workflow transition: ${from} -> ${to}`);
  }
}

export function nextStatuses(from: WorkflowStatus): WorkflowStatus[] {
  return [...validTransitions[from]];
}
