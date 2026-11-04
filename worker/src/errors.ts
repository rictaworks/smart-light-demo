/** 想定内の HTTP エラー。Hono の onError で { detail } 形式の JSON に変換する（FastAPI の応答形式に合わせる）。 */
export class HttpError extends Error {
  constructor(
    readonly status: 400 | 401 | 404 | 409 | 415 | 422,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function validationError(message: string): HttpError {
  return new HttpError(422, message);
}
