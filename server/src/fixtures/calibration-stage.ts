import type { PipelineStage } from "./pipeline-stages.js";

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export const calibrationStage: PipelineStage = (ctx) => {
  if (ctx.gateClosed) return ctx;
  if (!ctx.fixture.colorCalibration) return ctx;

  const { gain, offset } = ctx.fixture.colorCalibration;
  return {
    ...ctx,
    r: clamp(ctx.r * gain.r + offset.r),
    g: clamp(ctx.g * gain.g + offset.g),
    b: clamp(ctx.b * gain.b + offset.b),
  };
};
