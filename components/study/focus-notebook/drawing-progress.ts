import {
  drawingTimeline,
  sampleDrawing,
  clampDrawingProgress,
} from "@/lib/focus-notebook";

/** Small imperative SVG renderer; React does not render on animation frames. */
export function createDrawingProgress(svg: SVGSVGElement) {
  const paths = Array.from(
    svg.querySelectorAll<SVGPathElement>("[data-notebook-stroke]"),
  );
  const pencil = svg.querySelector<SVGGElement>("[data-notebook-pencil]");
  const check = svg.querySelector<SVGGElement>("[data-notebook-check]");
  let geometry = true;
  const lengths = paths.map((path) => {
    try {
      const length = path.getTotalLength();
      if (length > 0 && Number.isFinite(length)) return length;
    } catch {
      /* Fall back to static ink. */
    }
    geometry = false;
    return 1;
  });
  const timeline = drawingTimeline(lengths);
  const previous = paths.map(() => -1);
  return (value: number, reducedMotion: boolean) => {
    const progress = clampDrawingProgress(value);
    const sample = sampleDrawing(timeline, progress);
    paths.forEach((path, index) => {
      const fraction =
        index < sample.index ? 1 : index === sample.index ? sample.fraction : 0;
      if (previous[index] !== fraction) {
        path.setAttribute("stroke-dashoffset", String(1 - fraction));
        path.style.visibility = fraction > 0 ? "visible" : "hidden";
        previous[index] = fraction;
      }
    });
    if (pencil) {
      if (reducedMotion) pencil.setAttribute("transform", "translate(306 144)");
      else if (geometry && paths[sample.index]) {
        try {
          const point = paths[sample.index].getPointAtLength(
            lengths[sample.index] * sample.fraction,
          );
          if (sample.lift > 0 && paths[sample.index + 1]) {
            const next = paths[sample.index + 1].getPointAtLength(0);
            point.x += (next.x - point.x) * sample.lift;
            point.y += (next.y - point.y) * sample.lift;
          }
          pencil.setAttribute("transform", `translate(${point.x} ${point.y})`);
        } catch {
          geometry = false;
        }
      }
      pencil.style.visibility =
        geometry || reducedMotion ? "visible" : "hidden";
      pencil.style.opacity = sample.lift > 0 && !reducedMotion ? ".45" : "1";
    }
    if (check) check.style.visibility = progress === 1 ? "visible" : "hidden";
    svg.dataset.progress = String(progress);
    svg.dataset.strokeIndex = String(sample.index);
    svg.dataset.strokeFraction = String(sample.fraction);
    svg.dataset.penLift = String(sample.lift);
    svg.dataset.reducedMotion = String(reducedMotion);
  };
}
