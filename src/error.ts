export class DbError extends Error {
  constructor(message?: string) {
    super(message ?? 'Unknown DB Error')
  }
}

export type DBError = DbError

export class DisconnectedError extends DbError {
  constructor(message?: string) {
    super(message ?? 'Disconnected')
  }
}

export class NotFoundError extends DbError {
  constructor(message?: string) {
    super(message ?? 'Not Found')
  }
}

export class ConflictError extends DbError {
  constructor(message?: string) {
    super(message ?? 'Conflict')
  }
}

export class TransactionError extends DbError {
  constructor(message?: string) {
    super(message ?? 'Transaction Error')
  }
}

export class UnacknowledgedError extends DbError {
  constructor(message?: string) {
    super(message ?? 'Unacknowledged')
  }
}
