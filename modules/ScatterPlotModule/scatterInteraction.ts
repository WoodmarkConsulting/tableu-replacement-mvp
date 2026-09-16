type ScatterControllerEvent = {
  type: string;
  srcEvent: {
    ctrlKey?: boolean;
  };
};

export function shouldHandleScatterControllerEvent(
  event: ScatterControllerEvent,
): boolean {
  return event.type !== "wheel" || event.srcEvent.ctrlKey === true;
}
