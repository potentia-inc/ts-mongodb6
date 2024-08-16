import { MongoClient, MongoError, } from 'mongodb';
import { ConflictError, DisconnectedError, TransactionError } from './error.js';
import { sleep } from './util.js';
export class Connection {
    #client = undefined;
    #locking = false;
    #uri;
    #options;
    get client() {
        if (this.#client === undefined)
            throw new DisconnectedError();
        return this.#client;
    }
    get db() {
        return this.client.db();
    }
    constructor(uri, options) {
        this.#uri = uri;
        this.#options = options;
    }
    async connect() {
        while (this.#client === undefined && this.#locking)
            await sleep(50);
        if (this.#client !== undefined)
            return this.#client;
        this.#locking = true;
        try {
            this.#client = await MongoClient.connect(this.#uri, this.#options);
            ['error', 'timeout', 'parseError'].forEach((event) => {
                this.#client?.on(event, (...args) => console.error(`db event ${event}: ${JSON.stringify(args)}`));
            });
            return this.#client;
        }
        finally {
            this.#locking = false;
        }
    }
    async disconnect(force = false) {
        while (this.#client !== undefined && this.#locking)
            await sleep(50);
        if (this.#client === undefined)
            return;
        this.#locking = true;
        try {
            await this.#client.close(force);
            this.#client = undefined;
        }
        finally {
            this.#locking = false;
        }
    }
    async transaction(fn, options = {}) {
        if (options?.session !== undefined)
            return await fn(options);
        const session = this.client.startSession();
        try {
            return await session.withTransaction(async (session) => await fn({ ...options, session }));
        }
        catch (err) {
            if (isDuplicationError(err))
                throw new ConflictError();
            if (isTransactionError(err))
                throw new TransactionError();
            throw err;
        }
        finally {
            await session.endSession();
        }
    }
    async migrate({ name, validator, indexes = {}, }) {
        const collection = await (async () => {
            try {
                return await this.db.createCollection(name);
            }
            catch (err) {
                return this.db.collection(name);
            }
        })();
        // create/update the current index
        for (const name of Object.keys(indexes)) {
            const { keys, options = {} } = indexes[name];
            try {
                // try to create the index
                await collection.createIndex(keys, { name, ...options });
            }
            catch (err) {
                // if fails, drop it and try it again
                console.warn('fail to create index:', err);
                try {
                    await collection.dropIndex(name);
                }
                catch (err) {
                    console.warn('fail to drop index:', err);
                }
                await collection.createIndex(keys, { name, ...options });
            }
        }
        // drop the removed indexes
        const names = (await collection.listIndexes().toArray())
            .map(({ name }) => name)
            .filter((name) => !(name === '_id_' || name in indexes));
        for (const name of names)
            await collection.dropIndex(name);
        // update the validator
        if (validator !== undefined) {
            await this.db.command({
                collMod: name,
                validator,
                validationLevel: 'strict',
                validationAction: 'error',
            });
        }
    }
}
export function isTransactionError(err) {
    return (err instanceof MongoError &&
        err.errorLabels !== undefined &&
        Array.isArray(err.errorLabels) &&
        err.errorLabels.includes('TransientTransactionError'));
}
export function isDuplicationError(err) {
    return (err instanceof MongoError &&
        err.message.startsWith('E11000 duplicate key error'));
}
//# sourceMappingURL=connection.js.map