export type ApiEnvelope<T> = {
  statusCode: number
  message: string
  data: T
}
