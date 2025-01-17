import CTX from '../gql/ctx/CTX';
import User from '../mongo/models/User';
import AuthenticationError from '../errors/AuthenticationError';
import { injectable } from 'inversify';
import userMessages from '../errors/UserMessages';

@injectable()
export default class UserAuth {
    public asUser<U>(ctx: CTX, doThisWith: (user: User) => U): U {
        if (ctx.user === null) {
            throw new AuthenticationError(userMessages.invalidSession, true);
        }
        return doThisWith(ctx.user);
    }
}
