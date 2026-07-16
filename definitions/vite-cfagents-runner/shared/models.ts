export const MODELS = [
  { id: 'gpt-4o-mini', name: 'GPT-4o mini' },
  { id: 'gpt-4o', name: 'GPT-4o' },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini' },
] as const;

export type ModelId = (typeof MODELS)[number]['id'];

export const DEFAULT_MODEL: ModelId = MODELS[0].id;

export function isAllowedModel(model: unknown): model is ModelId {
  return typeof model === 'string' && MODELS.some(({ id }) => id === model);
}
