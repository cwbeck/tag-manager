import { injectable } from 'inversify';
import Manager from '../../abstractions/Manager';
import { gql } from 'apollo-server-express';
import CTX from '../../gql/ctx/CTX';
import { ObjectID } from 'mongodb';
import DataManagerAccount from '../../mongo/models/data/DataManagerAccount';
import IngestEndpoint from '../../mongo/models/data/IngestEndpoint';
import { differenceInDays } from 'date-fns';
import OperationOwner from '../../enums/OperationOwner';
import userMessages from '../../errors/UserMessages';
import { fetchOrg } from '../../utils/OrgUtils';
import { usageFromAccount } from '../../utils/UsageUtils';

@injectable()
export default class DataManagerAccountManager extends Manager<DataManagerAccount> {
    protected gqlSchema = gql`
        """
        @model
        Metrics to describe the \`Usage\` of a Data Manager account.
        """
        type DataManagerAccountUsage {
            day: DateTime!
            requests: Int!
            bytes: Int!
        }

        """
        @model
        The Data Manager Account is linked to directly to an organisation. It holds the plan type (account_type) and all the ingest endpoints linked to this Org.
        """
        type DataManagerAccount {
            """
            \`DataManagerAccount\` ID
            """
            id: ID!
            """
            \`Org\` that owns this \`DataManagerAccount\`
            """
            org: Org!
            """
            A list of \`IngestEndpoint\`s linked to the \`DataManagerAccount\`
            """
            ingest_endpoints: [IngestEndpoint!]!
            """
            Date the \`DataManagerAccount\` was created
            """
            created_at: DateTime!
            """
            Date the \`DataManagerAccount\` was last updated
            """
            updated_at: DateTime!
            """
            The current product id associated with this account. If this is free plan or managed, this will not be provided
            """
            stripe_product_id: String
            """
            The amount of days until the trial expires
            """
            trial_expires_in: Int!
            """
            If the account is in a trial period
            """
            is_trial: Boolean!
            """
            If the free trial is expired
            """
            trial_expired: Boolean!
            """
            Account usage
            """
            usage: [DataManagerAccountUsage!]!
        }

        # noinspection GraphQLMemberRedefinition
        extend type Query {
            """
            @bound=DataManagerAccount
            Returns a \`DataManagerAccount\` instance provided a valid ID is given and the user has sufficient priviledges to view it.
            """
            getDataManagerAccount(id: ID!): DataManagerAccount!
        }
    `;

    // noinspection JSUnusedGlobalSymbols
    /**
     * Query Resolvers
     * @protected
     */
    protected gqlExtendedQueryResolvers = {
        getDataManagerAccount: async (parent: any, args: any, ctx: CTX) => {
            const dataManagerAccount = await this.repoFactory(DataManagerAccount).findByIdThrows(
                new ObjectID(args.id),
                userMessages.accountFailed,
            );
            return await this.orgAuth.asUserWithViewAccess(
                ctx,
                dataManagerAccount.orgId,
                async () => dataManagerAccount.toGQLType(),
            );
        },
    };

    // noinspection JSUnusedGlobalSymbols
    /**
     * Custom Resolvers
     * @protected
     */
    protected gqlCustomResolvers = {
        DataManagerAccount: {
            org: async (parent: any, args: any, ctx: CTX) => {
                const orgId = new ObjectID(parent.org_id);
                return await this.orgAuth.asUserWithViewAccess(ctx, orgId, async () => {
                    return (await fetchOrg(orgId)).toGQLType();
                });
            },
            ingest_endpoints: async (parent: any, args: any, ctx: CTX) => {
                const dataManagerAccount = await this.repoFactory(
                    DataManagerAccount,
                ).findByIdThrows(new ObjectID(parent.id), userMessages.accountFailed);
                return await this.orgAuth.asUserWithViewAccess(
                    ctx,
                    dataManagerAccount.orgId,
                    async () =>
                        (
                            await this.repoFactory(IngestEndpoint).find({
                                _data_manager_account_id: dataManagerAccount.id,
                            })
                        ).map((_) => _.toGQLType()),
                );
            },
            trial_expires_in: async (parent: any, args: any, ctx: CTX) => {
                const account = await this.repoFactory(DataManagerAccount).findByIdThrows(
                    new ObjectID(parent.id),
                    userMessages.accountFailed,
                );
                return await this.orgAuth.asUserWithViewAccess(ctx, account.orgId, () => {
                    if (account.trialExpiresOn === undefined) {
                        return 0;
                    } else {
                        const daysRemaining = differenceInDays(account.trialExpiresOn, new Date());
                        return daysRemaining > 0 ? daysRemaining : 0;
                    }
                });
            },
            is_trial: async (parent: any, args: any, ctx: CTX) => {
                const account = await this.repoFactory(DataManagerAccount).findByIdThrows(
                    new ObjectID(parent.id),
                    userMessages.accountFailed,
                );
                return await this.orgAuth.asUserWithViewAccess(ctx, account.orgId, () => {
                    return account.isOnFreeTrial();
                });
            },
            trial_expired: async (parent: any, args: any, ctx: CTX) => {
                const account = await this.repoFactory(DataManagerAccount).findByIdThrows(
                    new ObjectID(parent.id),
                    userMessages.accountFailed,
                );
                return await this.orgAuth.asUserWithViewAccess(ctx, account.orgId, () => {
                    return account.trialExpired();
                });
            },
            stripe_product_id: async (parent: any, args: any, ctx: CTX) => {
                const org = await fetchOrg(new ObjectID(parent.org_id));
                return await this.orgAuth.asUserWithViewAccess(ctx, org.id, async () => {
                    const stripeProductId = await this.stripeService.getStripeProductId(
                        org,
                        'DataManagerAccount',
                    );

                    // ensure the account is in the right state
                    if (stripeProductId !== undefined) {
                        const accountRepo = this.repoFactory(DataManagerAccount);
                        const account = await accountRepo.findByIdThrows(
                            new ObjectID(parent.id),
                            userMessages.accountFailed,
                        );

                        account.enabled = true;
                        account.cancelTrial();

                        await accountRepo.save(account, 'SYSTEM', OperationOwner.SYSTEM);
                    }

                    return stripeProductId;
                });
            },
            usage: async (parent: any, args: any, ctx: CTX) => {
                const account = await this.repoFactory(DataManagerAccount).findByIdThrows(
                    new ObjectID(parent.id),
                    userMessages.accountFailed,
                );
                return await usageFromAccount(account, ctx);
            },
        },
    };
}
