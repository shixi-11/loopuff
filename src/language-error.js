export class LessonError extends Error {
  constructor(code, position = 0) { super(code); this.code = code; this.position = position; }
}
