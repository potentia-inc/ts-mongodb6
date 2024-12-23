import {
  CommandOperationOptions,
  Db,
  Document,
  MongoClient,
  MongoClientOptions,
  MongoError,
} from 'mongodb'
import { ConflictError, DisconnectedError, TransactionError } from './error.js'

export class Connection {
  #client?: MongoClient = undefined
  #uri: string
  #options?: MongoClientOptions

  get client(): MongoClient {
    if (this.#client === undefined) throw new DisconnectedError()
    return this.#client
  }

  get db(): Db {
    return this.client.db()
  }

  constructor(uri: string, options?: MongoClientOptions) {
    this.#uri = uri
    this.#options = options
  }

  async connect(): Promise<MongoClient> {
    if (this.#client === undefined) {
      const client = await MongoClient.connect(this.#uri, this.#options)
      ;['error', 'timeout', 'parseError'].forEach((event) => {
        client.on(event, (...args) =>
          console.error(`db event ${event}: ${JSON.stringify(args)}`),
        )
      })
      if (this.#client === undefined) this.#client = client
    }
    return this.#client
  }

  async disconnect(force = false): Promise<void> {
    if (this.#client !== undefined) {
      const client = this.#client
      this.#client = undefined
      await client.close(force)
    }
  }

  async transaction<T>(
    fn: (options: CommandOperationOptions) => Promise<T>,
    options: CommandOperationOptions = {},
  ): Promise<T> {
    if (options?.session !== undefined) return await fn(options)
    const session = this.client.startSession()
    try {
      return await session.withTransaction(
        async (session) => await fn({ ...options, session }),
      )
    } catch (err) {
      if (isDuplicationError(err)) throw new ConflictError()
      if (isTransactionError(err)) throw new TransactionError()
      throw err
    } finally {
      await session.endSession()
    }
  }

  async migrate<Doc extends Document>({
    name,
    validator,
    indexes = {},
  }: {
    name: string
    validator?: Document
    indexes?: Document
  }): Promise<void> {
    const collection = await (async () => {
      try {
        return await this.db.createCollection<Doc>(name)
      } catch (err) {
        return this.db.collection<Doc>(name)
      }
    })()

    // create/update the current index
    for (const name of Object.keys(indexes)) {
      const { keys, options = {} } = indexes[name]
      try {
        // try to create the index
        await collection.createIndex(keys, { name, ...options })
      } catch (err) {
        // if fails, drop it and try it again
        console.warn('fail to create index:', err)
        try {
          await collection.dropIndex(name)
        } catch (err) {
          console.warn('fail to drop index:', err)
        }
        await collection.createIndex(keys, { name, ...options })
      }
    }

    // drop the removed indexes
    const names = (await collection.listIndexes().toArray())
      .map(({ name }) => name)
      .filter((name) => !(name === '_id_' || name in indexes))
    for (const name of names) await collection.dropIndex(name)

    // update the validator
    if (validator !== undefined) {
      await this.db.command({
        collMod: name,
        validator,
        validationLevel: 'strict',
        validationAction: 'error',
      })
    }
  }
}

export function isTransactionError(err: unknown): boolean {
  return (
    err instanceof MongoError &&
    err.errorLabels !== undefined &&
    Array.isArray(err.errorLabels) &&
    err.errorLabels.includes('TransientTransactionError')
  )
}

export function isDuplicationError(err: unknown): boolean {
  return (
    err instanceof MongoError &&
    err.message.startsWith('E11000 duplicate key error')
  )
}
