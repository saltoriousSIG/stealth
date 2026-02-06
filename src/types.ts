// TODO: Add streaming response types
// TODO: Add task/plan types when task queue is implemented

export interface Identity {
  soul: string;
  brain: string;
  imperative: string;
}

export interface SkillResult {
  success: boolean;
  response: string;
  error?: string;
}
